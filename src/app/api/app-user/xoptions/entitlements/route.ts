import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import type { SubscriptionPlan } from "@/lib/subscription-plan";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

export const dynamic = "force-dynamic";

export type XoptionsEntitlementsPayload = {
  subscriptionPlan: SubscriptionPlan;
  /** Premium+ workspace: chart + option statistics tabs (global_admin always true). */
  fullChainAnalytics: boolean;
  /** Hardcore strategy jobs are Premium+ only. */
  hardcoreStrategyJobs: boolean;
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

  const payload: XoptionsEntitlementsPayload = await resolveXoptionsEntitlements(session);
  return NextResponse.json({ data: payload });
}
