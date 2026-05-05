/**
 * Edge-safe app_user product path prefixes shared by proxy, route catalog checks, and surface policy.
 */
export const APP_USER_PRODUCT_PATH_PREFIXES = [
  "/xchat",
  "/xcoach",
  "/portfolio",
  "/portfolios",
  "/import-activity",
  "/watchlist",
  "/account",
  "/workspace/tasks",
  "/workspace",
  "/xoptions"
] as const;

export type AppUserProductPathPrefix = (typeof APP_USER_PRODUCT_PATH_PREFIXES)[number];

export function normalizePathnameForPolicy(pathname: string): string {
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
  const p = normalizePathnameForPolicy(pathname);
  return (APP_USER_PRODUCT_PATH_PREFIXES as readonly string[]).some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}
