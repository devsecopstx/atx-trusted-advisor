import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import {
    assertUserEligibleForCredentialInviteResend,
    getAdminUserCredentialInviteFields,
    resolveResendCredentialInviteForceDenial
} from "@/lib/admin-user-credential-invite";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { sendAccessApprovedPasswordInviteEmail } from "@/lib/send-email-credential-messages";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    adminClearPasswordAndLoginTokens,
    issueCredentialInviteForUser
} from "@/modules/identity/email-credentials-repository";
import { getCoreUserById } from "@/modules/identity/repository";

const postBodySchema = z.object({
  forcePasswordRotate: z.boolean().optional()
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const userOid = new ObjectId(userId);
  const user = await getCoreUserById(userOid);
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    bodyJson = {};
  }
  const parsedBody = postBodySchema.safeParse(bodyJson);
  const forcePasswordRotate = parsedBody.success ? Boolean(parsedBody.data.forcePasswordRotate) : false;

  let forcedPasswordClear = false;
  if (user.passwordHash && user.passwordHash.length > 0) {
    if (!forcePasswordRotate) {
      return NextResponse.json(
        { error: "User already has a password set.", code: "credential_invite_resend_blocked" },
        { status: 409 }
      );
    }
    const forceDenial = resolveResendCredentialInviteForceDenial(user);
    if (forceDenial) {
      return NextResponse.json(
        { error: forceDenial, code: "credential_invite_force_blocked" },
        { status: 409 }
      );
    }
    const cleared = await adminClearPasswordAndLoginTokens(userOid);
    if (!cleared) {
      return NextResponse.json({ error: "Failed to clear password for invite" }, { status: 503 });
    }
    forcedPasswordClear = true;
  }

  const userForInvite = (await getCoreUserById(userOid)) ?? user;
  const denial = assertUserEligibleForCredentialInviteResend(userForInvite);
  if (denial) {
    return NextResponse.json({ error: denial, code: "credential_invite_resend_blocked" }, { status: 409 });
  }

  const notifyEmail = resolveAccessApprovalNotifyEmail(userForInvite, {});
  if (!notifyEmail) {
    return NextResponse.json(
      { error: "No deliverable email on file.", code: "credential_invite_resend_blocked" },
      { status: 409 }
    );
  }

  const issued = await issueCredentialInviteForUser(userOid);
  if (!issued) {
    await createAuditEvent({
      entityType: "core_user",
      entityId: userId,
      action: "credential_invite_resend_issue_failed",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {}
    });
    return NextResponse.json({ error: "Failed to issue invite token" }, { status: 503 });
  }

  const userAfterIssue = await getCoreUserById(userOid);
  const credentialInviteExpiresAt = userAfterIssue
    ? getAdminUserCredentialInviteFields(userAfterIssue).credentialInviteExpiresAt
    : null;

  const display =
    userForInvite.googleAccount?.displayName?.trim() ||
    userForInvite.xAccount?.displayName?.trim() ||
    "";
  const firstName = display ? display.split(/\s+/)[0] : undefined;

  const sent = await sendAccessApprovedPasswordInviteEmail({
    request,
    to: notifyEmail,
    rawToken: issued.rawToken,
    ...(firstName ? { firstName } : {})
  });

  if (!sent) {
    console.warn("[admin/users] credential invite resend email not sent (desk SMTP off or failure)", {
      userId
    });
    await createAuditEvent({
      entityType: "core_user",
      entityId: userId,
      action: "credential_invite_resend_email_failed",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        reason: "desk_smtp_off_or_send_failed"
      }
    });
    return NextResponse.json(
      {
        error: "Invite was reissued but email could not be sent (check desk SMTP).",
        code: "credential_invite_email_failed",
        data: {
          userId,
          emailedTo: notifyEmail,
          credentialInviteExpiresAt
        }
      },
      { status: 502 }
    );
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "credential_invite_resent",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      emailedTo: notifyEmail,
      ...(forcedPasswordClear ? { forcedPasswordClear: true } : {})
    }
  });

  return NextResponse.json({
    data: {
      userId,
      emailedTo: notifyEmail,
      credentialInviteExpiresAt
    }
  });
}
