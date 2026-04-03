import { describe, expect, it } from "vitest";

import {
    heavySynthesisIntent,
    shouldOfferStrategyJobPreflight
} from "@/modules/xchat/xchat-ask-routing";

describe("heavySynthesisIntent", () => {
  it("is false for short factual prompts", () => {
    expect(heavySynthesisIntent("What is the VIX?")).toBe(false);
  });

  it("is true for explicit red-team style asks", () => {
    expect(heavySynthesisIntent("red team my thesis on TSLA")).toBe(true);
  });

  it("is true for very long messages", () => {
    expect(heavySynthesisIntent("x".repeat(2900))).toBe(true);
  });
});

describe("shouldOfferStrategyJobPreflight", () => {
  it("matches covered call phrasing", () => {
    expect(shouldOfferStrategyJobPreflight("Help me set up a covered call on MSFT")).toBe(true);
  });

  it("ignores unrelated chat", () => {
    expect(shouldOfferStrategyJobPreflight("What is a stock?")).toBe(false);
  });
});
