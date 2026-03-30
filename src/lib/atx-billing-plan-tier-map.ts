import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";
import type { SubscriptionPlan } from "@/modules/identity/types";

/**
 * Maps core user {@link SubscriptionPlan} to retail billing tier keys used in
 * `core_tenants.workspaceLimits.planOverrides`. Stripe/webhook may later align these explicitly.
 */
export function atxBillingPlanIdForSubscriptionPlan(plan?: SubscriptionPlan): AtxBillingPlanId {
  if (plan === "enterprise") {
    return "premium_plus_monthly";
  }
  if (plan === "pro") {
    return "premium_monthly";
  }
  return "basic";
}
