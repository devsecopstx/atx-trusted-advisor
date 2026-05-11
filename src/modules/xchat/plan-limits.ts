import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import type { TenantWorkspaceLimits } from "@/modules/identity/tenant-workspace-limits";
import type { SubscriptionPlan } from "@/modules/identity/types";

/** Parallelism payload for `grok-4.20-multi-agent` (xAI `agent_count` + `reasoning.effort`). */
export type ParallelismPlanClamp = {
  agentCount: 4 | 16;
  reasoningEffort: "low" | "medium" | "high";
};

export type PlanTierLimits = {
  maxPromptsPerDay: number;
  maxTurns: number;
  maxTopK: number;
  maxToolCalls: number;
  /** Premium+ tier only: NL price alerts (`price_alert_manage`); still requires advisor/global_admin role at runtime. */
  nlPriceAlertManagementEnabled: boolean;
  defaultModel: string;
  escalationModel: string;
  complexityThreshold: number;
  batchEnabled: boolean;
  maxBatchItemsPerJob: number;
  monthlyBudgetCents: number;
  softLimitPercent: number;
  /**
   * Max `agent_count` for multi-agent model calls for **non–global_admin** sessions (subscription plan).
   * `0` strips parallelism entirely (no multi-agent surcharge) until ops raises caps per tier.
   */
  multiAgentParallelMaxAgents: 0 | 4 | 16;
};

const PLAN_LIMITS: Record<SubscriptionPlan, PlanTierLimits> = {
  basic: {
    maxPromptsPerDay: 5,
    maxTurns: 3,
    maxTopK: 3,
    maxToolCalls: 2,
    nlPriceAlertManagementEnabled: false,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-1-fast",
    complexityThreshold: Infinity,
    batchEnabled: false,
    maxBatchItemsPerJob: 0,
    monthlyBudgetCents: 0,
    softLimitPercent: 100,
    multiAgentParallelMaxAgents: 0
  },
  premium: {
    maxPromptsPerDay: 200,
    maxTurns: 5,
    maxTopK: 6,
    maxToolCalls: 10,
    nlPriceAlertManagementEnabled: false,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-latest",
    complexityThreshold: 500,
    batchEnabled: true,
    maxBatchItemsPerJob: 100,
    monthlyBudgetCents: 5000,
    softLimitPercent: 80,
    multiAgentParallelMaxAgents: 4
  },
  premium_plus: {
    maxPromptsPerDay: 2000,
    maxTurns: 10,
    maxTopK: 10,
    maxToolCalls: 20,
    nlPriceAlertManagementEnabled: true,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-latest",
    complexityThreshold: 200,
    batchEnabled: true,
    maxBatchItemsPerJob: 500,
    monthlyBudgetCents: 50000,
    softLimitPercent: 80,
    multiAgentParallelMaxAgents: 16
  }
};

export function getPlanLimits(plan?: SubscriptionPlan | string): PlanTierLimits {
  return PLAN_LIMITS[normalizeSubscriptionPlan(plan)];
}

/**
 * Caps interactive tool-loop turns by subscription tier (app users). Global admins keep persona `maxTurns`
 * up to 16 for debugging; everyone else is min(persona, plan tier maxTurns).
 */
export function clampToolLoopMaxTurnsForSession(input: {
  personaMaxTurns: number;
  plan?: SubscriptionPlan | string;
  isAdminSession: boolean;
}): number {
  const raw = Number(input.personaMaxTurns);
  const persona = Number.isFinite(raw)
    ? Math.min(16, Math.max(1, Math.floor(raw)))
    : 5;
  if (input.isAdminSession) {
    return persona;
  }
  const cap = getPlanLimits(input.plan).maxTurns;
  return Math.min(persona, cap);
}

/** Effective xChat prompt caps for UI + metering (matches ask route: tenant workspace first, plan tier for soft %). */
export type XchatMergedPromptLimits = {
  subscriptionPlan: SubscriptionPlan;
  dailyCap: number;
  /** `0` when hourly enforcement is off (`userChatHourlyLimit` absent or 0). */
  hourlyCap: number;
  softLimitPercent: number;
};

/**
 * Merge subscription tier (`getPlanLimits`) with resolved tenant workspace limits (base + planOverrides).
 * When workspace limits cannot be loaded, pass `undefined` — daily cap falls back to the tier
 * `maxPromptsPerDay` (same pattern as the ask limiter).
 */
export function mergeXchatPromptLimitsForWorkspace(
  plan: SubscriptionPlan | string | undefined,
  effectiveWorkspace: TenantWorkspaceLimits | null | undefined
): XchatMergedPromptLimits {
  const subscriptionPlan = normalizeSubscriptionPlan(plan);
  const tierLimits = getPlanLimits(subscriptionPlan);
  const ws = effectiveWorkspace;
  const dailyFromWs =
    ws &&
    typeof ws.userChatLimit === "number" &&
    Number.isFinite(ws.userChatLimit) &&
    ws.userChatLimit > 0
      ? Math.max(1, Math.floor(ws.userChatLimit))
      : tierLimits.maxPromptsPerDay;
  const hourlyRaw = ws?.userChatHourlyLimit;
  const hourlyCap =
    typeof hourlyRaw === "number" && hourlyRaw > 0 ? Math.max(1, Math.floor(hourlyRaw)) : 0;
  return {
    subscriptionPlan,
    dailyCap: dailyFromWs,
    hourlyCap,
    softLimitPercent: tierLimits.softLimitPercent
  };
}

