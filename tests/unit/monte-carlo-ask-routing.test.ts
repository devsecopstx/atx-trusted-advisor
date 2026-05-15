import { describe, expect, it } from "vitest";

import {
    buildMonteCarloToolArgsFromNl,
    isMultiPortfolioMonteCarloScope,
    parseMonteCarloAskNlParams,
    shouldRunMonteCarloTailRiskDirect
} from "@/modules/xchat/monte-carlo-ask-routing";

const USER_PROMPT =
  "Run a Monte Carlo on my 45-day covered-call wheel across my three portfolios with current IV rank > 60 % and max 15 % drawdown";

describe("monte-carlo-ask-routing", () => {
  it("detects Monte Carlo direct intent", () => {
    expect(shouldRunMonteCarloTailRiskDirect(USER_PROMPT)).toBe(true);
  });

  it("detects multi-portfolio scope without clarification", () => {
    expect(isMultiPortfolioMonteCarloScope(USER_PROMPT)).toBe(true);
  });

  it("parses NL params from quant-trader wheel prompt", () => {
    const parsed = parseMonteCarloAskNlParams(USER_PROMPT);
    expect(parsed).toEqual({
      horizonDays: 45,
      minIvRankPct: 60,
      maxDrawdownPct: 15,
      portfolioScope: "all",
      perPortfolioRisk: true,
      mentionedPortfolioCount: 3
    });
  });

  it("builds tool args with portfolioScope all and perPortfolioRisk", () => {
    const nl = parseMonteCarloAskNlParams(USER_PROMPT);
    expect(nl).not.toBeNull();
    expect(buildMonteCarloToolArgsFromNl(nl!)).toEqual({
      portfolioScope: "all",
      horizonDays: 45,
      minIvRankPct: 60,
      maxDrawdownPct: 15,
      risk: "moderate",
      perPortfolioRisk: true
    });
  });

  it("returns null when message lacks Monte Carlo intent", () => {
    expect(parseMonteCarloAskNlParams("show my watchlist")).toBeNull();
  });
});
