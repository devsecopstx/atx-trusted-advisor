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
export type TenantRoleFlags = {
  canMutatePortfolios: boolean;
  canUseXChat: boolean;
  canRunTasks: boolean;
};

export type TenantRolePolicy = {
  allowedRoutes: string[];
  defaultLanding: string;
  flags: TenantRoleFlags;
};

export type TenantRolesByRole = Partial<Record<PlatformRoleForRoutes, TenantRolePolicy>>;

const ROLE_ORDER: readonly PlatformRoleForRoutes[] = ["global_admin", "advisor", "operator", "viewer"] as const;
const DEFAULT_FLAGS_BY_ROLE: Readonly<Record<PlatformRoleForRoutes, TenantRoleFlags>> = {
  global_admin: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true },
  operator: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true },
  advisor: { canMutatePortfolios: false, canUseXChat: true, canRunTasks: false },
  viewer: { canMutatePortfolios: false, canUseXChat: false, canRunTasks: false }
};

const DEFAULT_ALLOWED_ROUTES_BY_ROLE: Readonly<Record<PlatformRoleForRoutes, readonly string[]>> = {
  global_admin: ["/admin"],
  operator: ["/xchat", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/import-activity", "/workspace"],
  advisor: ["/xchat", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/import-activity", "/workspace"],
  viewer: ["/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account"]
};

const DEFAULT_LANDING_BY_ROLE: Readonly<Record<PlatformRoleForRoutes, string>> = {
  global_admin: "/admin",
  advisor: "/xchat",
  operator: "/portfolios",
  viewer: "/portfolios"
};

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

function listKnownRoutePrefixes(): Set<string> {
  const out = new Set<string>(["/admin"]);
  for (const entry of getAppUserRouteCatalog().entries) {
    out.add(normalizePathname(entry.pathPattern));
  }
  return out;
}

function isAllowedPrefixPath(pathname: string): boolean {
  return listKnownRoutePrefixes().has(normalizePathname(pathname));
}

function routeAllowedByPrefixes(pathname: string, allowedRoutes: readonly string[]): boolean {
  const normalized = normalizePathname(pathname);
  return allowedRoutes.some((route) => {
    const p = normalizePathname(route);
    return normalized === p || normalized.startsWith(`${p}/`);
  });
}

function resolveDefaultAllowedRoutesForRole(role: PlatformRoleForRoutes): string[] {
  if (role === "global_admin") {
    const all = new Set<string>(["/admin"]);
    for (const entry of getAppUserRouteCatalog().entries) {
      if (entry.pathPattern.startsWith("/")) {
        all.add(normalizePathname(entry.pathPattern));
      }
    }
    return [...all].sort();
  }
  return [...DEFAULT_ALLOWED_ROUTES_BY_ROLE[role]].sort();
}

function parseTenantRoleFlags(raw: unknown, role: PlatformRoleForRoutes): TenantRoleFlags {
  const defaults = DEFAULT_FLAGS_BY_ROLE[role];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }
  const input = raw as Record<string, unknown>;
  const merged: TenantRoleFlags = {
    canMutatePortfolios:
      typeof input.canMutatePortfolios === "boolean" ? input.canMutatePortfolios : defaults.canMutatePortfolios,
    canUseXChat: typeof input.canUseXChat === "boolean" ? input.canUseXChat : defaults.canUseXChat,
    canRunTasks: typeof input.canRunTasks === "boolean" ? input.canRunTasks : defaults.canRunTasks
  };
  if (role === "viewer") {
    return {
      canMutatePortfolios: false,
      canUseXChat: false,
      canRunTasks: false
    };
  }
  return merged;
}

function parseTenantAllowedRoutes(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) {
    return fallback;
  }
  const known = listKnownRoutePrefixes();
  const out = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = normalizePathname(value.trim());
    if (known.has(normalized)) {
      out.add(normalized);
    }
  }
  return out.size > 0 ? [...out].sort() : fallback;
}

