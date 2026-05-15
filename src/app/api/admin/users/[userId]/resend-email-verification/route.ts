import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { assertUserEligibleForEmailVerificationResend } from "@/lib/admin-user-email-verification";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { sendEmailVerificationEmail } from "@/lib/send-email-credential-messages";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    adminClearVerificationAndPasswordState,
    issueEmailVerificationForUser
} from "@/modules/identity/email-credentials-repository";
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

  const denial = assertUserEligibleForEmailVerificationResend(user);
  if (denial) {
    return NextResponse.json(
      { error: denial, code: "email_verification_resend_blocked" },
      { status: 409 }
    );
  }

  const notifyEmail = resolveAccessApprovalNotifyEmail(user, {});
  if (!notifyEmail) {
    return NextResponse.json(
      { error: "No deliverable email on file.", code: "email_verification_resend_blocked" },
      { status: 409 }
    );
  }

  const cleared = await adminClearVerificationAndPasswordState(user._id);
  if (!cleared) {
    return NextResponse.json({ error: "Failed to reset user auth state" }, { status: 503 });
  }

  const issued = await issueEmailVerificationForUser(user._id);
  if (!issued) {
    await createAuditEvent({
      entityType: "core_user",
      entityId: userId,
      action: "email_verification_resend_issue_failed",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {}
    });
    return NextResponse.json({ error: "Failed to issue verification token" }, { status: 503 });
  }

  const userAfterIssue = await getCoreUserById(new ObjectId(userId));
  const emailVerificationExpiresAt =
    userAfterIssue?.emailVerificationExpiresAt instanceof Date
      ? userAfterIssue.emailVerificationExpiresAt.toISOString()
      : null;

  const sent = await sendEmailVerificationEmail({
    request,
    to: notifyEmail,
    rawToken: issued.rawToken
  });

  if (!sent) {
    console.warn("[admin/users] email verification resend not sent (desk SMTP off or failure)", {
      userId
    });
    await createAuditEvent({
      entityType: "core_user",
      entityId: userId,
      action: "email_verification_resend_email_failed",
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
        error: "Verification was reissued but email could not be sent (check desk SMTP).",
        code: "email_verification_email_failed",
        data: {
          userId,
          emailedTo: notifyEmail,
          emailVerificationExpiresAt
        }
      },
      { status: 502 }
    );
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "email_verification_resent",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      emailedTo: notifyEmail,
      clearedPasswordAndVerificationState: true
    }
  });

  return NextResponse.json({
    data: {
      userId,
      emailedTo: notifyEmail,
      emailVerificationExpiresAt
    }
  });
}
