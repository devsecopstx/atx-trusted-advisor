import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";

export type SubscriberLandingPath = string;

export function subscriberLandingPathForPlan(planRaw: unknown): SubscriberLandingPath {
  const plan = normalizeSubscriptionPlan(planRaw);
  return plan === "basic" ? "/xchat" : "/portfolios";
}

export async function resolveSessionLandingPath(session: SessionUser): Promise<string> {
  if (isGlobalAdmin(session.roles)) {
    return "/admin";
  }
  const tenantRoutePolicy = await getTenantRoutePolicyForSession(session);
  if (tenantRoutePolicy?.effectiveRolePolicy?.defaultLanding) {
    return tenantRoutePolicy.effectiveRolePolicy.defaultLanding;
  }
  if (!ObjectId.isValid(session.userId)) {
    return "/xchat";
  }
  const user = await getCoreUserById(new ObjectId(session.userId));
  return subscriberLandingPathForPlan(user?.subscriptionPlan);
}
