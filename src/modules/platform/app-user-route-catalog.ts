import { z } from "zod";

import { APP_USER_PRODUCT_PATH_PREFIXES } from "@/modules/platform/app-user-product-prefixes";
import rawCatalog from "../../../data/platform/app-user-route-catalog.json";

const platformRoleSchema = z.enum(["global_admin", "advisor", "operator", "viewer"]);

const routeGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

const pathMatchSchema = z.enum(["prefix", "exact"]);

const catalogEntrySchema = z.object({
  id: z.string().min(1),
  pathPattern: z.string().min(1),
  pathMatch: pathMatchSchema,
  label: z.string().min(1),
  groupId: z.string().min(1),
  inWorkspaceProductShell: z.boolean(),
  guestHtmlShell: z.boolean(),
  complianceSummary: z.string().min(1),
  implementationNote: z.string().optional(),
  redirectsTo: z.string().optional(),
  defaultVisibleForRoles: z.array(platformRoleSchema).min(1)
});

export const appUserRouteCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  catalogKind: z.literal("app_user_route_catalog"),
  updated: z.string().min(1),
  description: z.string().min(1),
  platformRoles: z.array(platformRoleSchema),
  tenantAssignableRoles: z.array(platformRoleSchema),
  suggestedDefaultLandingPathByRole: z.record(platformRoleSchema, z.string().min(1)),
  groups: z.array(routeGroupSchema).min(1),
  entries: z.array(catalogEntrySchema).min(1)
});

export type AppUserRouteCatalog = z.infer<typeof appUserRouteCatalogSchema>;
export type AppUserRouteCatalogEntry = z.infer<typeof catalogEntrySchema>;
export type PlatformRoleForRoutes = z.infer<typeof platformRoleSchema>;
export type AppUserRouteVisibilityOverrides = Partial<Record<string, boolean>>;

let cached: AppUserRouteCatalog | null = null;

/** Validated catalog from `data/platform/app-user-route-catalog.json` (fail-fast on bad data). */
export function getAppUserRouteCatalog(): AppUserRouteCatalog {
  if (cached) {
    return cached;
  }
  const parsed = appUserRouteCatalogSchema.safeParse(rawCatalog);
  if (!parsed.success) {
    throw new Error(`app-user-route-catalog invalid: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return parsed.data;
}

/**
 * Root path prefixes marked as workspace shell rows — must match {@link APP_USER_PRODUCT_PATH_PREFIXES}.
 */
export function getWorkspaceShellCatalogPrefixes(): string[] {
  return getAppUserRouteCatalog()
    .entries.filter((e) => e.inWorkspaceProductShell && e.pathMatch === "prefix")
    .map((e) => e.pathPattern)
    .sort();
}

/** True if pathname is allowed for role per catalog defaults (prefix/exact match; longest pattern wins). */
export function isPathVisibleForRoleByCatalogDefaults(pathname: string, role: PlatformRoleForRoutes): boolean {
  const catalog = getAppUserRouteCatalog();
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized = p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;

  const sorted = [...catalog.entries].sort((a, b) => b.pathPattern.length - a.pathPattern.length);
  for (const entry of sorted) {
    const hit =
      entry.pathMatch === "exact"
        ? normalized === entry.pathPattern
        : normalized === entry.pathPattern || normalized.startsWith(`${entry.pathPattern}/`);
    if (hit) {
      return entry.defaultVisibleForRoles.includes(role);
    }
  }
  return false;
}

/** Effective route visibility: catalog defaults, optionally overridden per tenant by route id. */
export function isRouteVisibleForRole(
  entry: AppUserRouteCatalogEntry,
  role: PlatformRoleForRoutes,
  overrides?: AppUserRouteVisibilityOverrides | null
): boolean {
  const override = overrides?.[entry.id];
  if (typeof override === "boolean") {
    return override;
  }
  return entry.defaultVisibleForRoles.includes(role);
}

/** Prefix paths visible to a role after tenant overrides are applied. */
export function listVisiblePrefixPathsForRole(
  role: PlatformRoleForRoutes,
  overrides?: AppUserRouteVisibilityOverrides | null
): string[] {
  return getAppUserRouteCatalog()
    .entries.filter((entry) => entry.pathMatch === "prefix")
    .filter((entry) => isRouteVisibleForRole(entry, role, overrides))
    .map((entry) => entry.pathPattern)
    .sort();
}

/** Assert catalog workspace shell roots align with `surface-policy` (call from tests). */
export function assertCatalogMatchesWorkspaceProductPrefixes(): void {
  const fromCatalog = new Set(getWorkspaceShellCatalogPrefixes());
  const fromPolicy = new Set(APP_USER_PRODUCT_PATH_PREFIXES as readonly string[]);
  const missing = [...fromPolicy].filter((x) => !fromCatalog.has(x));
  const extra = [...fromCatalog].filter((x) => !fromPolicy.has(x));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `APP_USER_PRODUCT_PATH_PREFIXES drift vs catalog: missing in catalog=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`
    );
  }
}
