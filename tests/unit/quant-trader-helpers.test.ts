import { describe, expect, it } from "vitest";

import {
    buildQuantTraderXchatPrompt,
    mapDeskRiskProfileToMcTier,
    QUANT_TRADER_DEFAULT_PARAMS
} from "@/lib/xoptions/quant-trader-helpers";

describe("quant-trader helpers", () => {
  it("maps desk risk profiles to MC tiers", () => {
    expect(mapDeskRiskProfileToMcTier("conservative")).toBe("conservative");
    expect(mapDeskRiskProfileToMcTier("balanced")).toBe("moderate");
    expect(mapDeskRiskProfileToMcTier("growth")).toBe("aggressive");
    expect(mapDeskRiskProfileToMcTier(null)).toBe("moderate");
  });

  it("ships HNWI default filters (45d, IV>60, DD 15%)", () => {
    expect(QUANT_TRADER_DEFAULT_PARAMS.horizonDays).toBe(45);
    expect(QUANT_TRADER_DEFAULT_PARAMS.minIvRankPct).toBe(60);
    expect(QUANT_TRADER_DEFAULT_PARAMS.maxDrawdownPct).toBe(15);
    expect(QUANT_TRADER_DEFAULT_PARAMS.perPortfolioRisk).toBe(true);
  });

  it("builds quant-trader xChat handoff prompt", () => {
    const prompt = buildQuantTraderXchatPrompt({
      ...QUANT_TRADER_DEFAULT_PARAMS,
      strategyLabel: "covered-call wheel",
      symbol: "TSLA"
    });
    expect(prompt).toMatch(/Monte Carlo/i);
    expect(prompt).toMatch(/45-day covered-call wheel/i);
    expect(prompt).toMatch(/IV rank > 60%/i);
    expect(prompt).toMatch(/max 15% drawdown/i);
  });
});
