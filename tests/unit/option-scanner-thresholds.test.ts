import { describe, expect, it } from "vitest";

import {
    DEFAULT_OPTION_SCANNER_THRESHOLDS,
    deriveOptionScannerThresholdsFromScoringFactors,
    thresholdsAppliedRecord
} from "@/lib/option-scanner-thresholds";
import { DEFAULT_PORTFOLIO_SCORING_FACTORS } from "@/modules/core-admin/scoring-factors";
import { decideOptionActionFromRules } from "@/modules/strategy-options/options-scanner-engine";

describe("deriveOptionScannerThresholdsFromScoringFactors", () => {
  it("matches defaults when using catalog-default weights", () => {
    const t = deriveOptionScannerThresholdsFromScoringFactors([...DEFAULT_PORTFOLIO_SCORING_FACTORS]);
    expect(t.lossCutPctDefault).toBe(DEFAULT_OPTION_SCANNER_THRESHOLDS.lossCutPctDefault);
    expect(t.minOpenInterestWarn).toBe(DEFAULT_OPTION_SCANNER_THRESHOLDS.minOpenInterestWarn);
  });

  it("raises liquidity gates when liquidity weight is high", () => {
    const factors = [
      { id: "iv_rank" as const, weight: 0.2 },
      { id: "open_interest" as const, weight: 0.15 },
      { id: "volume" as const, weight: 0.1 },
      { id: "liquidity" as const, weight: 0.35 },
      { id: "portfolio_fit" as const, weight: 0.1 },
      { id: "strategy_alignment" as const, weight: 0.1 }
    ];
    const t = deriveOptionScannerThresholdsFromScoringFactors(factors);
    expect(t.minOpenInterestWarn).toBeGreaterThan(DEFAULT_OPTION_SCANNER_THRESHOLDS.minOpenInterestWarn);
  });
});

describe("decideOptionActionFromRules + thresholds", () => {
  const base = {
    side: "long" as const,
    impliedVolPercent: 35,
    optionType: "call" as const
  };

  it("honors elevated min OI / vol as thin-liquidity hold", () => {
    const strict = {
      ...DEFAULT_OPTION_SCANNER_THRESHOLDS,
      minOpenInterestWarn: 10_000,
      minVolumeWarn: 5000
    };
    const r = decideOptionActionFromRules(
      {
        dte: 20,
        mark: 1,
        avgCost: 1,
        openInterest: 100,
        volume: 50,
        ...base
      },
      strict
    );
    expect(r.action).toBe("hold");
  });

  it("exports flat threshold map for alert metadata", () => {
    const rec = thresholdsAppliedRecord(DEFAULT_OPTION_SCANNER_THRESHOLDS);
    expect(rec.lossCutPctDefault).toBe(-55);
    expect(Object.keys(rec).length).toBeGreaterThan(5);
  });
});
