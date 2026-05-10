import { normalizePathnameForPolicy } from "@/modules/platform/app-user-product-prefixes";

/**
 * Client-side mirror of tenant route visibility: a path is allowed if it equals a catalog prefix
 * or is nested under one (same idea as `isRouteAllowedForRole` / edge policy checks).
 */
export function isPathAllowedByTenantUxRoutes(
  pathname: string,
  allowedRoutes: string[] | null | undefined
): boolean {
  if (allowedRoutes == null) {
    return true;
  }
  if (allowedRoutes.length === 0) {
    return false;
  }
  const raw = pathname.split("?")[0]?.trim() || "/";
  const path = normalizePathnameForPolicy(raw.startsWith("/") ? raw : `/${raw}`);
  return allowedRoutes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
