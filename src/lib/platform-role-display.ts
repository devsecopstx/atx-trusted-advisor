import { normalizeCoreRoles } from "@/modules/identity/authorization";

const PLATFORM_ROLE_PRECEDENCE = ["global_admin", "advisor", "operator", "viewer"] as const;

/** Highest platform role for user-facing shell labels (session `roles`). */
export function resolvePrimaryPlatformRoleForDisplay(roles: string[] | undefined): string | null {
  const normalized = normalizeCoreRoles(roles);
  for (const role of PLATFORM_ROLE_PRECEDENCE) {
    if (normalized.includes(role)) {
      return role;
    }
  }
  return null;
}

export function formatTenantNameWithPlatformRole(
  tenantName: string,
  platformRole: string | null | undefined
): string {
  const trimmed = tenantName.trim();
  if (!trimmed) {
    return trimmed;
  }
  const role = platformRole?.trim();
  if (!role) {
    return trimmed;
  }
  return `${trimmed} (${role})`;
}
