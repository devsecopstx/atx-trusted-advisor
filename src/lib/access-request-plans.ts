import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";
import {
    strictParseSubscriptionPlan,
    SUBSCRIPTION_PLAN_LABELS,
    SUBSCRIPTION_PLAN_SELECT_OPTIONS,
    type SubscriptionPlan
} from "@/lib/subscription-plan";

export type AccessRequestPlanValue = SubscriptionPlan;

export const ACCESS_REQUEST_PLAN_OPTIONS = SUBSCRIPTION_PLAN_SELECT_OPTIONS;

export function parseAccessRequestPlanInput(input: unknown): SubscriptionPlan | null {
  return strictParseSubscriptionPlan(input);
}

export function accessRequestPlanLabel(value: SubscriptionPlan): string {
  return SUBSCRIPTION_PLAN_LABELS[value];
}

export function accessRequestPlanFromBillingPlanId(planId: AtxBillingPlanId): SubscriptionPlan {
  if (planId === "premium_monthly") {
    return "premium";
  }
  if (planId === "premium_plus_monthly") {
    return "premium_plus";
  }
  return "basic";
}
