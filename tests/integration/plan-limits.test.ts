import { describe, expect, it } from "vitest";

import {
    checkBudget,
    clampMultiAgentParallelismForPlan,
    clampMultiAgentParallelismWithMax,
    clampTopK,
    clampTurns,
    getPlanLimits,
    resolveModel
} from "@/modules/xchat/plan-limits";

describe("plan tier limits", () => {
  it("free plan has 5 prompts per day", () => {
    expect(getPlanLimits("free").maxPromptsPerDay).toBe(5);
  });

  it("pro plan has 200 prompts per day", () => {
    expect(getPlanLimits("pro").maxPromptsPerDay).toBe(200);
  });

  it("enterprise plan has 2000 prompts per day", () => {
    expect(getPlanLimits("enterprise").maxPromptsPerDay).toBe(2000);
  });

  it("defaults to free when plan is undefined", () => {
    expect(getPlanLimits(undefined).maxPromptsPerDay).toBe(5);
  });

  it("free plan disables batch", () => {
    expect(getPlanLimits("free").batchEnabled).toBe(false);
  });

  it("pro plan enables batch with 100 items", () => {
    const limits = getPlanLimits("pro");
    expect(limits.batchEnabled).toBe(true);
    expect(limits.maxBatchItemsPerJob).toBe(100);
  });

  it("enterprise plan enables batch with 500 items", () => {
    expect(getPlanLimits("enterprise").maxBatchItemsPerJob).toBe(500);
  });
});

describe("model tiering", () => {
  it("uses fast model for short free messages", () => {
    expect(resolveModel("free", 50)).toBe("grok-4-1-fast");
  });

  it("never escalates for free plan (Infinity threshold)", () => {
    expect(resolveModel("free", 10000)).toBe("grok-4-1-fast");
  });

  it("escalates pro plan on complexity threshold", () => {
    expect(resolveModel("pro", 499)).toBe("grok-4-1-fast");
    expect(resolveModel("pro", 500)).toBe("grok-4-latest");
  });

  it("escalates enterprise plan at lower threshold", () => {
    expect(resolveModel("enterprise", 199)).toBe("grok-4-1-fast");
    expect(resolveModel("enterprise", 200)).toBe("grok-4-latest");
  });

  it("respects persona model override", () => {
    expect(resolveModel("pro", 10, "grok-4-latest")).toBe("grok-4-latest");
  });

  it("does not override when persona model matches default", () => {
    expect(resolveModel("pro", 10, "grok-4-1-fast")).toBe("grok-4-1-fast");
  });
});

describe("clamp functions", () => {
  it("clampTurns caps at plan max", () => {
    expect(clampTurns(10, "free")).toBe(3);
    expect(clampTurns(10, "pro")).toBe(5);
    expect(clampTurns(10, "enterprise")).toBe(10);
  });

  it("clampTurns enforces minimum of 1", () => {
    expect(clampTurns(0, "free")).toBe(1);
    expect(clampTurns(-1, "pro")).toBe(1);
  });

  it("clampTopK caps at plan max", () => {
    expect(clampTopK(10, "free")).toBe(3);
    expect(clampTopK(10, "pro")).toBe(6);
    expect(clampTopK(10, "enterprise")).toBe(10);
  });
});

describe("budget checks", () => {
  it("free plan always allowed (no budget)", () => {
    const result = checkBudget(9999, "free");
    expect(result.allowed).toBe(true);
    expect(result.limitCents).toBe(0);
  });

  it("pro plan allowed under limit", () => {
    const result = checkBudget(1000, "pro");
    expect(result.allowed).toBe(true);
    expect(result.softLimitReached).toBe(false);
  });

  it("pro plan soft limit at 80%", () => {
    const result = checkBudget(4000, "pro");
    expect(result.allowed).toBe(true);
    expect(result.softLimitReached).toBe(true);
  });

  it("pro plan hard limit at 100%", () => {
    const result = checkBudget(5000, "pro");
    expect(result.allowed).toBe(false);
  });

  it("enterprise plan has higher budget", () => {
    const result = checkBudget(10000, "enterprise");
    expect(result.allowed).toBe(true);
    expect(result.limitCents).toBe(50000);
  });
});

describe("multi-agent plan clamp", () => {
  const highParallelism = { agentCount: 16 as const, reasoningEffort: "high" as const };
  const lowParallelism = { agentCount: 4 as const, reasoningEffort: "medium" as const };

  it("all tiers default multiAgentParallelMaxAgents to 0", () => {
    expect(getPlanLimits("free").multiAgentParallelMaxAgents).toBe(0);
    expect(getPlanLimits("pro").multiAgentParallelMaxAgents).toBe(0);
    expect(getPlanLimits("enterprise").multiAgentParallelMaxAgents).toBe(0);
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

  it("clampMultiAgentParallelismForPlan uses tier max (currently all 0)", () => {
    expect(clampMultiAgentParallelismForPlan(highParallelism, "enterprise")).toBeUndefined();
    expect(clampMultiAgentParallelismForPlan(highParallelism, undefined)).toBeUndefined();
  });
});
