import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { effectiveWorkspaceLimitsForTenantAndPlan } from "@/lib/tenant-workspace-limits";
import { getCoreUserById } from "@/modules/identity/repository";
import { peekXchatAskUsageCounts } from "@/modules/xchat/ask-usage-limits";
import { mergeXchatPromptLimitsForWorkspace } from "@/modules/xchat/plan-limits";
import { getXchatLimitMetricsSnapshot } from "@/modules/xchat/xchat-limit-observability";

export const dynamic = "force-dynamic";

/**
 * Operator/debug: live UTC buckets + effective workspace caps + in-process limiter metrics (this instance).
 * Query **userId** (required) and optional **tenantId** (defaults to session tenant).
 */
export async function GET(request: Request) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() ?? "";
  const tenantId = url.searchParams.get("tenantId")?.trim() || session.tenantId.trim();

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: "Query userId is required (24-character hex Mongo user id)." },
      { status: 400 }
    );
  }
  if (!ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: "Invalid tenantId (expected 24-character hex)." }, { status: 400 });
  }

  try {
    const tenant = await getTenantByHexIdCached(tenantId);
    const coreUser = await getCoreUserById(new ObjectId(userId));
    const subscriptionPlan = coreUser?.subscriptionPlan;
    const workspaceLimits = await effectiveWorkspaceLimitsForTenantAndPlan(tenant, subscriptionPlan);
    const merged = mergeXchatPromptLimitsForWorkspace(subscriptionPlan, workspaceLimits);
    const counts = await peekXchatAskUsageCounts({
      userId,
      tenantId,
      now: new Date()
    });

    return NextResponse.json({
      data: {
        userId,
        tenantId,
        subscriptionPlan: subscriptionPlan ?? null,
        counts,
        workspaceLimits,
        mergedPromptCaps: merged,
        limitMetrics: getXchatLimitMetricsSnapshot()
      }
    });
  } catch (error) {
    console.error("[admin/xchat/usage] lookup failed", {
      tenantId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "Failed to load usage snapshot" }, { status: 500 });
  }
}
