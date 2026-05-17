import { beforeEach, describe, expect, it, vi } from "vitest";

const batchMocks = vi.hoisted(() => ({
  getYahooBatchQuotes: vi.fn()
}));

const marketMocks = vi.hoisted(() => ({
  getYahooMarketQuote: vi.fn()
}));

vi.mock("@/modules/watchlist/yahoo-batch-quotes", () => ({
  getYahooBatchQuotes: batchMocks.getYahooBatchQuotes,
  marketQuoteHasLivePrice: (row: { price?: number } | null | undefined) =>
    typeof row?.price === "number" && Number.isFinite(row.price) && row.price > 0
}));

vi.mock("@/modules/xchat/market-data", () => ({
  getYahooMarketQuote: marketMocks.getYahooMarketQuote
}));

import { resolveLiveQuotesForWatchlistSymbols } from "@/modules/watchlist/watchlist-live-quotes";

describe("resolveLiveQuotesForWatchlistSymbols", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns batch quotes keyed by symbol", async () => {
    batchMocks.getYahooBatchQuotes.mockResolvedValueOnce([
      { symbol: "TSLA", price: 422.24, source: "yahoo-finance2" },
      { symbol: "PCAR", price: 110.32, source: "yahoo-finance2" }
    ]);
    const map = await resolveLiveQuotesForWatchlistSymbols(["TSLA", "PCAR"]);
    expect(map.get("TSLA")?.price).toBe(422.24);
    expect(map.get("PCAR")?.price).toBe(110.32);
  });

  it("retries missing symbols with a second batch and single-symbol fallback", async () => {
    batchMocks.getYahooBatchQuotes
      .mockResolvedValueOnce([{ symbol: "TSLA", price: 422.24, source: "yahoo-finance2" }])
      .mockResolvedValueOnce([]);
    marketMocks.getYahooMarketQuote.mockResolvedValueOnce({
      symbol: "PCAR",
      price: 110.32,
      source: "yahoo-finance2"
    });
    const map = await resolveLiveQuotesForWatchlistSymbols(["TSLA", "PCAR"]);
    expect(map.get("TSLA")?.price).toBe(422.24);
    expect(map.get("PCAR")?.price).toBe(110.32);
    expect(marketMocks.getYahooMarketQuote).toHaveBeenCalledWith({ symbol: "PCAR" });
  });
});
