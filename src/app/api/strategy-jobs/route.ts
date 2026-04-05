import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { canCreateStrategyJobFromApp } from "@/modules/identity/authorization";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

const STRATEGY_JOBS_LIST_POLICY = getBffRouteRateLimitPolicy("strategy_jobs_list");
const STRATEGY_JOB_CREATE_POLICY = getBffRouteRateLimitPolicy("strategy_jobs_create");

export async function GET(request: Request) {
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

  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:list:${session.tenantId}:${session.userId}:${extractClientRateLimitKey(request)}`,
    windowMs: STRATEGY_JOBS_LIST_POLICY.windowMs,
    max: STRATEGY_JOBS_LIST_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Strategy jobs list rate limit exceeded. Please retry shortly.",
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

export async function POST(request: Request) {
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
  if (!canCreateStrategyJobFromApp(session.roles)) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Strategy job creation is limited to global_admin, advisor, or operator roles."
      },
      { status: 403 }
    );
  }
  const limit = await checkDistributedRateLimit({
    key: `strategy-jobs:create:${session.tenantId}:${session.userId}`,
    windowMs: STRATEGY_JOB_CREATE_POLICY.windowMs,
    max: STRATEGY_JOB_CREATE_POLICY.max
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
