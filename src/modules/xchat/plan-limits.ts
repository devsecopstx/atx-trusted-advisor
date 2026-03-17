import type { SubscriptionPlan } from "@/modules/identity/types";

export type PlanTierLimits = {
  maxPromptsPerDay: number;
  maxTurns: number;
  maxTopK: number;
  maxToolCalls: number;
  defaultModel: string;
  escalationModel: string;
  complexityThreshold: number;
  batchEnabled: boolean;
  maxBatchItemsPerJob: number;
  monthlyBudgetCents: number;
  softLimitPercent: number;
};

const PLAN_LIMITS: Record<SubscriptionPlan, PlanTierLimits> = {
  free: {
    maxPromptsPerDay: 5,
    maxTurns: 3,
    maxTopK: 3,
    maxToolCalls: 2,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-1-fast",
    complexityThreshold: Infinity,
    batchEnabled: false,
    maxBatchItemsPerJob: 0,
    monthlyBudgetCents: 0,
    softLimitPercent: 100
  },
  pro: {
    maxPromptsPerDay: 200,
    maxTurns: 5,
    maxTopK: 6,
    maxToolCalls: 10,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-latest",
    complexityThreshold: 500,
    batchEnabled: true,
    maxBatchItemsPerJob: 100,
    monthlyBudgetCents: 5000,
    softLimitPercent: 80
  },
  enterprise: {
    maxPromptsPerDay: 2000,
    maxTurns: 10,
    maxTopK: 10,
    maxToolCalls: 20,
    defaultModel: "grok-4-1-fast",
    escalationModel: "grok-4-latest",
    complexityThreshold: 200,
    batchEnabled: true,
    maxBatchItemsPerJob: 500,
    monthlyBudgetCents: 50000,
    softLimitPercent: 80
  }
};

export function getPlanLimits(plan?: SubscriptionPlan): PlanTierLimits {
  return PLAN_LIMITS[plan ?? "free"];
}

export function resolveModel(
  plan: SubscriptionPlan | undefined,
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
  plan?: SubscriptionPlan
): number {
  const max = getPlanLimits(plan).maxTurns;
  return Math.min(Math.max(1, requested), max);
}

export function clampTopK(
  requested: number,
  plan?: SubscriptionPlan
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

export function checkBudget(
  usedCents: number,
  plan?: SubscriptionPlan
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
