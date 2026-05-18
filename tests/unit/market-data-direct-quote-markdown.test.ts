import { describe, expect, it } from "vitest";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { extractXchatFooterCitations } from "@/lib/xchat-citations";
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
    expect(md).toContain("[[xchat-cite:market_quote|Yahoo Finance|TSLA]]");
    expect(md).not.toContain("XF_CITE:");
    expect(md).not.toMatch(/\{"slug":"market_quote"/);

    const { body, chips } = extractXchatFooterCitations(md);
    expect(chips).toEqual([{ slug: "market_quote", label: "Yahoo Finance", symbol: "TSLA" }]);
    const preprocessed = preprocessXchatMarkdown(body);
    expect(preprocessed).not.toContain("[[xchat-cite:");
    expect(preprocessed).not.toMatch(/\{"slug":"market_quote"/);
  });
});
