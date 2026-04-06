import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

type RouteContext = { params: Promise<{ jobId: string }> };
const STRATEGY_JOB_ARTIFACT_POLICY = getBffRouteRateLimitPolicy("strategy_jobs_artifact");

export async function GET(request: Request, context: RouteContext) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const entitlements = await resolveXoptionsEntitlements(session);
  if (!entitlements.hardcoreStrategyJobs) {
    return NextResponse.json(
      {
        error: "plan_upgrade_required",
        message: "Hardcore strategy jobs are available on Premium+."
      },
      { status: 403 }
    );
  }
  const { jobId } = await context.params;
  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:artifact:${session.tenantId}:${session.userId}:${jobId}:${extractClientRateLimitKey(request)}`,
    windowMs: STRATEGY_JOB_ARTIFACT_POLICY.windowMs,
    max: STRATEGY_JOB_ARTIFACT_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Strategy artifact rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return NextResponse.json(
    {
      error: "service_unavailable",
      message: "Strategy orchestrator requires ATXFINANCE_BACKEND_ORIGIN (Spring BFF)."
    },
    { status: 503 }
  );
}
