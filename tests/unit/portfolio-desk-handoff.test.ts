import { describe, expect, it } from "vitest";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    buildPortfolioDeskHandoffUrls,
    buildPortfolioDeskXchatPrompt,
    buildPortfolioOptionsChainBuilderHref,
    buildPortfoliosWorkspaceXchatPrompt,
    buildPositionDeskHandoffUrls,
    resolvePortfolioDeskFocusSymbol
} from "@/lib/portfolio/portfolio-desk-handoff";

const positions: SerializablePosition[] = [
  { _id: "1", type: "stock", symbol: "RDW", shares: 1000, purchasePrice: 10 },
  { _id: "2", type: "stock", symbol: "CIFR", shares: 100, purchasePrice: 5 }
];

describe("portfolio-desk-handoff", () => {
  it("prefers explicit focus symbol over largest book", () => {
    expect(resolvePortfolioDeskFocusSymbol(positions, "cifr")).toBe("CIFR");
  });

  it("falls back to largest stock book", () => {
    expect(resolvePortfolioDeskFocusSymbol(positions, null)).toBe("RDW");
  });

  it("builds scoped desk urls with symbol", () => {
    const urls = buildPortfolioDeskHandoffUrls({
      portfolioIdHex: "507f1f77bcf86cd799439011",
      accountIdHex: "507f1f77bcf86cd799439012",
      accountName: "Individual - TOD",
      positions,
      focusSymbol: "RDW"
    });
    expect(urls.symbol).toBe("RDW");
    expect(urls.xoptionsHref).toContain("symbol=RDW");
    expect(urls.xchatHref).toContain("item=composer");
    expect(urls.xchatHref).toContain("portfolioId=507f1f77bcf86cd799439011");
  });

  it("builds xchat prompt with account and symbol", () => {
    const prompt = buildPortfolioDeskXchatPrompt({
      accountName: "Individual - TOD",
      portfolioName: "Family book",
      symbol: "RDW"
    });
    expect(prompt).toContain("Individual - TOD");
    expect(prompt).toContain("RDW");
  });

  it("builds portfolios workspace prompt with book name", () => {
    const prompt = buildPortfoliosWorkspaceXchatPrompt("Family book");
    expect(prompt).toContain("Family book");
    expect(prompt).toContain("defined-risk");
  });

  it("builds position-scoped desk urls", () => {
    const urls = buildPositionDeskHandoffUrls({
      portfolioIdHex: "507f1f77bcf86cd799439011",
      accountIdHex: "507f1f77bcf86cd799439012",
      symbol: "tsla"
    });
    expect(urls.symbol).toBe("TSLA");
    expect(urls.fullChainHref).toContain("/xoptions/full-chain?");
    expect(urls.fullChainHref).toContain("symbol=TSLA");
    expect(urls.xchatHref).toContain("rail=xchat");
    expect(urls.xchatHref).toContain("item=composer");
  });

  it("builds options chain builder handoff with step 4 and contract id", () => {
    const href = buildPortfolioOptionsChainBuilderHref({
      portfolioIdHex: "507f1f77bcf86cd799439011",
      accountIdHex: "507f1f77bcf86cd799439012",
      symbol: "RDW",
      expiration: "2026-07-18",
      side: "put",
      strike: 12
    });
    expect(href).toContain("step=4");
    expect(href).toContain("symbol=RDW");
    expect(href).toContain("contractId=RDW");
  });
});
