import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

export type XoptionsEntitlementsPayload = {
  subscriptionPlan: SubscriptionPlan;
  /** Premium+ workspace: chart + option statistics tabs (global_admin always true). */
  fullChainAnalytics: boolean;
};

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let subscriptionPlan: SubscriptionPlan = "basic";
  if (ObjectId.isValid(session.userId)) {
    const user = await getCoreUserById(new ObjectId(session.userId));
    subscriptionPlan = normalizeSubscriptionPlan(user?.subscriptionPlan);
  }

  const fullChainAnalytics =
    isGlobalAdmin(session.roles) || subscriptionPlan === "premium" || subscriptionPlan === "premium_plus";

  const payload: XoptionsEntitlementsPayload = {
    subscriptionPlan,
    fullChainAnalytics
  };
  return NextResponse.json({ data: payload });
}
