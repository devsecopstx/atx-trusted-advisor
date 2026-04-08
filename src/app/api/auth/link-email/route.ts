import { NextResponse } from "next/server";
import { z } from "zod";

import { consumePendingXLinkCookie, createSession } from "@/lib/auth";
import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { getEnv, isAllowAnyXUserLoginEnabled } from "@/lib/env";
import { isSeedAdminEmail } from "@/lib/seed-admin-email";
import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import {
    createAccessRequest,
    getPendingAccessRequestByUserAndRole,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import {
    dedupeDefaultTenantMembershipsForUser,
    ensureCoreUserByEmail,
    ensureDefaultTenant,
    ensureSeededGlobalAdmin,
    getCoreUserByEmail,
    getCoreUserByXIdentity,
    getDefaultTenantMembershipForUser,
    linkXAccountToUser,
    mergePlaceholderXUserIntoEmailUser,
    recordUserSuccessfulLogin,
    resolveAuthContext,
    unlinkXAccountFromUser,
    updateCoreUserEmail,
    upsertTenantMembership
} from "@/modules/identity/repository";

const linkSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const env = getEnv();
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
  const seededAdmin =
    isSeedAdminEmail(requestedEmail, env.ADMIN_SEED_EMAIL)
      ? await ensureSeededGlobalAdmin(requestedEmail)
      : null;
  let user = seededAdmin?.user ?? (await getCoreUserByEmail(requestedEmail));
  const existingByXIdentity = await getCoreUserByXIdentity(pending.xUserId);
  const emailUserId = user?._id;
  const xIdentityUserId = existingByXIdentity?._id;

  if (user && xIdentityUserId && emailUserId && !isSameUserId(xIdentityUserId, emailUserId)) {
    // If the requested email already belongs to an approved admin, re-link X identity to that account.
    if (isGlobalAdmin(user.roles)) {
      await unlinkXAccountFromUser({ userId: xIdentityUserId });
      user = await linkXAccountToUser({
        userId: emailUserId,
        xUserId: pending.xUserId,
        username: pending.username,
        displayName: pending.displayName,
        avatarUrl: pending.avatarUrl
      });
    } else if (existingByXIdentity && isXIdentityPlaceholderEmail(existingByXIdentity.email)) {
      // X (no email) created a placeholder row; the same person later signed in with Google on that email.
      user = await mergePlaceholderXUserIntoEmailUser({
        canonicalUserId: emailUserId,
        placeholderUser: existingByXIdentity,
        xIdentity: {
          xUserId: pending.xUserId,
          username: pending.username,
          displayName: pending.displayName,
          avatarUrl: pending.avatarUrl
        }
      });
    }
  } else if (
    xIdentityUserId &&
    existingByXIdentity &&
    isXIdentityPlaceholderEmail(existingByXIdentity.email) &&
    (!user?._id || isSameUserId(xIdentityUserId, user._id))
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

  const linkedUser =
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

  const allowAnyXUserLogin = isAllowAnyXUserLoginEnabled();
  const hasLoginRole = canUserLogin(linkedUser.roles);

  if (!hasLoginRole) {
    const userId = linkedUser._id?.toHexString();
    if (userId) {
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
    }

    if (!allowAnyXUserLogin) {
      await appendLoginAuditRecord({
        outcome: "failure",
        provider: "link_email",
        errorCode: "access_request_pending",
        clientIp: loginMeta.clientIp,
        country: loginMeta.country,
        userAgent: loginMeta.userAgent,
        userId: linkedUser._id?.toHexString(),
        xUserId: pending.xUserId,
        username: pending.username,
        email: requestedEmail
      });
      return NextResponse.json({
        ok: true,
        redirectTo: "/xchat?error=access_request_pending"
      });
    }
  }

  const tenant = await ensureDefaultTenant();
  if (!tenant._id || !linkedUser._id) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "link_email",
      errorCode: "tenant_context_failed",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: linkedUser._id?.toHexString(),
      xUserId: pending.xUserId,
      username: pending.username,
      email: requestedEmail
    });
    return NextResponse.json({ error: "Failed to resolve tenant context" }, { status: 500 });
  }
  await dedupeDefaultTenantMembershipsForUser(linkedUser._id);
  const existingDefault = await getDefaultTenantMembershipForUser(linkedUser._id);
  if (!existingDefault) {
    await upsertTenantMembership({
      userId: linkedUser._id,
      tenantId: tenant._id,
      role: "tenant_admin",
      isDefaultTenant: true
    });
  }

  const authContext = await resolveAuthContext({ user: linkedUser });
  const sessionRoles = hasLoginRole
    ? authContext.roles
    : authContext.roles.length > 0
      ? authContext.roles
      : ["viewer"];

  await provisionDefaultPortfolioForUser({
    userId: authContext.userId.toHexString(),
    tenantId: authContext.tenantId.toHexString()
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

