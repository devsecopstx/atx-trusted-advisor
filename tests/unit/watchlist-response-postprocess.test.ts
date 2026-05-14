import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as yahooLookup from "@/modules/watchlist/yahoo-symbol-lookup";
import { postProcessWatchlistMarkdown } from "@/modules/xchat/watchlist-response-postprocess";

describe("postProcessWatchlistMarkdown", () => {
  beforeEach(() => {
    vi.spyOn(yahooLookup, "lookupSymbols").mockResolvedValue(
      new Map([
        [
          "AAPL",
          {
            symbol: "AAPL",
            price: 200,
            change: 2,
            changePercent: 1,
            source: "yahoo-finance2" as const
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
    expect(out).toContain("$19,900.00");
    expect(out).toContain("xOptions");
  });
});
