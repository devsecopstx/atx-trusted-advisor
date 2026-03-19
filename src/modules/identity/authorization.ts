import type { CoreUserRole } from "@/modules/identity/types";

const LEGACY_ADMIN_ROLE = "admin";
const GLOBAL_ADMIN_ROLE: CoreUserRole = "global_admin";

export const loginAllowedRoles = [
  "global_admin",
  "advisor",
  "operator",
  "viewer"
] as const satisfies readonly CoreUserRole[];

function normalizeRole(role: string): string {
  return role === LEGACY_ADMIN_ROLE ? GLOBAL_ADMIN_ROLE : role;
}

export function isRoleLoginAllowed(role: string): role is CoreUserRole {
  const normalizedRole = normalizeRole(role);
  return loginAllowedRoles.includes(normalizedRole as (typeof loginAllowedRoles)[number]);
}

export function canUserLogin(roles: string[]): boolean {
  return roles.some((role) => isRoleLoginAllowed(role));
}

export function isGlobalAdmin(roles: string[]): boolean {
  return roles.some((role) => normalizeRole(role) === GLOBAL_ADMIN_ROLE);
}
