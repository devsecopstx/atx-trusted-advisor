import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
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

/** Next-local only — no Spring `/api/app-user/xoptions/entitlements`; do not BFF-proxy (would 404 on JVM). */
export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const payload: XoptionsEntitlementsPayload = await resolveXoptionsEntitlements(session);
  return NextResponse.json({ data: payload });
}
