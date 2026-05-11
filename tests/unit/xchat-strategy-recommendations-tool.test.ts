import { afterEach, describe, expect, it, vi } from "vitest";

import {
    parseStrategyRecommendationsToolArgs,
    runStrategyRecommendationsTool
} from "@/modules/xchat/strategy-recommendations-tool";

describe("parseStrategyRecommendationsToolArgs", () => {
  it("builds a backend request from validated tool arguments", () => {
    const parsed = parseStrategyRecommendationsToolArgs(
      {
        symbols: ["tsla", "TSLA", "rdw"],
        outlook: "bullish",
        risk: "moderate",
        horizonDays: 45,
        preferredStrategies: ["covered_call", "long_call", "not_real"],
        maxResults: 20
      },
      { workspacePortfolioId: "64f000000000000000000001" }
    );

    expect(parsed).toEqual({
      ok: true,
      payload: {
        portfolioId: "64f000000000000000000001",
        symbols: ["TSLA", "RDW"],
        outlook: "bullish",
        risk: "moderate",
        horizonDays: 45,
        preferredStrategies: ["covered_call", "long_call"],
        maxResults: 10
      }
    });
  });

  it("fails closed when required engine context is missing", () => {
    expect(parseStrategyRecommendationsToolArgs({ symbol: "TSLA", outlook: "bullish" })).toMatchObject({
      ok: false,
      error: "invalid_strategy_context"
    });
  });
});

describe("runStrategyRecommendationsTool", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not fabricate recommendations when backend origin is missing", async () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "");

    await expect(
      runStrategyRecommendationsTool(
        {
          symbol: "TSLA",
          outlook: "bullish",
          risk: "moderate",
          horizonDays: 30
        },
        { sessionCookie: "xf_core_session=test" }
      )
    ).resolves.toMatchObject({
      error: "engine_unavailable"
    });
  });
});
