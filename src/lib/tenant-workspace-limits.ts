import { ObjectId } from "mongodb";

import { atxBillingPlanIdForSubscriptionPlan } from "@/lib/atx-billing-plan-tier-map";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { getCoreUserById, resolvedWorkspaceLimitsForTenant } from "@/modules/identity/repository";
import {
    applyTenantPlanRowToBase,
    mergeTenantWorkspaceLimits,
    normalizePlanOverridesFromUnknown,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type { SubscriptionPlan, Tenant } from "@/modules/identity/types";

export type { TenantWorkspaceLimits };

/**
 * Tenant-wide `workspaceLimits` row only (ignores `planOverrides`).
 * **xChat ask** daily/hourly caps use this so Admin “tenant row” matches `POST /api/xchat/ask` for every app user on the tenant.
 */
export function tenantBaseWorkspaceLimits(tenant: Tenant | null): TenantWorkspaceLimits {
  return mergeTenantWorkspaceLimits(tenant?.workspaceLimits ?? null);
}

/** Same resolution as {@link getEffectiveWorkspaceLimitsForUser} without extra DB reads when tenant + plan are known. */
export function effectiveWorkspaceLimitsForTenantAndPlan(
  tenant: Tenant | null,
  subscriptionPlan: SubscriptionPlan | undefined
): TenantWorkspaceLimits {
  const base = tenantBaseWorkspaceLimits(tenant);
  const planOverrides = normalizePlanOverridesFromUnknown(tenant?.workspaceLimits?.planOverrides);
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
  return effectiveWorkspaceLimitsForTenantAndPlan(tenant, subscriptionPlan);
}
