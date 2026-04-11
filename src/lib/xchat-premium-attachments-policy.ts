import type { SubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";

/** Premium+ tenant attachment folder in xAI; global_admin can access for support. */
export function canAccessPremiumTenantAttachments(
  subscriptionPlan: SubscriptionPlan,
  roles: string[]
): boolean {
  return isGlobalAdmin(roles) || subscriptionPlan === "premium_plus";
}
