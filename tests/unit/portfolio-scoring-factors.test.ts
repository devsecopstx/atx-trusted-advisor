import { describe, expect, it } from "vitest";

import {
    computeWeightedStrategyScore,
    DEFAULT_PORTFOLIO_SCORING_FACTORS,
    parsePortfolioScoringFactorsInput,
    resolvePortfolioScoringFactors,
    SCORING_WEIGHT_SUM_TOLERANCE
} from "@/modules/core-admin/scoring-factors";

describe("portfolio scoring factors", () => {
  it("parses valid payload and sorts by catalog", () => {
    const raw = [
      { id: "strategy_alignment", weight: 0.1 },
      { id: "iv_rank", weight: 0.3 },
      { id: "open_interest", weight: 0.2 },
      { id: "volume", weight: 0.15 },
      { id: "liquidity", weight: 0.1 },
      { id: "portfolio_fit", weight: 0.15 }
    ];
    const parsed = parsePortfolioScoringFactorsInput(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.map((x) => x.id)).toEqual([
      "iv_rank",
      "open_interest",
      "volume",
      "liquidity",
      "portfolio_fit",
      "strategy_alignment"
    ]);
  });

  it("rejects duplicate ids and bad sums", () => {
    expect(
      parsePortfolioScoringFactorsInput([
        { id: "iv_rank", weight: 0.5 },
        { id: "iv_rank", weight: 0.5 }
      ])
    ).toBeNull();
    expect(
      parsePortfolioScoringFactorsInput([
        { id: "iv_rank", weight: 0.29 },
        { id: "open_interest", weight: 0.2 },
        { id: "volume", weight: 0.15 },
        { id: "liquidity", weight: 0.1 },
        { id: "portfolio_fit", weight: 0.15 },
        { id: "strategy_alignment", weight: 0.1 }
      ])
    ).toBeNull();
  });

  it("accepts sum within tolerance", () => {
    const delta = SCORING_WEIGHT_SUM_TOLERANCE / 2;
    const parsed = parsePortfolioScoringFactorsInput([
      { id: "iv_rank", weight: 0.3 + delta },
      { id: "open_interest", weight: 0.2 },
      { id: "volume", weight: 0.15 },
      { id: "liquidity", weight: 0.1 },
      { id: "portfolio_fit", weight: 0.15 },
      { id: "strategy_alignment", weight: 0.1 - delta }
    ]);
    expect(parsed).not.toBeNull();
  });

  it("resolve falls back to defaults when missing or invalid", () => {
    const a = resolvePortfolioScoringFactors(undefined);
    expect(a).toEqual([...DEFAULT_PORTFOLIO_SCORING_FACTORS]);
    const b = resolvePortfolioScoringFactors([{ id: "iv_rank", weight: 0.5 }]);
    expect(b).toEqual([...DEFAULT_PORTFOLIO_SCORING_FACTORS]);
  });

  it("computeWeightedStrategyScore matches formula for all ones", () => {
    const subs = {
      iv_rank: 1,
      open_interest: 1,
      volume: 1,
      liquidity: 1,
      portfolio_fit: 1,
      strategy_alignment: 1
    };
    expect(computeWeightedStrategyScore([...DEFAULT_PORTFOLIO_SCORING_FACTORS], subs)).toBe(100);
  });

  it("subset weights still score correctly", () => {
    const factors = [
      { id: "iv_rank" as const, weight: 0.6 },
      { id: "volume" as const, weight: 0.4 }
    ];
    expect(computeWeightedStrategyScore(factors, { iv_rank: 1, volume: 0.5 })).toBe(80);
  });
});
