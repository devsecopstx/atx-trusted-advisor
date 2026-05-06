import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import {
    assertUserEligibleForCredentialInviteResend,
    getAdminUserCredentialInviteFields
} from "@/lib/admin-user-credential-invite";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { sendAccessApprovedPasswordInviteEmail } from "@/lib/send-email-credential-messages";
import { createAuditEvent } from "@/modules/audit/repository";
import { issueCredentialInviteForUser } from "@/modules/identity/email-credentials-repository";
import { getCoreUserById } from "@/modules/identity/repository";

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

  const user = await getCoreUserById(new ObjectId(userId));
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const denial = assertUserEligibleForCredentialInviteResend(user);
  if (denial) {
    return NextResponse.json({ error: denial, code: "credential_invite_resend_blocked" }, { status: 409 });
  }

  const notifyEmail = resolveAccessApprovalNotifyEmail(user, {});
  if (!notifyEmail) {
    return NextResponse.json(
      { error: "No deliverable email on file.", code: "credential_invite_resend_blocked" },
      { status: 409 }
    );
  }

  const issued = await issueCredentialInviteForUser(user._id);
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

  const userAfterIssue = await getCoreUserById(new ObjectId(userId));
  const credentialInviteExpiresAt = userAfterIssue
    ? getAdminUserCredentialInviteFields(userAfterIssue).credentialInviteExpiresAt
    : null;

  const display =
    user.googleAccount?.displayName?.trim() || user.xAccount?.displayName?.trim() || "";
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
      emailedTo: notifyEmail
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
