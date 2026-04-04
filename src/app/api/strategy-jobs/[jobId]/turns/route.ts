import { NextResponse } from "next/server";

import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey
} from "@/lib/distributed-rate-limit";

type RouteContext = { params: Promise<{ jobId: string }> };

const STRATEGY_JOB_TURNS_WINDOW_MS = 60_000;
const STRATEGY_JOB_TURNS_MAX = 24;

export async function POST(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:turns:${jobId}:${extractClientRateLimitKey(request)}`,
    windowMs: STRATEGY_JOB_TURNS_WINDOW_MS,
    max: STRATEGY_JOB_TURNS_MAX
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Strategy turn rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(limit)
      }
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
