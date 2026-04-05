import { describe, expect, it } from "vitest";

import { europeanOptionGreeks, europeanOptionPrice } from "@/lib/xoptions/xoptions-bs-greeks";
import {
    estimateProbabilityProfitAtExpiryPercent,
    normalCdf
} from "@/lib/xoptions/xoptions-order-preview";

describe("europeanOptionGreeks", () => {
  it("returns ATM call delta near 0.5 for medium tenor", () => {
    const g = europeanOptionGreeks({
      spot: 100,
      strike: 100,
      T: 0.25,
      sigma: 0.3,
      riskFreeRate: 0.05,
      side: "call"
    });
    expect(g).not.toBeNull();
    expect(g!.delta).toBeGreaterThan(0.45);
    expect(g!.delta).toBeLessThan(0.58);
    expect(g!.gamma).toBeGreaterThan(0);
  });
});

describe("europeanOptionPrice", () => {
  it("matches intrinsic at expiry for deep ITM call (T small)", () => {
    const T = 1 / 36500;
    const px = europeanOptionPrice({
      spot: 110,
      strike: 100,
      T,
      sigma: 0.3,
      riskFreeRate: 0.05,
      side: "call"
    });
    expect(px).not.toBeNull();
    expect(px!).toBeGreaterThan(9);
    expect(px!).toBeLessThan(11);
  });
});

describe("estimateProbabilityProfitAtExpiryPercent", () => {
  it("returns a percent in range with IV", () => {
    const p = estimateProbabilityProfitAtExpiryPercent({
      side: "call",
      spot: 100,
      strike: 100,
      premiumPerShare: 2,
      ivPercent: 40,
      expirationYyyyMmDd: "2026-12-19"
    });
    expect(p).not.toBeNull();
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });
});

describe("normalCdf export", () => {
  it("is defined", () => {
    expect(normalCdf(0)).toBeGreaterThan(0.49);
  });
});
