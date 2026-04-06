import { describe, expect, it } from "vitest";

import {
    MIN_OPTION_CHAIN_STRIKES_TRUST_SPRING,
    shouldTrustSpringStrategyOptionsPayload
} from "@/lib/strategy-options-spring-proxy-fallback";

describe("shouldTrustSpringStrategyOptionsPayload", () => {
  it("returns false for non-objects and missing optionChain", () => {
    expect(shouldTrustSpringStrategyOptionsPayload(null)).toBe(false);
    expect(shouldTrustSpringStrategyOptionsPayload(undefined)).toBe(false);
    expect(shouldTrustSpringStrategyOptionsPayload("x")).toBe(false);
    expect(shouldTrustSpringStrategyOptionsPayload({})).toBe(false);
    expect(shouldTrustSpringStrategyOptionsPayload({ optionChain: "bad" })).toBe(false);
  });

  it("returns false when optionChain is shorter than threshold", () => {
    const strikes = Array.from({ length: MIN_OPTION_CHAIN_STRIKES_TRUST_SPRING - 1 }, (_, i) => ({
      strike: i
    }));
    expect(shouldTrustSpringStrategyOptionsPayload({ optionChain: strikes })).toBe(false);
  });

  it("returns true when optionChain length meets threshold", () => {
    const strikes = Array.from({ length: MIN_OPTION_CHAIN_STRIKES_TRUST_SPRING }, (_, i) => ({
      strike: i
    }));
    expect(shouldTrustSpringStrategyOptionsPayload({ optionChain: strikes })).toBe(true);
  });
});
