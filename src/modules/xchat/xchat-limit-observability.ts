import type { SubscriptionPlan } from "@/modules/identity/types";
import type { UsageLimitResult } from "@/modules/xchat/ask-usage-limits";

/** Aligns with `xchat-harden.md` Phase 2 — log-based metrics in Cloud Logging + in-process counters for admin debug. */
export type XchatLimitDecision =
  | "allowed"
  | "minute_exceeded"
  | "hourly_exceeded"
  | "daily_exceeded"
  | "limiter_degraded_allow";

const LIMITER_CIRCUIT_THRESHOLD = 3;

let consecutiveLimiterFailures = 0;

export function resetLimiterFailureStreak(): void {
  consecutiveLimiterFailures = 0;
}

export function registerLimiterCheckFailure(): number {
  consecutiveLimiterFailures += 1;
  return consecutiveLimiterFailures;
}

export function limiterCircuitAllowDegraded(): boolean {
  return consecutiveLimiterFailures >= LIMITER_CIRCUIT_THRESHOLD;
}

export function getLimiterConsecutiveFailures(): number {
  return consecutiveLimiterFailures;
}

type LimitMetrics = {
  asksTotalByKey: Map<string, number>;
  exceededTotalByType: Map<string, number>;
  limitCheckDurationMs: { sum: number; count: number; max: number };
};

const metrics: LimitMetrics = {
  asksTotalByKey: new Map(),
  exceededTotalByType: new Map(),
  limitCheckDurationMs: { sum: 0, count: 0, max: 0 }
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function recordXchatLimitCheckDurationMs(latencyMs: number): void {
  const n = Math.max(0, Math.floor(latencyMs));
  const m = metrics.limitCheckDurationMs;
  m.sum += n;
  m.count += 1;
  m.max = Math.max(m.max, n);
}

export function recordXchatLimitDecisionMetric(input: {
  decision: XchatLimitDecision;
  tenantId: string;
  plan?: SubscriptionPlan | string;
}): void {
  const planKey =
    typeof input.plan === "string" && input.plan.trim() ? input.plan.trim() : "unknown";
  const tenantKey = input.tenantId.trim() || "unknown";
  bump(metrics.asksTotalByKey, `${input.decision}|${tenantKey}|${planKey}`);
  if (
    input.decision === "minute_exceeded" ||
    input.decision === "hourly_exceeded" ||
    input.decision === "daily_exceeded"
  ) {
    bump(metrics.exceededTotalByType, input.decision);
  }
}

export function getXchatLimitMetricsSnapshot(): {
  asksTotalByKey: Record<string, number>;
  exceededTotalByType: Record<string, number>;
  limitCheckDurationMs: { sum: number; count: number; max: number; avgMs: number };
  limiterCircuitThreshold: number;
  limiterConsecutiveFailures: number;
} {
  const d = metrics.limitCheckDurationMs;
  const avgMs = d.count > 0 ? Math.round(d.sum / d.count) : 0;
  return {
    asksTotalByKey: Object.fromEntries(metrics.asksTotalByKey),
    exceededTotalByType: Object.fromEntries(metrics.exceededTotalByType),
    limitCheckDurationMs: { ...d, avgMs },
    limiterCircuitThreshold: LIMITER_CIRCUIT_THRESHOLD,
    limiterConsecutiveFailures: getLimiterConsecutiveFailures()
  };
}

export function usageLimitDecisionFromResult(
  allowed: boolean,
  code: UsageLimitResult["code"]
): XchatLimitDecision {
  if (allowed) {
    return "allowed";
  }
  if (code === "xchat_hourly_limit_exceeded") {
    return "hourly_exceeded";
  }
  if (code === "xchat_daily_limit_exceeded") {
    return "daily_exceeded";
  }
  return "minute_exceeded";
}

/** Approximate wall-clock reset for Retry-After semantics (UTC-aligned buckets use server-computed retryAfterSeconds). */
export function computeLimitResetAtIso(retryAfterSeconds?: number): string {
  const sec = typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
    ? Math.max(1, Math.ceil(retryAfterSeconds))
    : 60;
  return new Date(Date.now() + sec * 1000).toISOString();
}

export type XchatLimitDecisionLogPayload = {
  type: "xchat.ask.limit_decision";
  correlationId: string;
  tenantId: string;
  userId: string;
  plan?: SubscriptionPlan | string;
  decision: XchatLimitDecision;
  latencyMs: number;
  effectiveDailyLimit?: number;
  effectiveHourlyLimit?: number;
  currentMinuteCount?: number;
  currentHourCount?: number;
  currentDayCount?: number;
  limitCode?: UsageLimitResult["code"];
  /** Workspace caps not enforced (global_admin); buckets may still increment for metering. */
  adminSession?: boolean;
  /** Mongo/limiter failures exceeded circuit threshold — ask proceeds. */
  limiterDegraded?: boolean;
};

/**
 * Operational structured log (Cloud Logging JSON detection). Prefix keeps grep parity with `[xchat/ask]`.
 */
export function logXchatAskLimitDecision(payload: XchatLimitDecisionLogPayload): void {
  console.info(
    JSON.stringify({
      msg: "[xchat/limit]",
      ...payload
    })
  );
}
