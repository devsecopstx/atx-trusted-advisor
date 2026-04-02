import { describe, expect, it } from "vitest";

import { daysToExpirationFromYmd, decideOptionActionFromRules } from "@/modules/strategy-options/options-scanner-engine";

const baseRule = {
  side: "long" as const,
  impliedVolPercent: 35,
  optionType: "call" as const
};

describe("decideOptionActionFromRules", () => {
  it("flags expired / past-dated as sell", () => {
    const r = decideOptionActionFromRules({
      dte: 0,
      mark: 1,
      avgCost: 1,
      openInterest: 1000,
      volume: 50,
      ...baseRule
    });
    expect(r.action).toBe("sell");
    expect(r.needsGrok).toBe(false);
  });

  it("take-profit when pnl very high", () => {
    const r = decideOptionActionFromRules({
      dte: 20,
      mark: 2,
      avgCost: 1,
      openInterest: 500,
      volume: 40,
      ...baseRule
    });
    expect(r.action).toBe("sell");
    expect(r.pnlPct).toBeCloseTo(100, 5);
  });

  it("default hold when healthy", () => {
    const r = decideOptionActionFromRules({
      dte: 30,
      mark: 1.05,
      avgCost: 1,
      openInterest: 800,
      volume: 120,
      ...baseRule
    });
    expect(r.action).toBe("hold");
  });
});

describe("daysToExpirationFromYmd", () => {
  it("returns non-negative days", () => {
    const d = daysToExpirationFromYmd("2099-12-31");
    expect(d).toBeGreaterThan(0);
  });
});
