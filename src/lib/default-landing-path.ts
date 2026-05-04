import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";

export type SubscriberLandingPath = string;

/** Post-auth fallback when tenant route policy does not set `defaultLanding`. Always xChat for app roles. */
export function subscriberLandingPathForPlan(planRaw: unknown): SubscriberLandingPath {
  void planRaw;
  return "/xchat";
}

export async function resolveSessionLandingPath(session: SessionUser): Promise<string> {
  if (isGlobalAdmin(session.roles)) {
    return "/admin";
  }
  try {
    const tenantRoutePolicy = await getTenantRoutePolicyForSession(session);
    if (tenantRoutePolicy?.effectiveRolePolicy?.defaultLanding) {
      return tenantRoutePolicy.effectiveRolePolicy.defaultLanding;
    }
  } catch {
    // Preserve legacy fallback behavior when route policy dependencies are unavailable.
  }
  if (!ObjectId.isValid(session.userId)) {
    return "/xchat";
  }
  try {
    const user = await getCoreUserById(new ObjectId(session.userId));
    return subscriberLandingPathForPlan(user?.subscriptionPlan);
  } catch {
    return "/xchat";
  }
}
