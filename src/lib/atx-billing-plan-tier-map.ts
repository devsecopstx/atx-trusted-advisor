import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import type { SubscriptionPlan } from "@/modules/identity/types";

/**
 * Maps core user {@link SubscriptionPlan} to retail billing tier keys used in
 * `core_tenants.workspaceLimits.planOverrides`. Stripe/webhook may later align these explicitly.
 */
export function atxBillingPlanIdForSubscriptionPlan(plan?: SubscriptionPlan): AtxBillingPlanId {
  const p = normalizeSubscriptionPlan(plan);
  if (p === "premium_plus") {
    return "premium_plus_monthly";
  }
  if (p === "premium") {
    return "premium_monthly";
  }
  return "basic";
}
