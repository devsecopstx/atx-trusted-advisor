import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as liveQuotes from "@/modules/watchlist/watchlist-live-quotes";
import * as yahooLookup from "@/modules/watchlist/yahoo-symbol-lookup";
import { postProcessWatchlistMarkdown } from "@/modules/xchat/watchlist-response-postprocess";

describe("postProcessWatchlistMarkdown", () => {
  beforeEach(() => {
    vi.spyOn(liveQuotes, "resolveLiveQuotesForWatchlistSymbols").mockResolvedValue(
      new Map([
        [
          "AAPL",
          {
            symbol: "AAPL",
            price: 200,
            change: 2,
            changePercent: 1,
            source: "yahoo-finance2",
            disclaimer: "test"
          }
        ]
      ])
    );
    vi.spyOn(yahooLookup, "lookupSymbols").mockResolvedValue(
      new Map([
        [
          "AAPL",
          {
            symbol: "AAPL",
            price: 200,
            change: 2,
            changePercent: 1,
            source: "yahoo-finance2" as const,
            disclaimer: "test"
          }
        ]
      ])
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a full watchlist report table from structured rows", async () => {
    const out = await postProcessWatchlistMarkdown({
      rawMarkdown: "legacy",
      watchlistName: "Hot names",
      structuredRows: [
        {
          symbol: "AAPL",
          spotPriceDisplay: "$199.00",
          lineType: "Stock",
          strategy: "balanced",
          quantity: 0,
          targetEntryNotional100xUsdDisplay: "$19,900.00",
          targetEntryDisplay: "$180.00",
          entryPrice: 180
        }
      ],
      portfolioId: "507f1f77bcf86cd799439011"
    });

    expect(out).toContain("### Watchlist — Hot names");
    expect(out).toContain("| Symbol | Type | Strategy | Qty |");
    expect(out).toContain("| AAPL |");
    expect(out).toContain("$20,000");
    expect(out).toContain("xOptions");
  });

  it("fills Spot from resolveLiveQuotesForWatchlistSymbols when tool rows lack prices", async () => {
    vi.mocked(liveQuotes.resolveLiveQuotesForWatchlistSymbols).mockResolvedValueOnce(
      new Map([
        [
          "TSLA",
          {
            symbol: "TSLA",
            price: 422.24,
            change: 1.2,
            changePercent: 0.3,
            source: "yahoo-finance2",
            disclaimer: "test"
          }
        ]
      ])
    );
    vi.mocked(yahooLookup.lookupSymbols).mockResolvedValueOnce(new Map());
    const out = await postProcessWatchlistMarkdown({
      rawMarkdown: "legacy",
      watchlistName: "Desk",
      structuredRows: [
        {
          symbol: "TSLA",
          spotPriceDisplay: "—",
          targetEntryNotional100xUsdDisplay: "—"
        }
      ]
    });
    expect(liveQuotes.resolveLiveQuotesForWatchlistSymbols).toHaveBeenCalled();
    expect(out).toContain("| TSLA |");
    expect(out).toContain("$422.24");
    expect(out).toContain("$42,224");
  });
});
