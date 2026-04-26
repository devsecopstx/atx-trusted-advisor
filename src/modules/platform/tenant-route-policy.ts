import type { SessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getTenantByHexId } from "@/modules/identity/repository";
import {
    getAppUserRouteCatalog,
    isRouteVisibleForRole,
    listVisiblePrefixPathsForRole,
    type AppUserRouteCatalogEntry,
    type AppUserRouteVisibilityOverrides,
    type PlatformRoleForRoutes
} from "@/modules/platform/app-user-route-catalog";

export type TenantDefaultLandingPathByRole = Partial<Record<PlatformRoleForRoutes, string>>;

const ROLE_ORDER: readonly PlatformRoleForRoutes[] = ["global_admin", "advisor", "operator", "viewer"] as const;

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

function routeMatchesPath(pathname: string, entry: AppUserRouteCatalogEntry): boolean {
  if (entry.pathMatch === "exact") {
    return pathname === entry.pathPattern;
  }
  return pathname === entry.pathPattern || pathname.startsWith(`${entry.pathPattern}/`);
}

function sortedEntriesByPathSpecificity(): AppUserRouteCatalogEntry[] {
  return [...getAppUserRouteCatalog().entries].sort((a, b) => b.pathPattern.length - a.pathPattern.length);
}

export function resolvePlatformRoleForRoutes(session: SessionUser): PlatformRoleForRoutes {
  if (isGlobalAdmin(session.roles)) {
    return "global_admin";
  }
  if (session.roles.includes("advisor")) {
    return "advisor";
  }
  if (session.roles.includes("operator")) {
    return "operator";
  }
  return "viewer";
}

export function parseRouteVisibilityOverrides(raw: unknown): AppUserRouteVisibilityOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: AppUserRouteVisibilityOverrides = {};
  for (const [routeId, value] of Object.entries(raw)) {
    if (typeof value === "boolean") {
      out[routeId] = value;
    }
  }
  return out;
}

export function parseDefaultLandingPathByRole(raw: unknown): TenantDefaultLandingPathByRole {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: TenantDefaultLandingPathByRole = {};
  for (const role of ROLE_ORDER) {
    const value = (raw as Record<string, unknown>)[role];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
      continue;
    }
    out[role] = normalizePathname(trimmed);
  }
  return out;
}

export function isPathVisibleForRole(
  pathname: string,
  role: PlatformRoleForRoutes,
  overrides?: AppUserRouteVisibilityOverrides | null
): boolean {
  const normalized = normalizePathname(pathname);
  for (const entry of sortedEntriesByPathSpecificity()) {
    if (routeMatchesPath(normalized, entry)) {
      return isRouteVisibleForRole(entry, role, overrides);
    }
  }
  return false;
}

export function resolveDefaultLandingPathForRole(input: {
  role: PlatformRoleForRoutes;
  overrides?: AppUserRouteVisibilityOverrides | null;
  defaultLandingPathByRole?: TenantDefaultLandingPathByRole | null;
}): string {
  const { role, overrides, defaultLandingPathByRole } = input;
  const catalog = getAppUserRouteCatalog();
  const preferred =
    defaultLandingPathByRole?.[role] ?? catalog.suggestedDefaultLandingPathByRole[role];
  if (preferred && isPathVisibleForRole(preferred, role, overrides)) {
    return normalizePathname(preferred);
  }
  const visiblePrefixes = listVisiblePrefixPathsForRole(role, overrides);
  if (visiblePrefixes.length > 0) {
    return visiblePrefixes[0]!;
  }
  return "/xchat";
}

export async function getTenantRoutePolicyForSession(session: SessionUser): Promise<{
  role: PlatformRoleForRoutes;
  routeOverrides: AppUserRouteVisibilityOverrides;
  defaultLandingPathByRole: TenantDefaultLandingPathByRole;
}> {
  const role = resolvePlatformRoleForRoutes(session);
  const tenant = session.tenantId?.trim() ? await getTenantByHexId(session.tenantId.trim()) : null;
  const routeOverrides = parseRouteVisibilityOverrides(
    tenant?.tenantPreferences?.app_user_route_visibility_overrides
  );
  const defaultLandingPathByRole = parseDefaultLandingPathByRole(
    tenant?.tenantPreferences?.app_user_default_landing_path_by_role
  );
  return { role, routeOverrides, defaultLandingPathByRole };
}
