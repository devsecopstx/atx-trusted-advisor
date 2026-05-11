import { describe, expect, it } from "vitest";

import {
    checkBudget,
    clampMultiAgentParallelismForPlan,
    clampMultiAgentParallelismWithMax,
    clampTopK,
    clampTurns,
    getPlanLimits,
    mergeXchatPromptLimitsForWorkspace,
    resolveModel,
    shouldShowXchatPromptSoftLimitBanner,
    xchatPromptUsageMeterFillVar
} from "@/modules/xchat/plan-limits";

describe("plan tier limits", () => {
  it("basic plan has 5 prompts per day", () => {
    expect(getPlanLimits("basic").maxPromptsPerDay).toBe(5);
  });

  it("premium plan has 200 prompts per day", () => {
    expect(getPlanLimits("premium").maxPromptsPerDay).toBe(200);
  });

  it("premium_plus plan has 2000 prompts per day", () => {
    expect(getPlanLimits("premium_plus").maxPromptsPerDay).toBe(2000);
  });

  it("normalizes legacy Mongo slugs to canonical tiers", () => {
    expect(getPlanLimits("free").maxPromptsPerDay).toBe(5);
    expect(getPlanLimits("pro").maxPromptsPerDay).toBe(200);
    expect(getPlanLimits("enterprise").maxPromptsPerDay).toBe(2000);
  });

  it("defaults to basic when plan is undefined", () => {
    expect(getPlanLimits(undefined).maxPromptsPerDay).toBe(5);
  });

  it("basic plan disables batch", () => {
    expect(getPlanLimits("basic").batchEnabled).toBe(false);
  });

  it("premium plan enables batch with 100 items", () => {
    const limits = getPlanLimits("premium");
    expect(limits.batchEnabled).toBe(true);
    expect(limits.maxBatchItemsPerJob).toBe(100);
  });

  it("premium_plus plan enables batch with 500 items", () => {
    expect(getPlanLimits("premium_plus").maxBatchItemsPerJob).toBe(500);
  });
});

describe("model tiering", () => {
  it("uses fast model for short basic messages", () => {
    expect(resolveModel("basic", 50)).toBe("grok-4-1-fast");
  });

  it("never escalates for basic plan (Infinity threshold)", () => {
    expect(resolveModel("basic", 10000)).toBe("grok-4-1-fast");
  });

  it("escalates premium plan on complexity threshold", () => {
    expect(resolveModel("premium", 499)).toBe("grok-4-1-fast");
    expect(resolveModel("premium", 500)).toBe("grok-4-latest");
  });

  it("escalates premium_plus plan at lower threshold", () => {
    expect(resolveModel("premium_plus", 199)).toBe("grok-4-1-fast");
    expect(resolveModel("premium_plus", 200)).toBe("grok-4-latest");
  });

  it("respects persona model override", () => {
    expect(resolveModel("premium", 10, "grok-4-latest")).toBe("grok-4-latest");
  });

  it("does not override when persona model matches default", () => {
    expect(resolveModel("premium", 10, "grok-4-1-fast")).toBe("grok-4-1-fast");
  });
});

describe("clamp functions", () => {
  it("clampTurns caps at plan max", () => {
    expect(clampTurns(10, "basic")).toBe(3);
    expect(clampTurns(10, "premium")).toBe(5);
    expect(clampTurns(10, "premium_plus")).toBe(10);
  });

  it("clampTurns enforces minimum of 1", () => {
    expect(clampTurns(0, "basic")).toBe(1);
    expect(clampTurns(-1, "premium")).toBe(1);
  });

  it("clampTopK caps at plan max", () => {
    expect(clampTopK(10, "basic")).toBe(3);
    expect(clampTopK(10, "premium")).toBe(6);
    expect(clampTopK(10, "premium_plus")).toBe(10);
  });
});

describe("budget checks", () => {
  it("basic plan always allowed (no budget)", () => {
    const result = checkBudget(9999, "basic");
    expect(result.allowed).toBe(true);
    expect(result.limitCents).toBe(0);
  });

  it("premium plan allowed under limit", () => {
    const result = checkBudget(1000, "premium");
    expect(result.allowed).toBe(true);
    expect(result.softLimitReached).toBe(false);
  });

  it("premium plan soft limit at 80%", () => {
    const result = checkBudget(4000, "premium");
    expect(result.allowed).toBe(true);
    expect(result.softLimitReached).toBe(true);
  });

  it("premium plan hard limit at 100%", () => {
    const result = checkBudget(5000, "premium");
    expect(result.allowed).toBe(false);
  });

  it("premium_plus plan has higher budget", () => {
    const result = checkBudget(10000, "premium_plus");
    expect(result.allowed).toBe(true);
    expect(result.limitCents).toBe(50000);
  });
});

