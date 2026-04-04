import { NextResponse } from "next/server";

import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";

type RouteContext = { params: Promise<{ jobId: string }> };
const STRATEGY_JOB_READ_POLICY = getBffRouteRateLimitPolicy("strategy_jobs_read");

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:read:${jobId}:${extractClientRateLimitKey(request)}`,
    windowMs: STRATEGY_JOB_READ_POLICY.windowMs,
    max: STRATEGY_JOB_READ_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Strategy job read rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyRequestToBackend(request);
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
