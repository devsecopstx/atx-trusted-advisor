import { describe, expect, it } from "vitest";

import {
  formatDirectMarketQuoteMarkdown,
  type MarketQuoteSnapshot
} from "@/modules/xchat/market-data";

describe("formatDirectMarketQuoteMarkdown", () => {
  it("renders price, change, and citation chip", () => {
    const snap: MarketQuoteSnapshot = {
      symbol: "TSLA",
      shortName: "Tesla, Inc.",
      price: 411.44,
      previousClose: 422.24,
      change: -10.8,
      changePercent: -2.56,
      source: "yahoo-finance2",
      disclaimer: "delayed"
    };
    const md = formatDirectMarketQuoteMarkdown(snap);
    expect(md).toContain("## TSLA — Tesla, Inc.");
    expect(md).toContain("**Last:** $411.44");
    expect(md).toContain("-10.80 (-2.56%)");
    expect(md).toContain("[@citation:market_quote|Yahoo Finance]");
  });
});