export function parseTenantRolesByRole(raw: unknown): TenantRolesByRole {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const input = raw as Record<string, unknown>;
  const out: TenantRolesByRole = {};
  for (const role of ROLE_ORDER) {
    const policyRaw = input[role];
    if (!policyRaw || typeof policyRaw !== "object" || Array.isArray(policyRaw)) {
      continue;
    }
    const policy = policyRaw as Record<string, unknown>;
    const fallbackAllowed = resolveDefaultAllowedRoutesForRole(role);
    const allowedRoutes = validateAllowedRoutesForRole(
      parseTenantAllowedRoutes(policy.allowedRoutes, fallbackAllowed),
      role
    );
    const requestedLanding = typeof policy.defaultLanding === "string" ? policy.defaultLanding.trim() : "";
    const fallbackLanding = DEFAULT_LANDING_BY_ROLE[role];
    const normalizedLanding = requestedLanding ? normalizePathname(requestedLanding) : fallbackLanding;
    const defaultLanding = routeAllowedByPrefixes(normalizedLanding, allowedRoutes)
      ? normalizedLanding
      : fallbackLanding;
    out[role] = {
      allowedRoutes,
      defaultLanding,
      flags: parseTenantRoleFlags(policy.flags, role)
    };
  }
  return out;
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
  overrides?: AppUserRouteVisibilityOverrides | null,
  tenantRolePolicy?: TenantRolePolicy | null
): boolean {
  if (tenantRolePolicy) {
    return routeAllowedByPrefixes(pathname, tenantRolePolicy.allowedRoutes);
  }
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
  tenantRolePolicy?: TenantRolePolicy | null;
}): string {
  const { role, overrides, defaultLandingPathByRole, tenantRolePolicy } = input;
  if (tenantRolePolicy?.defaultLanding) {
    return normalizePathname(tenantRolePolicy.defaultLanding);
  }
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
  tenantRoles: TenantRolesByRole;
  effectiveRolePolicy: TenantRolePolicy;
}> {
  const role = resolvePlatformRoleForRoutes(session);
  const tenant = session.tenantId?.trim() ? await getTenantByHexId(session.tenantId.trim()) : null;
  const tenantRoles = parseTenantRolesByRole(
    (tenant as { tenantRoles?: unknown } | null | undefined)?.tenantRoles ??
      (tenant?.tenantPreferences as Record<string, unknown> | undefined)?.tenantRoles
  );
  const routeOverrides = parseRouteVisibilityOverrides(
    tenant?.tenantPreferences?.app_user_route_visibility_overrides
  );
  const defaultLandingPathByRole = parseDefaultLandingPathByRole(
    tenant?.tenantPreferences?.app_user_default_landing_path_by_role
  );

  const roleOverride = tenantRoles[role];
  if (roleOverride) {
    return {
      role,
      routeOverrides,
      defaultLandingPathByRole,
      tenantRoles,
      effectiveRolePolicy: roleOverride
    };
  }

  const defaultAllowedRoutes = resolveDefaultAllowedRoutesForRole(role);
  const allowedRoutes = defaultAllowedRoutes.filter((route) =>
    isPathVisibleForRole(route, role, routeOverrides)
  );
  const preferredLanding = defaultLandingPathByRole[role];
  const fallbackLanding = DEFAULT_LANDING_BY_ROLE[role];
  const defaultLandingCandidate = preferredLanding ?? fallbackLanding;
  const defaultLanding = routeAllowedByPrefixes(defaultLandingCandidate, allowedRoutes)
    ? normalizePathname(defaultLandingCandidate)
    : normalizePathname(allowedRoutes[0] ?? fallbackLanding);

  return {
    role,
    routeOverrides,
    defaultLandingPathByRole,
    tenantRoles,
    effectiveRolePolicy: {
      allowedRoutes: allowedRoutes.length > 0 ? allowedRoutes : defaultAllowedRoutes,
      defaultLanding,
      flags: DEFAULT_FLAGS_BY_ROLE[role]
    }
  };
}

export function isTenantRolePolicyPathAllowed(pathname: string, policy: TenantRolePolicy): boolean {
  return routeAllowedByPrefixes(pathname, policy.allowedRoutes);
}

export function validateAllowedRoutesForRole(allowedRoutes: string[], role: PlatformRoleForRoutes): string[] {
  const fallback = resolveDefaultAllowedRoutesForRole(role);
  const normalized = parseTenantAllowedRoutes(allowedRoutes, fallback);
  if (role === "viewer" && normalized.includes("/xchat")) {
    return normalized.filter((route) => route !== "/xchat");
  }
  return normalized;
}

export function validateDefaultLandingForRole(
  role: PlatformRoleForRoutes,
  allowedRoutes: readonly string[],
  defaultLanding: string
): string {
  const normalized = normalizePathname(defaultLanding);
  if (!isAllowedPrefixPath(normalized)) {
    return DEFAULT_LANDING_BY_ROLE[role];
  }
  if (!routeAllowedByPrefixes(normalized, [...allowedRoutes])) {
    return DEFAULT_LANDING_BY_ROLE[role];
  }
  return normalized;
}
