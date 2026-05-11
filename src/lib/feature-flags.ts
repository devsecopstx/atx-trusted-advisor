import type { TenantWorkspaceLimits } from "@/modules/identity/tenant-workspace-limits";

/**
 * Investment outlook auto-refresh (xAI / scheduler) — env gate AND tenant workspace limit.
 * Never hardcode; read via this helper at runtime.
 */
export function getInvestmentOutlookRefreshEnabled(input: {
  envEnabled: boolean;
  tenantLimits: TenantWorkspaceLimits;
}): boolean {
  if (!input.envEnabled) {
    return false;
  }
  return input.tenantLimits.outlookRefreshEnabled !== false;
}
