import { describe, expect, it } from "vitest";

import { evaluateUserPriceRuleCross } from "@/modules/watchlist/user-price-alert-rules";

describe("evaluateUserPriceRuleCross", () => {
  it("does not fire on first observation (arms reference only)", () => {
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "crosses",
        targetPriceUsd: 100,
        lastReferencePrice: undefined,
        currentPrice: 99
      })
    ).toEqual({ fire: false, nextLastReference: 99 });
  });

  it("fires crosses upward", () => {
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "crosses",
        targetPriceUsd: 100,
        lastReferencePrice: 99,
        currentPrice: 100
      })
    ).toEqual({ fire: true, nextLastReference: 100 });
  });

  it("fires crosses downward", () => {
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "crosses",
        targetPriceUsd: 100,
        lastReferencePrice: 101,
        currentPrice: 100
      })
    ).toEqual({ fire: true, nextLastReference: 100 });
  });

  it("above fires only on upward cross", () => {
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "above",
        targetPriceUsd: 420,
        lastReferencePrice: 419,
        currentPrice: 420
      }).fire
    ).toBe(true);
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "above",
        targetPriceUsd: 420,
        lastReferencePrice: 421,
        currentPrice: 420
      }).fire
    ).toBe(false);
  });

  it("below fires only on downward cross", () => {
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "below",
        targetPriceUsd: 140,
        lastReferencePrice: 141,
        currentPrice: 140
      }).fire
    ).toBe(true);
    expect(
      evaluateUserPriceRuleCross({
        ruleKind: "below",
        targetPriceUsd: 140,
        lastReferencePrice: 139,
        currentPrice: 140
      }).fire
    ).toBe(false);
  });
});
