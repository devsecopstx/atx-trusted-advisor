import { describe, expect, it } from "vitest";

import {
    computeStrategyGreeksSummary,
    formatStrategyNetDeltaShares,
    formatStrategyNetThetaDailyUsd,
    formatStrategyNetVegaExposureUsd,
    STRATEGY_GREEKS_GAMMA_RISK_THRESHOLD
} from "@/lib/xoptions/xoptions-strategy-greeks-summary";

const sampleLeg = {
  delta: 0.42,
  gamma: 0.03,
  thetaPerDay: -0.08,
  vegaPerOnePercentIv: 0.15
};

describe("computeStrategyGreeksSummary", () => {
  it("scales long premium greeks by contracts and multiplier", () => {
    const summary = computeStrategyGreeksSummary({
      legGreeks: sampleLeg,
      quantity: "2",
      openingAction: "buy_to_open"
    });
    expect(summary).not.toBeNull();
    expect(summary!.netDeltaShares).toBeCloseTo(84, 5);
    expect(summary!.netThetaDailyUsd).toBeCloseTo(-16, 5);
    expect(summary!.netVegaPerOnePercentIvUsd).toBeCloseTo(30, 5);
    expect(summary!.netGammaPerShare).toBeCloseTo(0.03, 5);
    expect(summary!.gammaRiskWarning).toBe(false);
  });

  it("flips sign for sell_to_open", () => {
    const summary = computeStrategyGreeksSummary({
      legGreeks: sampleLeg,
      quantity: "1",
      openingAction: "sell_to_open"
    });
    expect(summary).not.toBeNull();
    expect(summary!.netDeltaShares).toBeCloseTo(-42, 5);
    expect(summary!.netThetaDailyUsd).toBeCloseTo(8, 5);
    expect(summary!.netVegaPerOnePercentIvUsd).toBeCloseTo(-15, 5);
    expect(summary!.netGammaPerShare).toBeCloseTo(-0.03, 5);
  });

  it("flags gamma risk above threshold", () => {
    const summary = computeStrategyGreeksSummary({
      legGreeks: { ...sampleLeg, gamma: STRATEGY_GREEKS_GAMMA_RISK_THRESHOLD + 0.01 },
      quantity: "1",
      openingAction: "buy_to_open"
    });
    expect(summary?.gammaRiskWarning).toBe(true);
  });

  it("returns null without leg greeks", () => {
    expect(
      computeStrategyGreeksSummary({
        legGreeks: null,
        quantity: "1",
        openingAction: "buy_to_open"
      })
    ).toBeNull();
  });
});

describe("formatStrategyGreeksSummary", () => {
  it("formats signed delta shares", () => {
    expect(formatStrategyNetDeltaShares(42)).toBe("+42.00 sh");
    expect(formatStrategyNetDeltaShares(-12.5)).toBe("-12.50 sh");
    expect(formatStrategyNetDeltaShares(null)).toBe("—");
  });

  it("formats theta and vega with currency", () => {
    expect(formatStrategyNetThetaDailyUsd(12.34)).toBe("+$12.34/day");
    expect(formatStrategyNetThetaDailyUsd(-5)).toBe("−$5.00/day");
    expect(formatStrategyNetVegaExposureUsd(-20)).toBe("−$20.00 / 1% IV");
  });
});
