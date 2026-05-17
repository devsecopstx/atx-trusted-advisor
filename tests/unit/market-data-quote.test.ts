import { describe, expect, it, vi } from "vitest";

import {
    getYahooMarketQuote,
    MarketQuoteUnavailableError
} from "@/modules/xchat/market-data";

const batchMocks = vi.hoisted(() => ({
  getYahooBatchQuotes: vi.fn(),
  marketQuoteHasLivePrice: vi.fn((row: { price?: number } | null | undefined) =>
    typeof row?.price === "number" && Number.isFinite(row.price) && row.price > 0
  )
}));

const redisMocks = vi.hoisted(() => ({
  tryGetRedisMarketQuote: vi.fn(async () => null)
}));

vi.mock("@/modules/watchlist/yahoo-batch-quotes", () => ({
  getYahooBatchQuotes: batchMocks.getYahooBatchQuotes,
  marketQuoteHasLivePrice: batchMocks.marketQuoteHasLivePrice
}));

vi.mock("@/modules/xchat/market-quote-redis-cache", () => ({
  tryGetRedisMarketQuote: redisMocks.tryGetRedisMarketQuote
}));

describe("getYahooMarketQuote", () => {
  it("returns live batch row for symbol", async () => {
    batchMocks.getYahooBatchQuotes.mockResolvedValueOnce([
      { symbol: "TSLA", price: 422.24, source: "yahoo-finance2" }
    ]);
    const snap = await getYahooMarketQuote({ symbol: "TSLA" });
    expect(snap.symbol).toBe("TSLA");
    expect(snap.price).toBe(422.24);
    expect(batchMocks.getYahooBatchQuotes).toHaveBeenCalledWith(["TSLA"]);
  });

  it("throws when batch returns no live price", async () => {
    batchMocks.getYahooBatchQuotes.mockResolvedValueOnce([
      { symbol: "TSLA", price: undefined, source: "yahoo-finance2", disclaimer: "Quote fetch failed" }
    ]);
    await expect(getYahooMarketQuote({ symbol: "TSLA" })).rejects.toBeInstanceOf(MarketQuoteUnavailableError);
  });

  it("uses redis cache when price is live", async () => {
    redisMocks.tryGetRedisMarketQuote.mockResolvedValueOnce({
      symbol: "AAPL",
      price: 190.5,
      source: "yahoo-finance2"
    });
    const snap = await getYahooMarketQuote({ symbol: "AAPL" });
    expect(snap.price).toBe(190.5);
    expect(batchMocks.getYahooBatchQuotes).not.toHaveBeenCalled();
  });
});
