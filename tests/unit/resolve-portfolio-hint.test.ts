import { describe, expect, it } from "vitest";

import {
    extractPortfolioHintFromMessage,
    parseAccountHintFromToolArgs,
    parsePortfolioHintFromToolArgs
} from "@/modules/price-alerts/resolve-portfolio-hint";

describe("parsePortfolioHintFromToolArgs", () => {
  it("prefers portfolioHint then portfolioName then inPortfolio", () => {
    expect(parsePortfolioHintFromToolArgs({ portfolioHint: " myPortfolio " })).toBe("myPortfolio");
    expect(parsePortfolioHintFromToolArgs({ portfolioName: "Growth" })).toBe("Growth");
    expect(parsePortfolioHintFromToolArgs({ inPortfolio: "Roth" })).toBe("Roth");
    expect(parsePortfolioHintFromToolArgs({})).toBeUndefined();
  });
});

describe("parseAccountHintFromToolArgs", () => {
  it("reads accountHint and inAccount", () => {
    expect(parseAccountHintFromToolArgs({ accountHint: " Individual TOD " })).toBe("Individual TOD");
    expect(parseAccountHintFromToolArgs({ inAccount: "Joint" })).toBe("Joint");
  });
});

describe("extractPortfolioHintFromMessage", () => {
  it("extracts camelCase portfolio names like myPortfolio", () => {
    expect(
      extractPortfolioHintFromMessage(
        "Review my Individual TOD holdings in myPortfolio, starting with ON."
      )
    ).toBe("myPortfolio");
  });

  it("extracts Individual TOD account label", () => {
    expect(
      extractPortfolioHintFromMessage("Summarize Individual TOD holdings for ON")
    ).toBe("Individual TOD");
  });
});