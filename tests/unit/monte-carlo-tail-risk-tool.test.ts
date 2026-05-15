import { describe, expect, it } from "vitest";

import {
    inferMcTierFromDeskProfile,
    parseMonteCarloTailRiskToolArgs
} from "@/modules/xchat/monte-carlo-tail-risk-tool";

describe("monte-carlo-tail-risk-tool", () => {
  it("requires risk tier", () => {
    const parsed = parseMonteCarloTailRiskToolArgs({});
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("invalid_monte_carlo_context");
    }
  });

  it("parses multi-portfolio MC request with IV and drawdown gates", () => {
    const parsed = parseMonteCarloTailRiskToolArgs(
      {
        risk: "conservative",
        portfolioScope: "all",
        horizonDays: 45,
        minIvRankPct: 60,
        maxDrawdownPct: 15,
        pathCount: 10000
      },
      { workspacePortfolioId: "507f1f77bcf86cd799439011" }
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok && "request" in parsed) {
      expect(parsed.request.risk).toBe("conservative");
      expect(parsed.request.horizonDays).toBe(45);
      expect(parsed.request.minIvRankPct).toBe(60);
      expect(parsed.request.maxDrawdownPct).toBe(15);
      expect(parsed.request.pathCount).toBe(10000);
      expect(parsed.request.portfolioIds).toEqual([]);
    }
  });

  it("defaults to workspace portfolio when scope omitted", () => {
    const ws = "507f1f77bcf86cd799439011";
    const parsed = parseMonteCarloTailRiskToolArgs(
      { risk: "moderate", horizonDays: 30 },
      { workspacePortfolioId: ws }
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok && "request" in parsed) {
      expect(parsed.request.portfolioIds).toEqual([ws]);
    }
  });

  it("maps desk risk profiles to MC tiers", () => {
    expect(inferMcTierFromDeskProfile("conservative")).toBe("conservative");
    expect(inferMcTierFromDeskProfile("growth")).toBe("aggressive");
    expect(inferMcTierFromDeskProfile("balanced")).toBe("moderate");
  });
});
