import { describe, expect, it } from "vitest";

import { buildPortfolioOptionsChainBuilderHref } from "@/lib/portfolio/portfolio-desk-handoff";

describe("buildPortfolioOptionsChainBuilderHref", () => {
  it("builds xOptions step 4 href with desk scope and contract id", () => {
    const href = buildPortfolioOptionsChainBuilderHref({
      portfolioIdHex: "507f1f77bcf86cd799439011",
      accountIdHex: "507f1f77bcf86cd799439012",
      symbol: "tsla",
      expiration: "2026-06-20",
      side: "call",
      strike: 250
    });
    expect(href).toContain("/xoptions?");
    expect(href).toContain("step=4");
    expect(href).toContain("symbol=TSLA");
    expect(href).toContain("portfolioId=507f1f77bcf86cd799439011");
    expect(href).toContain("accountId=507f1f77bcf86cd799439012");
    expect(href).toContain("contractId=");
    expect(href).toMatch(/contractId=TSLA\d{6}C\d{8}/);
  });

  it("returns /xoptions for invalid symbol", () => {
    expect(
      buildPortfolioOptionsChainBuilderHref({
        portfolioIdHex: "507f1f77bcf86cd799439011",
        accountIdHex: "507f1f77bcf86cd799439012",
        symbol: "!!!",
        expiration: "2026-06-20",
        side: "put",
        strike: 100
      })
    ).toBe("/xoptions");
  });
});
