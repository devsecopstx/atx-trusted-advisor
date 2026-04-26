import type { SessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";
import {
    APP_USER_PRODUCT_PATH_PREFIXES,
    isAppUserProductPath,
    normalizePathnameForPolicy,
    type AppUserProductPathPrefix
} from "@/modules/platform/app-user-product-prefixes";
import type { PlatformRoleForRoutes } from "@/modules/platform/app-user-route-catalog";
import { isPathVisibleForRoleByCatalogDefaults } from "@/modules/platform/app-user-route-catalog";
import {
    parseTenantRolesByRole,
    type TenantRolePolicy
} from "@/modules/platform/tenant-route-policy";

/**
 * URL path prefixes for the **app_user** product shell (xChat chrome, shared nav).
 * `global_admin` may also use these routes; they are not admin-console exclusive.
 *
 * Route metadata / compliance seeds: `data/platform/app-user-route-catalog.json` (keep in sync).
 */
const ADMIN_CONSOLE_PREFIX = "/admin";

export { APP_USER_PRODUCT_PATH_PREFIXES, isAppUserProductPath };
export type { AppUserProductPathPrefix };

function normalizePathname(pathname: string): string {
  return normalizePathnameForPolicy(pathname);
}

/** True if pathname is the admin console (`/admin` or `/admin/...`). */
export function isAdminConsolePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return p === ADMIN_CONSOLE_PREFIX || p.startsWith(`${ADMIN_CONSOLE_PREFIX}/`);
}

/**
 * Product pages that require an approved platform role (viewer+), matching watchlist/xoptions.
 * Use in Server Components after `getSessionUser()`.
 */
export function requireApprovedLoginForProduct(session: SessionUser | null): session is SessionUser {
  return session !== null && canUserLogin(session.roles);
}

export function getEffectiveRoutePolicy(
  role: PlatformRoleForRoutes,
  tenantPreferences?: { tenantRoles?: unknown } | null
): TenantRolePolicy | null {
  const tenantRoles = parseTenantRolesByRole(tenantPreferences?.tenantRoles);
  return tenantRoles[role] ?? null;
}

export function isRouteAllowedForRole(
  route: string,
  role: PlatformRoleForRoutes,
  tenantPreferences?: { tenantRoles?: unknown } | null
): boolean {
  const policy = getEffectiveRoutePolicy(role, tenantPreferences);
  if (!policy) {
    return isPathVisibleForRoleByCatalogDefaults(route, role);
  }
  const normalized = normalizePathname(route);
  return policy.allowedRoutes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
