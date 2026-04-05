import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

export type SubscriberLandingPath = "/xchat" | "/portfolios";

export function subscriberLandingPathForPlan(planRaw: unknown): SubscriberLandingPath {
  const plan = normalizeSubscriptionPlan(planRaw);
  return plan === "basic" ? "/xchat" : "/portfolios";
}

export async function resolveSessionLandingPath(session: SessionUser): Promise<"/admin" | SubscriberLandingPath> {
  if (isGlobalAdmin(session.roles)) {
    return "/admin";
  }
  if (!ObjectId.isValid(session.userId)) {
    return "/xchat";
  }
  const user = await getCoreUserById(new ObjectId(session.userId));
  return subscriberLandingPathForPlan(user?.subscriptionPlan);
}
