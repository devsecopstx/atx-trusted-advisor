import { describe, expect, it } from "vitest";

import { yieldPerCyclePctOfCapital } from "@/modules/xoptions/wheel-metrics";

describe("yieldPerCyclePctOfCapital", () => {
  it("computes premium over collateral as a percentage", () => {
    expect(
      yieldPerCyclePctOfCapital({
        premiumIncomePerCycleUsd: 500,
        requiredCapitalUsd: 25_000
      })
    ).toBeCloseTo(2, 5);
  });

  it("guards near-zero capital without blowing up", () => {
    const pct = yieldPerCyclePctOfCapital({
      premiumIncomePerCycleUsd: 100,
      requiredCapitalUsd: 0
    });
    expect(pct).toBeGreaterThan(0);
    expect(Number.isFinite(pct)).toBe(true);
  });

  it("returns zero when premium is zero", () => {
    expect(
      yieldPerCyclePctOfCapital({
        premiumIncomePerCycleUsd: 0,
        requiredCapitalUsd: 50_000
      })
    ).toBe(0);
  });
});
