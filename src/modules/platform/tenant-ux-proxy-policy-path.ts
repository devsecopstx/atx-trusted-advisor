import {
  APP_USER_PRODUCT_PATH_PREFIXES,
  isAppUserProductPath,
  normalizePathnameForPolicy
} from "@/modules/platform/app-user-product-prefixes";

/**
 * Maps an HTTP pathname (HTML or API) to a **tenant UX policy prefix** checked by
 * `GET /api/internal/tenant-ux/policy` (edge `TENANT_UX_ENFORCEMENT_V2`).
 */
export function resolvePolicyPathForRequest(pathname: string): string | null {
  const p = normalizePathnameForPolicy(pathname);
  if (isAppUserProductPath(p)) {
    const match = (APP_USER_PRODUCT_PATH_PREFIXES as readonly string[]).find(
      (prefix) => p === prefix || p.startsWith(`${prefix}/`)
    );
    return match ?? null;
  }
  if (p.startsWith("/api/xchat")) return "/xchat";
  if (p.startsWith("/api/app-user/xchat")) return "/xchat";
  if (p.startsWith("/api/app-user/find-options")) return "/xoptions";
  if (p.startsWith("/api/app-user/symbol-chart")) return "/xoptions";
  if (p.startsWith("/api/app-user/xoptions")) return "/xoptions";
  if (p.startsWith("/api/user/watchlist")) return "/watchlist";
  if (p.startsWith("/api/user/workspace-portfolio")) return "/workspace";
  if (p.startsWith("/api/portfolios")) return "/portfolio";
  if (p.startsWith("/api/positions")) return "/portfolio";
  if (p.startsWith("/api/import")) return "/import-activity";
  if (p.startsWith("/api/integrations")) return "/account";
  if (p.startsWith("/api/tenant-tasks")) return "/workspace";
  return null;
}