describe("multi-agent plan clamp", () => {
  const highParallelism = { agentCount: 16 as const, reasoningEffort: "high" as const };
  const lowParallelism = { agentCount: 4 as const, reasoningEffort: "medium" as const };

  it("multiAgentParallelMaxAgents is 0 on basic, capped parallelism on paid tiers", () => {
    expect(getPlanLimits("basic").multiAgentParallelMaxAgents).toBe(0);
    expect(getPlanLimits("premium").multiAgentParallelMaxAgents).toBe(4);
    expect(getPlanLimits("premium_plus").multiAgentParallelMaxAgents).toBe(16);
  });

  it("clampMultiAgentParallelismWithMax returns undefined when max is 0", () => {
    expect(clampMultiAgentParallelismWithMax(highParallelism, 0)).toBeUndefined();
    expect(clampMultiAgentParallelismWithMax(undefined, 0)).toBeUndefined();
  });

  it("clampMultiAgentParallelismWithMax passes through when agentCount within max", () => {
    expect(clampMultiAgentParallelismWithMax(lowParallelism, 4)).toEqual(lowParallelism);
    expect(clampMultiAgentParallelismWithMax(highParallelism, 16)).toEqual(highParallelism);
  });

  it("clampMultiAgentParallelismWithMax reduces 16 to 4 when max is 4", () => {
    expect(clampMultiAgentParallelismWithMax(highParallelism, 4)).toEqual({
      agentCount: 4,
      reasoningEffort: "high"
    });
  });

  it("clampMultiAgentParallelismForPlan uses tier max", () => {
    expect(clampMultiAgentParallelismForPlan(highParallelism, "premium_plus")).toEqual(highParallelism);
    expect(clampMultiAgentParallelismForPlan(highParallelism, "premium")).toEqual({
      agentCount: 4,
      reasoningEffort: "high"
    });
    expect(clampMultiAgentParallelismForPlan(highParallelism, "basic")).toBeUndefined();
    expect(clampMultiAgentParallelismForPlan(highParallelism, undefined)).toBeUndefined();
  });
});

describe("xChat merged workspace + plan limits (meter helpers)", () => {
  it("merge uses tenant userChatLimit with plan soft percent", () => {
    const merged = mergeXchatPromptLimitsForWorkspace("premium", {
      userChatLimit: 50,
      userChatHourlyLimit: 12,
      userXoptionsLimit: 10,
      tenantPortfolioLimit: 1,
      portfolioAccountLimit: 1,
      changePersonaEnabled: true,
      chatHistoryMax: 10,
      maxUsersPerTenant: 5,
      userTasksMax: 5,
      outlookRefreshEnabled: true
    });
    expect(merged.dailyCap).toBe(50);
    expect(merged.hourlyCap).toBe(12);
    expect(merged.softLimitPercent).toBe(80);
    expect(merged.subscriptionPlan).toBe("premium");
  });

  it("merge falls back to plan maxPromptsPerDay when workspace missing", () => {
    const merged = mergeXchatPromptLimitsForWorkspace("basic", undefined);
    expect(merged.dailyCap).toBe(5);
    expect(merged.hourlyCap).toBe(0);
  });

  it("soft-limit banner at 80%+ daily utilization (threshold capped at 80)", () => {
    expect(
      shouldShowXchatPromptSoftLimitBanner({
        usedToday: 8,
        dailyCap: 10,
        planSoftLimitPercent: 100
      })
    ).toBe(true);
    expect(
      shouldShowXchatPromptSoftLimitBanner({
        usedToday: 8,
        dailyCap: 10,
        planSoftLimitPercent: 80
      })
    ).toBe(true);
    expect(
      shouldShowXchatPromptSoftLimitBanner({
        usedToday: 6,
        dailyCap: 10,
        planSoftLimitPercent: 80
      })
    ).toBe(false);
  });

  it("meter fill ramps green → warn → danger by utilization", () => {
    expect(xchatPromptUsageMeterFillVar({ usedToday: 3, dailyCap: 10 })).toBe("var(--xf-meter-fill)");
    expect(xchatPromptUsageMeterFillVar({ usedToday: 8, dailyCap: 10 })).toBe("var(--xf-meter-warn)");
    expect(xchatPromptUsageMeterFillVar({ usedToday: 10, dailyCap: 10 })).toBe("var(--xf-meter-danger)");
  });
});
