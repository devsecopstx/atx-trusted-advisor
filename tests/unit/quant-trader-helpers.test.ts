import { describe, expect, it } from "vitest";

import {
    buildQuantTraderExportMeta,
    buildQuantTraderXchatPrompt,
    mapDeskRiskProfileToMcTier,
    QUANT_TRADER_DEFAULT_PARAMS,
    quantTraderResultsToCsvWithMeta
} from "@/lib/xoptions/quant-trader-helpers";
import type { MonteCarloTailRiskToolSuccess } from "@/modules/xchat/monte-carlo-tail-risk-tool";

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

  it("prefixes CSV export with report parameters and timestamps", () => {
    const result = {
      ok: true,
      generatedAt: "2026-05-15T12:00:00.000Z",
      risk: "aggressive",
      horizonDays: 45,
      minIvRankPct: 60,
      portfolios: [
        {
          portfolioId: "507f1f77bcf86cd799439011",
          portfolioName: "Default Portfolio",
          holdingsCount: 2,
          tailRisk: {
            paths: 12000,
            var1dPct95: 2.1,
            var10dPct95: 5.2,
            cvar1dPct95: 3.1,
            cvar10dPct95: 6.4,
            probDrawdownGt20Pct: 0.12,
            stress2020VolSpike: {
              label: "2020 vol",
              var1dPct: 3,
              var10dPct: 6,
              cvar1dPct: 4,
              probDrawdownGt20Pct: 0.2
            },
            stressCorrelationCrush: {
              label: "corr crush",
              var1dPct: 2.5,
              var10dPct: 5,
              cvar1dPct: 3.5,
              probDrawdownGt20Pct: 0.15
            },
            riskTierNote: "note",
            hedgeOverlayHint: "hint",
            advisorSummaryLine: "summary"
          },
          greeksExposure: []
        }
      ],
      combinedTailRisk: null,
      strategyJobHandoff: { path: "/xoptions", instruction: "test" },
      disclaimer: "Educational only."
    } satisfies MonteCarloTailRiskToolSuccess;

    const meta = buildQuantTraderExportMeta({
      params: { ...QUANT_TRADER_DEFAULT_PARAMS, strategyLabel: "covered-call wheel", symbol: "TSLA" },
      generatedAt: new Date("2026-05-15T18:30:00.000Z"),
      workspacePortfolioName: "Aggressive Default",
      simulationGeneratedAt: result.generatedAt
    });

    const csv = quantTraderResultsToCsvWithMeta(result, meta);
    expect(csv).toMatch(/^# xFinance Quant Trader — Monte Carlo export/);
    expect(csv).toContain("# Report generated (UTC),2026-05-15T18:30:00.000Z");
    expect(csv).toContain("# Horizon (days),45");
    expect(csv).toContain("# IV rank min (%),60");
    expect(csv).toContain("# Strategy,covered-call wheel");
    expect(csv).toContain("# Symbol,TSLA");
    expect(csv).toContain("portfolioId,portfolioName");
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
