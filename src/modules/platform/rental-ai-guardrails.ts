import { ObjectId } from "mongodb";

import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import {
    releaseRentalAiInflight,
    tryAcquireRentalAiInflight
} from "@/modules/platform/rental-ai-concurrency";
import { getRentalAiTokensUsedToday } from "@/modules/platform/rental-ai-token-meter";
import type { TenantRentalApiKeyScope } from "@/modules/platform/tenant-rental-types";

const MAX_CONCURRENT_PER_TENANT = 8;
/** Conservative pre-flight reservation before xAI calls (stub routes use a small estimate). */
const DEFAULT_ESTIMATED_TOKENS_PER_REQUEST = 4_096;

export type RentalAiGuardFailure = {
  response: Response;
};

export async function enforceRentalAiRateLimit(
  request: Request,
  tenantIdHex: string,
  scope: TenantRentalApiKeyScope
): Promise<RentalAiGuardFailure | null> {
  const policy = getRouteRateLimitPolicy("strict");
  const limit = await checkDistributedRateLimit({
    key: `rental_ai:${scope}:${tenantIdHex}:${extractClientRateLimitKey(request)}`,
    windowMs: policy.windowMs,
    max: policy.max
  });
  if (limit.allowed) {
    return null;
  }
  const headers = buildRateLimitHeaders(limit);
  headers.set("content-type", "application/json");
  return {
    response: new Response(
      JSON.stringify({
        error: "Too Many Requests",
        code: "rate_limited",
        retryAfterSeconds: limit.retryAfterSeconds
      }),
      { status: 429, headers }
    )
  };
}

export async function enforceRentalAiTokenBudget(input: {
  tenantIdHex: string;
  maxDailyTokens: number;
  estimatedTokens?: number;
}): Promise<RentalAiGuardFailure | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(input.tenantIdHex);
  } catch {
    return {
      response: new Response(
        JSON.stringify({ error: "Bad Request", code: "invalid_tenant", message: "Invalid tenant scope" }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    };
  }
  const used = await getRentalAiTokensUsedToday(oid);
  const est = input.estimatedTokens ?? DEFAULT_ESTIMATED_TOKENS_PER_REQUEST;
  if (used + est > input.maxDailyTokens) {
    return {
      response: new Response(
        JSON.stringify({
          error: "Payment Required",
          code: "token_budget_exceeded",
          message: "Daily token budget exhausted for rental tier"
        }),
        {
          status: 402,
          headers: { "content-type": "application/json" }
        }
      )
    };
  }
  return null;
}

export function tryAcquireRentalAiConcurrencyOr429(tenantIdHex: string): RentalAiGuardFailure | null {
  if (tryAcquireRentalAiInflight(tenantIdHex, MAX_CONCURRENT_PER_TENANT)) {
    return null;
  }
  return {
    response: new Response(
      JSON.stringify({
        error: "Too Many Requests",
        code: "concurrency_limited",
        message: "Tenant rental concurrency limit reached"
      }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "2" }
      }
    )
  };
}

export function releaseRentalAiConcurrencySafe(tenantIdHex: string): void {
  releaseRentalAiInflight(tenantIdHex);
}
