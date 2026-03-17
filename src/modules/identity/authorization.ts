import type { CoreUserRole } from "@/modules/identity/types";

export const loginAllowedRoles = [
  "global_admin",
  "advisor",
  "operator",
  "viewer"
] as const satisfies readonly CoreUserRole[];

export function isRoleLoginAllowed(role: string): role is CoreUserRole {
  return loginAllowedRoles.includes(role as (typeof loginAllowedRoles)[number]);
}

export function canUserLogin(roles: string[]): boolean {
  return roles.some((role) => isRoleLoginAllowed(role));
}

export function isGlobalAdmin(roles: string[]): boolean {
  return roles.includes("global_admin");
}
