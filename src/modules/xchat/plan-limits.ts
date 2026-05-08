import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
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
  /** Premium tiers: xChat `atx_function` **price_alert_manage** for NL desk price rules (tenant + portfolio scoped). */
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
    nlPriceAlertManagementEnabled: true,
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
