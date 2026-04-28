import { ObjectId } from "mongodb";

import { atxBillingPlanIdForSubscriptionPlan } from "@/lib/atx-billing-plan-tier-map";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    getCoreUserById,
    resolvedWorkspaceLimitsForTenant,
    resolveTenantIdHexForGlobalAdminConsole
} from "@/modules/identity/repository";
import {
    applyTenantPlanRowToBase,
    mergeTenantWorkspaceLimits,
    normalizePlanOverridesFromUnknown,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type { SubscriptionPlan, Tenant } from "@/modules/identity/types";

export type { TenantWorkspaceLimits };

/** Tenant-wide `workspaceLimits` row only (ignores `planOverrides`) for an already resolved source tenant. */
export function tenantBaseWorkspaceLimits(tenant: Tenant | null): TenantWorkspaceLimits {
  return mergeTenantWorkspaceLimits(tenant?.workspaceLimits ?? null);
}

function tenantWorkspaceLimitsOverrideEnabled(tenant: Tenant | null): boolean {
  if (!tenant) {
    return false;
  }
  if (tenant.isDefault) {
    return true;
  }
  return tenant.tenantPreferences?.workspace_limits_override_enabled === true;
}

/** Runtime source tenant for limits and billing overrides (tenant row if allowed, else `atxfinance-core`). */
async function resolveWorkspaceLimitsSourceTenant(tenant: Tenant | null): Promise<Tenant | null> {
  if (tenantWorkspaceLimitsOverrideEnabled(tenant)) {
    return tenant;
  }
  // Unit-test convenience: synthetic tenant stubs without `_id` should resolve locally.
  if (tenant && !tenant._id) {
    return tenant;
  }
  const fallbackTenantId = await resolveTenantIdHexForGlobalAdminConsole(undefined);
  if (!fallbackTenantId) {
    return tenant;
  }
  const fallbackTenant = await getTenantByHexIdCached(fallbackTenantId);
  if (!fallbackTenant?._id) {
    return tenant;
  }
  return fallbackTenant;
}

export async function resolveWorkspaceLimitsRuntimeTenant(tenant: Tenant | null): Promise<Tenant | null> {
  return await resolveWorkspaceLimitsSourceTenant(tenant);
}

export async function resolveEffectivePlanOverridesForTenant(
  tenant: Tenant | null
): Promise<ReturnType<typeof normalizePlanOverridesFromUnknown>> {
  const sourceTenant = await resolveWorkspaceLimitsSourceTenant(tenant);
  return normalizePlanOverridesFromUnknown(sourceTenant?.workspaceLimits?.planOverrides);
}

/** Same resolution as {@link getEffectiveWorkspaceLimitsForUser} without extra DB reads when tenant + plan are known. */
export async function effectiveWorkspaceLimitsForTenantAndPlan(
  tenant: Tenant | null,
  subscriptionPlan: SubscriptionPlan | undefined
): Promise<TenantWorkspaceLimits> {
  const sourceTenant = await resolveWorkspaceLimitsSourceTenant(tenant);
  const base = tenantBaseWorkspaceLimits(sourceTenant);
  const planOverrides = normalizePlanOverridesFromUnknown(sourceTenant?.workspaceLimits?.planOverrides);
  const tier = atxBillingPlanIdForSubscriptionPlan(subscriptionPlan);
  return applyTenantPlanRowToBase(base, planOverrides, tier);
}

export async function getResolvedWorkspaceLimitsForTenantId(
  tenantIdHex: string
): Promise<TenantWorkspaceLimits> {
  const tenant = await getTenantByHexIdCached(tenantIdHex);
  return resolvedWorkspaceLimitsForTenant(tenant);
}

/**
 * Effective limits for a user after applying tenant defaults and optional
 * `workspaceLimits.planOverrides` row for their subscription tier
 * ({@link atxBillingPlanIdForSubscriptionPlan}).
 */
export async function getEffectiveWorkspaceLimitsForUser(input: {
  tenantId: string;
  userId: string;
}): Promise<TenantWorkspaceLimits> {
  const tenant = await getTenantByHexIdCached(input.tenantId);
  let subscriptionPlan: SubscriptionPlan | undefined;
  if (ObjectId.isValid(input.userId)) {
    const u = await getCoreUserById(new ObjectId(input.userId));
    subscriptionPlan = u?.subscriptionPlan;
  }
  return await effectiveWorkspaceLimitsForTenantAndPlan(tenant, subscriptionPlan);
}
