import type { TenantWorkspaceLimits } from "@/modules/identity/tenant-workspace-limits";
import type { Tenant } from "@/modules/identity/types";

/**
 * Investment outlook auto-refresh — **`INVESTMENT_OUTLOOK_REFRESH_ENABLED`** (default on) with workspace limit
 * **`outlookRefreshEnabled`** opt-out when `false`.
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

/**
 * Read a boolean feature flag from `core_tenants.tenantPreferences.featureFlags`.
 * Returns `defaultValue` when the key is missing or not a boolean.
 *
 * Hot-path callers should pass a pre-loaded tenant document to avoid extra DB reads.
 */
export function isFeatureEnabled(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined,
  flagKey: string,
  defaultValue = false
): boolean {
  const raw = tenant?.tenantPreferences?.featureFlags?.[flagKey];
  if (typeof raw === "boolean") {
    return raw;
  }
  return defaultValue;
}

/**
 * Read any feature flag value (boolean | number | string).
 * Returns `defaultValue` when the key is absent.
 */
export function getFeatureFlag<T extends boolean | number | string>(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined,
  flagKey: string,
  defaultValue: T
): T {
  const raw = tenant?.tenantPreferences?.featureFlags?.[flagKey];
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw === typeof defaultValue) {
    return raw as T;
  }
  return defaultValue;
}
