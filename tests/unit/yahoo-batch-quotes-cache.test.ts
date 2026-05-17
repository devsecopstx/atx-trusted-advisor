import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const quoteFn = vi.fn();

const redisQuoteMocks = vi.hoisted(() => ({
  setRedisMarketQuote: vi.fn().mockResolvedValue(undefined),
  tryGetRedisMarketQuote: vi.fn().mockResolvedValue(null)
}));

vi.mock("redis", () => ({
  createClient: vi.fn()
}));

vi.mock("@/modules/yahoo/yahoo-finance-service", () => ({
  getYahooFinance2: () => ({ quote: quoteFn })
}));

vi.mock("@/modules/xchat/market-quote-redis-cache", () => ({
  resolveMarketQuoteRedisTtlSeconds: () => 60,
  setRedisMarketQuote: redisQuoteMocks.setRedisMarketQuote,
  tryGetRedisMarketQuote: redisQuoteMocks.tryGetRedisMarketQuote
}));

import { createClient } from "redis";

import { resetRedisClientForTests } from "@/lib/redis-client";
import {
    getYahooBatchQuotes,
    normalizeYahooBatchQuoteRow
} from "@/modules/watchlist/yahoo-batch-quotes";

describe("getYahooBatchQuotes (Redis cache)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    redisQuoteMocks.setRedisMarketQuote.mockClear();
    redisQuoteMocks.tryGetRedisMarketQuote.mockReset();
    redisQuoteMocks.tryGetRedisMarketQuote.mockResolvedValue(null);
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

  it("requests Yahoo batch quote (validated path when schema passes)", async () => {
    await resetRedisClientForTests();
    delete process.env.REDIS_URL;
    quoteFn.mockResolvedValueOnce([
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
    expect(quoteFn).toHaveBeenCalledTimes(1);
    expect(quoteFn.mock.calls[0]?.[0]).toBe("AAPL");
    expect(quoteFn.mock.calls[0]?.[2]).toBeUndefined();
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
    expect(redisQuoteMocks.setRedisMarketQuote).toHaveBeenCalledWith(
      "AAPL",
      expect.objectContaining({ symbol: "AAPL", price: 199 }),
      60
    );
  });

  it("serves batch from per-symbol Redis cache without Yahoo", async () => {
    redisQuoteMocks.tryGetRedisMarketQuote.mockResolvedValue({
      symbol: "AAPL",
      price: 201,
      source: "yahoo-finance2",
      disclaimer: "cached",
      asOf: "2026-01-01T00:00:00.000Z"
    });
    const out = await getYahooBatchQuotes(["AAPL"]);
    expect(quoteFn).not.toHaveBeenCalled();
    expect(out[0]?.price).toBe(201);
  });

  it("ignores incomplete batch Redis cache and refetches missing symbols", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            symbol: "TSLA",
            price: 250,
            source: "yahoo-finance2",
            disclaimer: "delayed",
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

    quoteFn.mockReset();
    quoteFn
      .mockResolvedValueOnce([
        {
          symbol: "TSLA",
          regularMarketPrice: 251,
          regularMarketOpen: 250,
          regularMarketDayHigh: 252,
          regularMarketDayLow: 249,
          regularMarketPreviousClose: 248,
          regularMarketChange: 3,
          regularMarketChangePercent: 1.2,
          regularMarketVolume: 1000
        },
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
      ])
      .mockResolvedValueOnce({
        symbol: "AAPL",
        regularMarketPrice: 199,
        regularMarketOpen: 198,
        regularMarketDayHigh: 201,
        regularMarketDayLow: 197,
        regularMarketPreviousClose: 196,
        regularMarketChange: 3,
        regularMarketChangePercent: 1.5,
        regularMarketVolume: 1000
      });

    const out = await getYahooBatchQuotes(["AAPL", "TSLA"]);
    expect(out.map((r) => r.symbol).sort()).toEqual(["AAPL", "TSLA"]);
    expect(out.find((r) => r.symbol === "AAPL")?.price).toBe(199);
    expect(quoteFn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not call Yahoo when allowNetwork is false and Redis is unset", async () => {
    await resetRedisClientForTests();
    delete process.env.REDIS_URL;
    quoteFn.mockClear();
    const out = await getYahooBatchQuotes(["AAPL"], { allowNetwork: false });
    expect(quoteFn).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it("normalizeYahooBatchQuoteRow uses postMarketPrice when regularMarketPrice is absent", () => {
    const row = normalizeYahooBatchQuoteRow({
      symbol: "TSLA",
      postMarketPrice: 418.57,
      marketState: "CLOSED"
    });
    expect(row.price).toBe(418.57);
  });

  it("retries per symbol when the outer batch path throws", async () => {
    await resetRedisClientForTests();
    delete process.env.REDIS_URL;
    quoteFn.mockReset();
    quoteFn.mockRejectedValueOnce(new Error("batch exploded"));
    quoteFn.mockResolvedValueOnce({
      symbol: "TSLA",
      regularMarketPrice: 422.24
    });
    const out = await getYahooBatchQuotes(["TSLA"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.price).toBe(422.24);
    expect(quoteFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
