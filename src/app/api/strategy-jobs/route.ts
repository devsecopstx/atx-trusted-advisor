import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { buildRateLimitHeaders, checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { canCreateStrategyJobFromApp } from "@/modules/identity/authorization";

const STRATEGY_JOB_CREATE_WINDOW_MS = 60_000;
const STRATEGY_JOB_CREATE_MAX = 10;

export async function GET(request: Request) {
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

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canCreateStrategyJobFromApp(session.roles)) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Strategy job creation is limited to advisor/operator roles."
      },
      { status: 403 }
    );
  }
  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:create:${session.tenantId}:${session.userId}`,
    windowMs: STRATEGY_JOB_CREATE_WINDOW_MS,
    max: STRATEGY_JOB_CREATE_MAX
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Strategy job create rate limit exceeded. Please retry shortly.",
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
