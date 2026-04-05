import { ObjectId } from "mongodb";

import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

type XoptionsEntitlementSession = {
  userId: string;
  roles: string[];
};

export type XoptionsEntitlements = {
  subscriptionPlan: SubscriptionPlan;
  /** Premium workspace: chart + option statistics tabs (global_admin always true). */
  fullChainAnalytics: boolean;
  /** Hardcore strategy jobs are Premium+ only. */
  hardcoreStrategyJobs: boolean;
};

export async function resolveXoptionsEntitlements(
  session: XoptionsEntitlementSession
): Promise<XoptionsEntitlements> {
  let subscriptionPlan: SubscriptionPlan = "basic";
  if (ObjectId.isValid(session.userId)) {
    const user = await getCoreUserById(new ObjectId(session.userId));
    subscriptionPlan = normalizeSubscriptionPlan(user?.subscriptionPlan);
  }

  const fullChainAnalytics =
    isGlobalAdmin(session.roles) || subscriptionPlan === "premium" || subscriptionPlan === "premium_plus";
  const hardcoreStrategyJobs = subscriptionPlan === "premium_plus";

  return {
    subscriptionPlan,
    fullChainAnalytics,
    hardcoreStrategyJobs
  };
}
