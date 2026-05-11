import { describe, expect, it } from "vitest";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    buildPortfolioDeskHandoffUrls,
    buildPortfolioDeskXchatPrompt,
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
});
