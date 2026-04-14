import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRedisClient } from "@/lib/redis-client";

type DistributedRateLimitInput = {
  key: string;
  windowMs: number;
  max: number;
};

export type RouteRateLimitClass = "strict" | "standard" | "light";

type RouteRateLimitPolicy = {
  windowMs: number;
  max: number;
};

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
  source: "redis" | "memory";
};

const ROUTE_RATE_LIMIT_POLICIES: Record<RouteRateLimitClass, RouteRateLimitPolicy> = {
  strict: {
    windowMs: 60_000,
    max: 6
  },
  standard: {
    windowMs: 60_000,
    max: 20
  },
  light: {
    windowMs: 60_000,
    max: 60
  }
};

export type BffRouteRateLimitPolicyKey =
  | "strategy_jobs_list"
  | "strategy_jobs_create"
  | "strategy_jobs_read"
  | "strategy_jobs_artifact"
  | "strategy_jobs_turns"
  | "access_requests_public_create"
  | "recommendations_list"
  | "recommendations_create"
  | "recommendations_read"
  | "positions_list"
  | "positions_create"
  | "positions_delete"
  | "admin_audit_list"
  | "admin_login_audit_list"
  | "auth_email_login"
  | "auth_email_forgot"
  | "auth_email_complete_invite"
  | "auth_email_reset";

const BFF_ROUTE_POLICY_CLASS_MAP: Record<BffRouteRateLimitPolicyKey, RouteRateLimitClass> = {
  strategy_jobs_list: "standard",
  strategy_jobs_create: "strict",
  strategy_jobs_read: "standard",
  strategy_jobs_artifact: "standard",
  strategy_jobs_turns: "strict",
  access_requests_public_create: "strict",
  recommendations_list: "standard",
  recommendations_create: "strict",
  recommendations_read: "standard",
  positions_list: "standard",
  positions_create: "strict",
  positions_delete: "strict",
  admin_audit_list: "strict",
  admin_login_audit_list: "strict",
  auth_email_login: "strict",
  auth_email_forgot: "strict",
  auth_email_complete_invite: "strict",
  auth_email_reset: "strict"
};

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function buildResult(input: {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  source: "redis" | "memory";
}): DistributedRateLimitResult {
  return {
    allowed: input.allowed,
    remaining: Math.max(0, Math.floor(input.remaining)),
    resetAtMs: Math.max(Date.now(), Math.floor(input.resetAtMs)),
    retryAfterSeconds: Math.max(1, Math.ceil((input.resetAtMs - Date.now()) / 1000)),
    source: input.source
  };
}

export async function checkDistributedRateLimit(
  input: DistributedRateLimitInput
): Promise<DistributedRateLimitResult> {
  const windowMs = clampPositiveInt(input.windowMs, 60_000);
  const max = clampPositiveInt(input.max, 10);
  const baseKey = input.key.trim();
  if (!baseKey) {
    throw new Error("Distributed rate-limit key must be non-empty");
  }
  const key = `ratelimit:${baseKey}`;

  try {
    const redis = await getRedisClient();
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pExpire(key, windowMs);
      }
      let ttlMs = await redis.pTTL(key);
      if (ttlMs <= 0) {
        await redis.pExpire(key, windowMs);
        ttlMs = windowMs;
      }
      const resetAtMs = Date.now() + ttlMs;
      return buildResult({
        allowed: count <= max,
        remaining: Math.max(0, max - count),
        resetAtMs,
        source: "redis"
      });
    }
  } catch (error) {
    console.warn(
      "[rate-limit] redis check failed, falling back to memory",
      error instanceof Error ? error.message : String(error)
    );
  }

  const fallback = checkRateLimit({
    key,
    windowMs,
    max
  });
  return buildResult({
    allowed: fallback.allowed,
    remaining: fallback.remaining,
    resetAtMs: fallback.resetAtMs,
    source: "memory"
  });
}

export function getRouteRateLimitPolicy(policyClass: RouteRateLimitClass): RouteRateLimitPolicy {
  return ROUTE_RATE_LIMIT_POLICIES[policyClass];
}

export function getBffRouteRateLimitPolicy(
  routeKey: BffRouteRateLimitPolicyKey
): RouteRateLimitPolicy {
  return getRouteRateLimitPolicy(BFF_ROUTE_POLICY_CLASS_MAP[routeKey]);
}

export function buildRateLimitHeaders(result: DistributedRateLimitResult): Headers {
  const headers = new Headers();
  headers.set("retry-after", String(result.retryAfterSeconds));
  headers.set("x-atx-ratelimit-remaining", String(Math.max(0, result.remaining)));
  headers.set("x-atx-ratelimit-reset", String(Math.max(0, Math.floor(result.resetAtMs / 1000))));
  headers.set("x-atx-ratelimit-source", result.source);
  return headers;
}

export function extractClientRateLimitKey(request: Request): string {
  const meta = extractClientLoginMeta(request);
  return meta.clientIp ?? "client:unknown";
}
