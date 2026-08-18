import { NextResponse } from "next/server";
import { z } from "zod";

import { consumePendingXLinkCookie, createSession } from "@/lib/auth";
import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { provisionOpenSignupTrialAccess } from "@/lib/marketing/guest-trial-auth";
import { sendEmailVerificationEmail } from "@/lib/send-email-credential-messages";
import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import {
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { issueEmailVerificationForUser } from "@/modules/identity/email-credentials-repository";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import {
    dedupeDefaultTenantMembershipsForUser,
    ensureCoreUserByEmail,
    getCoreUserByEmail,
    getCoreUserByXIdentity,
    getDefaultTenantMembershipForUser,
    linkXAccountToUser,
    recordUserSuccessfulLogin,
    resolveAuthContext,
    updateCoreUserEmail
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

const linkSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const loginMeta = extractClientLoginMeta(request);
  const body = await request.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "invalid_email_payload",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent
    });
    return NextResponse.json(
      { error: "Invalid email payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pending = await consumePendingXLinkCookie();
  if (!pending) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "no_pending_x_link",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent
    });
    return NextResponse.json({ error: "No pending X login context found" }, { status: 400 });
  }

  const requestedEmail = parsed.data.email.trim().toLowerCase();
  // Never bind X onto an existing email row from a self-typed address (account takeover).
  // Seed-admin promotion belongs on the X callback via ADMIN_SEED_X_USER_ID, not this path.
  const existingByEmail = await getCoreUserByEmail(requestedEmail);
  const existingByXIdentity = await getCoreUserByXIdentity(pending.xUserId);
  const emailUserId = existingByEmail?._id;
  const xIdentityUserId = existingByXIdentity?._id;

  if (emailUserId && xIdentityUserId && !isSameUserId(xIdentityUserId, emailUserId)) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "email_belongs_to_other_account",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      email: requestedEmail,
      xUserId: pending.xUserId,
      username: pending.username
    });
    return NextResponse.json({
      ok: true,
      redirectTo: "/xchat?error=email_belongs_to_other_account"
    });
  }

  if (emailUserId && !xIdentityUserId) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "email_belongs_to_other_account",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      email: requestedEmail,
      xUserId: pending.xUserId,
      username: pending.username
    });
    return NextResponse.json({
      ok: true,
      redirectTo: "/xchat?error=email_belongs_to_other_account"
    });
  }

  let user = existingByEmail ?? existingByXIdentity ?? null;

  if (
    xIdentityUserId &&
    existingByXIdentity &&
    isXIdentityPlaceholderEmail(existingByXIdentity.email) &&
    (!emailUserId || isSameUserId(xIdentityUserId, emailUserId))
  ) {
    user = await updateCoreUserEmail({
      userId: xIdentityUserId,
      email: requestedEmail
    });
  }

  if (!user?._id) {
    user = await ensureCoreUserByEmail({
      email: requestedEmail
    });
  }
  if (!user?._id) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "unable_to_resolve_user",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      email: requestedEmail,
      xUserId: pending.xUserId,
      username: pending.username
    });
    return NextResponse.json(
      { error: "Unable to create or resolve user by email" },
      { status: 500 }
    );
  }

  let linkedUser: CoreUser =
    user.xAccount?.xUserId === pending.xUserId &&
    user.xAccount?.username === pending.username
      ? user
      : await linkXAccountToUser({
          userId: user._id,
          xUserId: pending.xUserId,
          username: pending.username,
          displayName: pending.displayName,
          avatarUrl: pending.avatarUrl
        });

  if (linkedUser._id) {
    // Typed email is not provider-proven — never stamp emailVerifiedAt from this path.
    linkedUser = await provisionOpenSignupTrialAccess({
      user: linkedUser
    });
  }

  const linkedUserId = linkedUser._id;
  if (!linkedUserId) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "missing_user_id",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      email: requestedEmail,
      xUserId: pending.xUserId,
      username: pending.username
    });
    return NextResponse.json({ error: "Missing user id" }, { status: 500 });
  }

  const hasLoginRole = canUserLogin(linkedUser.roles);

  if (!hasLoginRole) {
    const userId = linkedUserId.toHexString();
    const requestedRole = "operator";
    const existingPending = await getPendingAccessRequestByUserAndRole({
      userId,
      requestedRole
    });
    if (!existingPending) {
      await createAccessRequest({
        userId,
        requestedRole,
        contactEmail: requestedEmail,
        reason: "Auto-created from email-link login attempt"
      });
    }

    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "access_request_pending",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUserId.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: requestedEmail
    });
    return NextResponse.json({
      ok: true,
      redirectTo: "/xchat?error=access_request_pending"
    });
  }

  if (!linkedUser.emailVerifiedAt) {
    let verificationSent = false;
    try {
      const issued = await issueEmailVerificationForUser(linkedUserId);
      if (issued?.rawToken) {
        verificationSent = await sendEmailVerificationEmail({
          request,
          to: linkedUser.email,
          rawToken: issued.rawToken
        });
      }
    } catch {
      verificationSent = false;
    }

    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "email_unverified",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUserId.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: linkedUser.email
    });
    return NextResponse.json({
      ok: true,
      redirectTo: `/xchat?error=email_unverified&verificationSent=${verificationSent ? "1" : "0"}`
    });
  }

  if (linkedUser.status === "suspended") {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "user_suspended",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUserId.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: requestedEmail
    });
    return NextResponse.json({
      ok: true,
      redirectTo: "/xchat?error=user_suspended"
    });
  }

  if (!isCoreUserAccountAccessApproved(linkedUser)) {
    const err =
      linkedUser.accountStatus === "rejected" ? "account_rejected" : "account_pending_approval";
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: err,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUserId.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: requestedEmail
    });
    return NextResponse.json({
      ok: true,
      redirectTo: `/xchat?error=${encodeURIComponent(err)}`
    });
  }

  await dedupeDefaultTenantMembershipsForUser(linkedUserId);
  const existingDefault = await getDefaultTenantMembershipForUser(linkedUserId);
  if (!existingDefault?.tenantId) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "no_tenant_membership",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUserId.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: requestedEmail
    });
    return NextResponse.json({
      ok: true,
      redirectTo: "/xchat?error=no_tenant_membership"
    });
  }

  const authContext = await resolveAuthContext({ user: linkedUser });
  const sessionRoles = hasLoginRole
    ? authContext.roles
    : authContext.roles.length > 0
      ? authContext.roles
      : ["viewer"];

  await ensureTenantBootstrapForUser({
    userId: authContext.userId.toHexString(),
    tenantId: authContext.tenantId.toHexString(),
    trigger: "link_email"
  });

  try {
    await recordUserSuccessfulLogin({
      userId: authContext.userId,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      audit: {
        provider: "link_email",
        xUserId: pending.xUserId,
        username: pending.username,
        email: authContext.email
      }
    });
  } catch (e) {
    console.warn("[auth/link-email] recordUserSuccessfulLogin non-fatal", {
      userId: authContext.userId.toHexString(),
      message: e instanceof Error ? e.message : String(e)
    });
  }

  await createSession({
    userId: authContext.userId.toHexString(),
    email: authContext.email,
    roles: sessionRoles,
    tenantId: authContext.tenantId.toHexString(),
    tenantRole: authContext.tenantRole,
    xUserId: authContext.xUserId ?? pending.xUserId,
    username: authContext.username ?? pending.username,
    displayName: authContext.displayName ?? pending.displayName,
    avatarUrl: authContext.avatarUrl ?? pending.avatarUrl
  });

  return NextResponse.json({
    ok: true,
    redirectTo: isGlobalAdmin(sessionRoles) ? "/admin" : "/xchat"
  });
}

function isSameUserId(
  left: { toHexString: () => string },
  right: { toHexString: () => string }
): boolean {
  return left.toHexString() === right.toHexString();
}

