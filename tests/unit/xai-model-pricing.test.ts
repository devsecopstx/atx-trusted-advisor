import { describe, expect, it } from "vitest";

import {
    estimateHostedToolUsd,
    estimateUsdFromTokenUsage,
    resolveXaiModelTokenRates
} from "@/modules/xchat/xai-model-pricing";

describe("resolveXaiModelTokenRates", () => {
  it("classifies multi-agent and fast models", () => {
    expect(resolveXaiModelTokenRates("grok-4.20-multi-agent-0309")).not.toBeNull();
    expect(resolveXaiModelTokenRates("grok-4-1-fast-reasoning")).not.toBeNull();
    expect(resolveXaiModelTokenRates("unknown-vendor-model")).toBeNull();
  });
});

describe("estimateUsdFromTokenUsage", () => {
  it("computes fast-model token cost", () => {
    const r = estimateUsdFromTokenUsage({
      model: "grok-4-1-fast-reasoning",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 0,
      cachedPromptTokens: 0
    });
    expect(r?.pricingKey).toBe("grok-4-1-fast-class");
    expect(r?.usd).toBeCloseTo(0.2 + 0.5, 6);
  });

  it("bills reasoning like output", () => {
    const r = estimateUsdFromTokenUsage({
      model: "grok-4-1-fast-reasoning",
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 1_000_000,
      cachedPromptTokens: 0
    });
    expect(r?.usd).toBeCloseTo(0.5, 6);
  });
});

describe("estimateHostedToolUsd", () => {
  it("applies web_search rate from docs ($5 / 1k calls)", () => {
    expect(estimateHostedToolUsd("web_search", 1000)).toBeCloseTo(5, 6);
    expect(estimateHostedToolUsd("atx_function", 100)).toBe(0);
  });
});