/** In-product soft banner when daily prompt usage crosses the high-utilization threshold (plan soft % floor at 80%). */
export function shouldShowXchatPromptSoftLimitBanner(input: {
  usedToday: number;
  dailyCap: number;
  planSoftLimitPercent: number;
}): boolean {
  const cap = Math.max(1, input.dailyCap);
  const used = Math.max(0, input.usedToday);
  const ratio = used / cap;
  const thresholdPct = Math.min(80, Math.max(1, input.planSoftLimitPercent));
  return ratio >= thresholdPct / 100;
}

/** Progress fill token: green → amber (≥80% of daily cap) → red at/near hard cap. */
export function xchatPromptUsageMeterFillVar(input: {
  usedToday: number;
  dailyCap: number;
}): "var(--xf-meter-fill)" | "var(--xf-meter-warn)" | "var(--xf-meter-danger)" {
  const cap = Math.max(1, input.dailyCap);
  const ratio = Math.max(0, input.usedToday) / cap;
  if (ratio >= 1) {
    return "var(--xf-meter-danger)";
  }
  if (ratio >= 0.8) {
    return "var(--xf-meter-warn)";
  }
  return "var(--xf-meter-fill)";
}

/** Desk NL price alerts (xChat tool + branded email): Premium+ and advisor or global_admin. */
export function hasNlPriceAlertDeskRole(roles: string[] | undefined): boolean {
  const r = roles ?? [];
  return r.includes("advisor") || r.includes("global_admin");
}

export function canManageNlPriceAlerts(
  plan?: SubscriptionPlan | string,
  roles?: string[]
): boolean {
  if (!getPlanLimits(plan).nlPriceAlertManagementEnabled) {
    return false;
  }
  return hasNlPriceAlertDeskRole(roles);
}

/** Branded SMTP notifications on NL alert fires — same gate as {@link canManageNlPriceAlerts}. */
export function canReceiveNlPriceAlertEmail(
  plan?: SubscriptionPlan | string,
  roles?: string[]
): boolean {
  return canManageNlPriceAlerts(plan, roles);
}

export function resolveModel(
  plan: SubscriptionPlan | string | undefined,
  messageLength: number,
  personaModel?: string
): string {
  const limits = getPlanLimits(plan);
  if (personaModel && personaModel !== limits.defaultModel) {
    return personaModel;
  }
  if (messageLength >= limits.complexityThreshold) {
    return limits.escalationModel;
  }
  return limits.defaultModel;
}

export function clampTurns(
  requested: number,
  plan?: SubscriptionPlan | string
): number {
  const max = getPlanLimits(plan).maxTurns;
  return Math.min(Math.max(1, requested), max);
}

export function clampTopK(
  requested: number,
  plan?: SubscriptionPlan | string
): number {
  const max = getPlanLimits(plan).maxTopK;
  return Math.min(Math.max(1, requested), max);
}

export type BudgetCheckResult = {
  allowed: boolean;
  usedCents: number;
  limitCents: number;
  softLimitReached: boolean;
};

/**
 * Applies subscription-tier ceiling to multi-agent parallelism.
 * When `maxAgents` is `0`, callers should omit `agent_count` / parallelism from xAI requests.
 */
export function clampMultiAgentParallelismWithMax(
  config: ParallelismPlanClamp | undefined,
  maxAgents: 0 | 4 | 16
): ParallelismPlanClamp | undefined {
  if (!config) {
    return undefined;
  }
  if (maxAgents === 0) {
    return undefined;
  }
  if (config.agentCount <= maxAgents) {
    return config;
  }
  return {
    agentCount: 4,
    reasoningEffort: config.reasoningEffort
  };
}

export function clampMultiAgentParallelismForPlan(
  config: ParallelismPlanClamp | undefined,
  plan?: SubscriptionPlan | string
): ParallelismPlanClamp | undefined {
  return clampMultiAgentParallelismWithMax(
    config,
    getPlanLimits(plan).multiAgentParallelMaxAgents
  );
}

export function checkBudget(
  usedCents: number,
  plan?: SubscriptionPlan | string
): BudgetCheckResult {
  const limits = getPlanLimits(plan);
  if (limits.monthlyBudgetCents === 0) {
    return {
      allowed: true,
      usedCents,
      limitCents: 0,
      softLimitReached: false
    };
  }

  const softThreshold = Math.floor(
    limits.monthlyBudgetCents * (limits.softLimitPercent / 100)
  );

  return {
    allowed: usedCents < limits.monthlyBudgetCents,
    usedCents,
    limitCents: limits.monthlyBudgetCents,
    softLimitReached: usedCents >= softThreshold
  };
}
