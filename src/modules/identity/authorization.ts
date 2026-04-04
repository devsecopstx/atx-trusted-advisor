import type { CoreUserRole } from "@/modules/identity/types";

/** Legacy session/DB value; normalized to {@link GLOBAL_ADMIN_ROLE} everywhere. */
export const LEGACY_ADMIN_ROLE = "admin" as const;
export const GLOBAL_ADMIN_ROLE: CoreUserRole = "global_admin";

/**
 * Single source of truth for platform role string normalization (e.g. legacy `admin` → `global_admin`).
 * Use for one role; use {@link normalizeCoreRoles} for session payloads.
 */
export function normalizeCoreRole(role: string): string {
  return role === LEGACY_ADMIN_ROLE ? GLOBAL_ADMIN_ROLE : role;
}

/** Deduped platform roles after legacy normalization (session signing / reads). */
export function normalizeCoreRoles(roles: string[] | undefined): string[] {
  if (!roles || roles.length === 0) {
    return [];
  }
  return Array.from(new Set(roles.map((role) => normalizeCoreRole(role))));
}

export const loginAllowedRoles = [
  "global_admin",
  "advisor",
  "operator",
  "viewer"
] as const satisfies readonly CoreUserRole[];

/** App_user roles: any login-eligible role except global admin (product / routing). */
export const appUserRoles = ["advisor", "operator", "viewer"] as const satisfies readonly CoreUserRole[];

export function isRoleLoginAllowed(role: string): role is CoreUserRole {
  const normalizedRole = normalizeCoreRole(role);
  return loginAllowedRoles.includes(normalizedRole as (typeof loginAllowedRoles)[number]);
}

export function canUserLogin(roles: string[]): boolean {
  return roles.some((role) => isRoleLoginAllowed(role));
}

/** Admin console / elevated API: platform role `global_admin` only (legacy `admin` counts). */
export function isGlobalAdmin(roles: string[]): boolean {
  return roles.some((role) => normalizeCoreRole(role) === GLOBAL_ADMIN_ROLE);
}

export function isAppUser(roles: string[]): boolean {
  return canUserLogin(roles) && !isGlobalAdmin(roles);
}

/** Strategy-job creation is advisor/operator only (viewer excluded; global_admin is not app-user strategy trigger). */
export function canCreateStrategyJobFromApp(roles: string[]): boolean {
  return roles.some((role) => {
    const normalized = normalizeCoreRole(role);
    return normalized === "advisor" || normalized === "operator";
  });
}
