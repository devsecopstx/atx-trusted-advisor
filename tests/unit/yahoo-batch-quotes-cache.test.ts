import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const quoteFn = vi.fn();

vi.mock("redis", () => ({
  createClient: vi.fn()
}));

vi.mock("@/modules/yahoo/yahoo-finance-service", () => ({
  getYahooFinance2: () => ({ quote: quoteFn })
}));

import { createClient } from "redis";

import { resetRedisClientForTests } from "@/lib/redis-client";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";

describe("getYahooBatchQuotes (Redis cache)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRedisClientForTests();
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.REDIS_QUOTE_CACHE_TTL_SECONDS = "60";

    const get = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            symbol: "AAPL",
            price: 200,
            source: "yahoo-finance2",
            disclaimer: "Market data from Yahoo Finance — delayed.",
            asOf: "2026-01-01T00:00:00.000Z"
          }
        ])
      );
    const set = vi.fn().mockResolvedValue("OK");

    vi.mocked(createClient).mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      get,
      set,
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG")
    } as never);

    quoteFn.mockResolvedValue([
      {
        symbol: "AAPL",
        regularMarketPrice: 199,
        regularMarketOpen: 198,
        regularMarketDayHigh: 201,
        regularMarketDayLow: 197,
        regularMarketPreviousClose: 196,
        regularMarketChange: 3,
        regularMarketChangePercent: 1.5,
        regularMarketVolume: 1000
      }
    ]);
  });

  afterEach(async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_QUOTE_CACHE_TTL_SECONDS;
    await resetRedisClientForTests();
  });

  it("retries Yahoo batch with validateResult: false when schema validation fails", async () => {
    await resetRedisClientForTests();
    delete process.env.REDIS_URL;
    quoteFn
      .mockRejectedValueOnce(new Error("FailedYahooValidationError: Failed validation: #/definitions/QuoteResponseArray"))
      .mockResolvedValueOnce([
        {
          symbol: "AAPL",
          regularMarketPrice: 222,
          regularMarketOpen: 220,
          regularMarketDayHigh: 223,
          regularMarketDayLow: 219,
          regularMarketPreviousClose: 218,
          regularMarketChange: 4,
          regularMarketChangePercent: 1.8,
          regularMarketVolume: 2000
        }
      ]);
    const out = await getYahooBatchQuotes(["AAPL"]);
    expect(quoteFn).toHaveBeenCalledTimes(2);
    expect(quoteFn.mock.calls[1]).toEqual([["AAPL"], {}, { validateResult: false }]);
    expect(out[0]?.price).toBe(222);
  });

  it("uses Yahoo once then serves Redis on second identical batch", async () => {
    const first = await getYahooBatchQuotes(["AAPL"]);
    const second = await getYahooBatchQuotes(["AAPL"]);

    expect(quoteFn).toHaveBeenCalledTimes(1);
    expect(first[0]?.price).toBe(199);
    expect(second[0]?.price).toBe(200);

    const redisMock = vi.mocked(createClient).mock.results[0]?.value as {
      set: ReturnType<typeof vi.fn>;
    };
    expect(redisMock.set).toHaveBeenCalled();
    const setArgs = redisMock.set.mock.calls[0];
    expect(setArgs?.[2]).toEqual({ EX: 60 });
  });
});
