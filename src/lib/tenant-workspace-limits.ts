import {
  getTenantByHexId,
  resolvedWorkspaceLimitsForTenant
} from "@/modules/identity/repository";
import type { TenantWorkspaceLimits } from "@/modules/identity/tenant-workspace-limits";

export type { TenantWorkspaceLimits };

export async function getResolvedWorkspaceLimitsForTenantId(
  tenantIdHex: string
): Promise<TenantWorkspaceLimits> {
  const tenant = await getTenantByHexId(tenantIdHex.trim());
  return resolvedWorkspaceLimitsForTenant(tenant);
}
