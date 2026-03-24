import { NextResponse } from "next/server";

import {
    consumeOAuthReturnPathCookie,
    createSession,
    isSafeOAuthReturnPath
} from "@/lib/auth";
import { getEnv, isAllowAnyXUserLoginEnabled } from "@/lib/env";
import { provisionDefaultPortfolioForUser } from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
    ensureDefaultTenant,
    resolveAuthContext,
    upsertTenantMembership
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

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
}): Promise<NextResponse> {
  const { origin, user, identity, usernameForAdminAllowlist } = options;
  if (!user._id) {
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
    return NextResponse.redirect(new URL("/login?error=not_authorized_admin", origin));
  }

  const tenant = await ensureDefaultTenant();
  if (!tenant._id) {
    return NextResponse.redirect(new URL("/login?error=tenant_bootstrap_failed", origin));
  }

  try {
    await upsertTenantMembership({
      userId: userObjectId,
      tenantId: tenant._id,
      role: "tenant_admin",
      isDefaultTenant: true
    });
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
      await provisionDefaultPortfolioForUser({
        userId: authContext.userId.toHexString(),
        tenantId: authContext.tenantId.toHexString()
      });
    } catch (provisionError) {
      console.warn("[auth/oauth] default portfolio provision non-fatal; will retry on first /portfolio or API", {
        userId: authContext.userId.toHexString(),
        message: provisionError instanceof Error ? provisionError.message : String(provisionError)
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
    const fallback = isGlobalAdmin(finalSessionRoles) ? "/admin" : "/xchat";
    const target = returnPath && isSafeOAuthReturnPath(returnPath) ? returnPath : fallback;
    return NextResponse.redirect(new URL(target, origin));
  } catch (error) {
    console.error("[auth/oauth] session bootstrap failed", {
      userId: userObjectId.toHexString(),
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.redirect(new URL("/login?error=bootstrap_failed", origin));
  }
}
