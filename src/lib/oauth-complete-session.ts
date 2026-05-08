import { NextResponse } from "next/server";

import {
    consumeOAuthReturnPathCookie,
    createSession,
    isSafeOAuthReturnPath
} from "@/lib/auth";
import type { ClientLoginMeta } from "@/lib/client-request-meta";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { getEnv, isAllowAnyXUserLoginEnabled } from "@/lib/env";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import {
    dedupeDefaultTenantMembershipsForUser,
    getDefaultTenantMembershipForUser,
    recordUserSuccessfulLogin,
    resolveAuthContext
} from "@/modules/identity/repository";
import { isTenantMembershipCapExceededError } from "@/modules/identity/tenant-membership-cap";
import type { CoreUser } from "@/modules/identity/types";
import { isXchatUserHistoryXaiCollectionEnabled } from "@/modules/xchat/xchat-platform-settings";

export type OAuthLinkedIdentity = {
  xUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

/**
 * Shared tail of X / Google OAuth: tenant membership, session cookie, redirect.
 * Caller must have already resolved `user`, enforced access-request / placeholder rules, and linked identity.
 */
export async function finalizeOAuthSessionAndRedirect(options: {
  origin: string;
  user: CoreUser;
  identity: OAuthLinkedIdentity;
  /** Used only for `ADMIN_X_USERNAMES` allowlist (compare lowercased). */
  usernameForAdminAllowlist: string;
  /** Optional client IP / country / UA for admin access-request visibility. */
  loginMeta?: ClientLoginMeta;
  provider: "x_oauth" | "google_oauth";
}): Promise<NextResponse> {
  const { origin, user, identity, usernameForAdminAllowlist, loginMeta, provider } = options;
  if (!user._id) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider,
      errorCode: "missing_user_id",
      clientIp: loginMeta?.clientIp,
      country: loginMeta?.country,
      userAgent: loginMeta?.userAgent,
      xUserId: identity.xUserId,
      username: identity.username
    });
    return NextResponse.redirect(new URL("/login?error=access_request_pending", origin));
  }

  const env = getEnv();
  const userObjectId = user._id;

  const allowlist = (env.ADMIN_X_USERNAMES ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const usernameIsAllowlisted = allowlist.includes(usernameForAdminAllowlist.toLowerCase());
  const adminAllowlistDenied =
    allowlist.length > 0 && isGlobalAdmin(user.roles) && !usernameIsAllowlisted;
  const allowAnyXUserLogin = isAllowAnyXUserLoginEnabled();

  if (adminAllowlistDenied && !allowAnyXUserLogin) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider,
      errorCode: "not_authorized_admin",
      clientIp: loginMeta?.clientIp,
      country: loginMeta?.country,
      userAgent: loginMeta?.userAgent,
      userId: userObjectId.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
    return NextResponse.redirect(new URL("/login?error=not_authorized_admin", origin));
  }

  if (user.status === "suspended") {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider,
      errorCode: "user_suspended",
      clientIp: loginMeta?.clientIp,
      country: loginMeta?.country,
      userAgent: loginMeta?.userAgent,
      userId: userObjectId.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
    return NextResponse.redirect(new URL("/xchat?error=user_suspended", origin));
  }

  if (!isCoreUserAccountAccessApproved(user)) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider,
      errorCode: user.accountStatus === "rejected" ? "account_rejected" : "account_pending_approval",
      clientIp: loginMeta?.clientIp,
      country: loginMeta?.country,
      userAgent: loginMeta?.userAgent,
      userId: userObjectId.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
    const err =
      user.accountStatus === "rejected" ? "account_rejected" : "account_pending_approval";
    return NextResponse.redirect(new URL(`/xchat?error=${encodeURIComponent(err)}`, origin));
  }

  try {
    await dedupeDefaultTenantMembershipsForUser(userObjectId);
    const existingDefault = await getDefaultTenantMembershipForUser(userObjectId);
    if (!existingDefault?.tenantId) {
      await appendLoginAuditRecord({
        outcome: "failure",
        provider,
        errorCode: "no_tenant_membership",
        clientIp: loginMeta?.clientIp,
        country: loginMeta?.country,
        userAgent: loginMeta?.userAgent,
        userId: userObjectId.toHexString(),
        xUserId: identity.xUserId,
        username: identity.username,
        email: user.email
      });
      return NextResponse.redirect(
        new URL("/xchat?error=no_tenant_membership", origin)
      );
    }
    const authContext = await resolveAuthContext({ user });
    const hasLoginRole = canUserLogin(user.roles);
    const sessionRoles = hasLoginRole
      ? authContext.roles
      : authContext.roles.length > 0
        ? authContext.roles
        : ["viewer"];
    const effectiveSessionRoles = adminAllowlistDenied
      ? sessionRoles.filter((role) => role !== "global_admin" && role !== "admin")
      : sessionRoles;
    const finalSessionRoles =
      effectiveSessionRoles.length > 0 ? effectiveSessionRoles : ["viewer"];

    if (adminAllowlistDenied) {
      console.warn("[auth/oauth] admin allowlist denied, falling back to app_user session", {
        userId: userObjectId.toHexString(),
        username: usernameForAdminAllowlist
      });
    }

    try {
      await ensureTenantBootstrapForUser({
        userId: authContext.userId.toHexString(),
        tenantId: authContext.tenantId.toHexString(),
        trigger: "oauth_login"
      });
    } catch (provisionError) {
      console.warn("[auth/oauth] tenant bootstrap non-fatal; will retry on first /portfolio or API", {
        userId: authContext.userId.toHexString(),
        message: provisionError instanceof Error ? provisionError.message : String(provisionError)
      });
    }

    if (isXchatUserHistoryXaiCollectionEnabled()) {
      try {
        await resolveOrCreateUserBootstrapCollection({
          userId: authContext.userId.toHexString(),
          tenantId: authContext.tenantId.toHexString(),
          email: user.email
        });
      } catch (historyCollectionError) {
        console.warn(
          "[auth/oauth] per-user xChat history xAI collection non-fatal; will retry on /api/xchat/collections",
          {
            userId: authContext.userId.toHexString(),
            message:
              historyCollectionError instanceof Error
                ? historyCollectionError.message
                : String(historyCollectionError)
          }
        );
      }
    }

    try {
      await recordUserSuccessfulLogin({
        userId: userObjectId,
        clientIp: loginMeta?.clientIp,
        country: loginMeta?.country,
        userAgent: loginMeta?.userAgent,
        audit: {
          provider,
          xUserId: identity.xUserId,
          username: identity.username,
          email: user.email
        }
      });
    } catch (loginMetaError) {
      console.warn("[auth/oauth] recordUserSuccessfulLogin non-fatal", {
        userId: userObjectId.toHexString(),
        message: loginMetaError instanceof Error ? loginMetaError.message : String(loginMetaError)
      });
    }

    await createSession({
      userId: authContext.userId.toHexString(),
      email: authContext.email,
      roles: finalSessionRoles,
      tenantId: authContext.tenantId.toHexString(),
      tenantRole: authContext.tenantRole,
      xUserId: authContext.xUserId ?? identity.xUserId,
      username: authContext.username ?? identity.username,
      displayName: authContext.displayName ?? identity.displayName,
      avatarUrl: authContext.avatarUrl ?? identity.avatarUrl
    });

    const returnPath = await consumeOAuthReturnPathCookie();
    const fallback = await resolveSessionLandingPath({
      userId: authContext.userId.toHexString(),
      email: authContext.email,
      roles: finalSessionRoles,
      tenantId: authContext.tenantId.toHexString(),
      tenantRole: authContext.tenantRole,
      xUserId: authContext.xUserId ?? identity.xUserId,
      username: authContext.username ?? identity.username,
      displayName: authContext.displayName ?? identity.displayName,
      avatarUrl: authContext.avatarUrl ?? identity.avatarUrl
    });
    const target = returnPath && isSafeOAuthReturnPath(returnPath) ? returnPath : fallback;
    return NextResponse.redirect(new URL(target, origin));
  } catch (error) {
    if (isTenantMembershipCapExceededError(error)) {
      console.warn("[auth/oauth] tenant user cap reached", {
        userId: userObjectId.toHexString(),
        tenantId: error.tenantIdHex,
        maxUsers: error.maxUsers,
        currentCount: error.currentCount
      });
      await appendLoginAuditRecord({
        outcome: "failure",
        provider,
        errorCode: "tenant_membership_cap",
        clientIp: loginMeta?.clientIp,
        country: loginMeta?.country,
        userAgent: loginMeta?.userAgent,
        userId: userObjectId.toHexString(),
        xUserId: identity.xUserId,
        username: identity.username,
        email: user.email
      });
      return NextResponse.redirect(new URL("/login?error=tenant_membership_cap", origin));
    }
    console.error("[auth/oauth] session bootstrap failed", {
      userId: userObjectId.toHexString(),
      message: error instanceof Error ? error.message : String(error)
    });
    await appendLoginAuditRecord({
      outcome: "failure",
      provider,
      errorCode: "bootstrap_failed",
      clientIp: loginMeta?.clientIp,
      country: loginMeta?.country,
      userAgent: loginMeta?.userAgent,
      userId: userObjectId.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
    return NextResponse.redirect(new URL("/login?error=bootstrap_failed", origin));
  }
}
