import type { SessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

/**
 * URL path prefixes for the **app_user** product shell (xChat chrome, shared nav).
 * `global_admin` may also use these routes; they are not admin-console exclusive.
 */
export const APP_USER_PRODUCT_PATH_PREFIXES = [
  "/xchat",
  "/xstrategybuilder",
  "/portfolio",
  "/watchlist"
] as const;

export type AppUserProductPathPrefix = (typeof APP_USER_PRODUCT_PATH_PREFIXES)[number];

const ADMIN_CONSOLE_PREFIX = "/admin";

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "") {
    return "/";
  }
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withLeading.length > 1 && withLeading.endsWith("/")) {
    return withLeading.slice(0, -1);
  }
  return withLeading;
}

/** True if pathname is under the app_user product surface (exact prefix match). */
export function isAppUserProductPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (APP_USER_PRODUCT_PATH_PREFIXES as readonly string[]).some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}

/** True if pathname is the admin console (`/admin` or `/admin/...`). */
export function isAdminConsolePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return p === ADMIN_CONSOLE_PREFIX || p.startsWith(`${ADMIN_CONSOLE_PREFIX}/`);
}

/**
 * Product pages that require an approved platform role (viewer+), matching watchlist/xstrategybuilder.
 * Use in Server Components after `getSessionUser()`.
 */
export function requireApprovedLoginForProduct(session: SessionUser | null): session is SessionUser {
  return session !== null && canUserLogin(session.roles);
}
