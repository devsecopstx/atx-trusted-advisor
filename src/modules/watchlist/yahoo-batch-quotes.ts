import { createHash } from "node:crypto";

import {
  getRedisClient,
  getRedisQuoteCacheTtlSeconds
} from "@/lib/redis-client";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-data";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function batchQuoteCacheKey(sortedUpperSymbols: string[]): string {
  const h = createHash("sha256").update(sortedUpperSymbols.join(",")).digest("hex").slice(0, 48);
  return `xf:yahoo:batch:v1:${h}`;
}

export async function getYahooBatchQuotes(symbols: string[]): Promise<MarketQuoteSnapshot[]> {
  if (symbols.length === 0) return [];

  try {
    const uniqueSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()))].sort();
    const cacheKey = batchQuoteCacheKey(uniqueSymbols);
    const redis = await getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as unknown;
          if (Array.isArray(parsed) && parsed.every((x) => isRecord(x) && typeof x.symbol === "string")) {
            return parsed as MarketQuoteSnapshot[];
          }
        }
      } catch {
        /* miss or corrupt cache — fetch fresh */
      }
    }

    const quotes: unknown = await getYahooFinance2().quote(uniqueSymbols);

    const results: MarketQuoteSnapshot[] = [];

    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (isRecord(q) && "symbol" in q) {
          results.push(normalizeQuote(q));
        }
      }
    } else if (isRecord(quotes)) {
      results.push(normalizeQuote(quotes));
    }

    if (redis && results.length > 0) {
      try {
        const ttl = getRedisQuoteCacheTtlSeconds();
        await redis.set(cacheKey, JSON.stringify(results), { EX: ttl });
      } catch {
        /* non-fatal */
      }
    }

    return results;
  } catch (error) {
    console.warn("[watchlist/scanner] Yahoo batch quote failed", { symbols, error: String(error) });
    return symbols.map((symbol) => ({
      symbol,
      price: undefined,
      source: "yahoo-finance2",
      disclaimer: "Quote fetch failed",
    }));
  }
}

function normalizeQuote(raw: Record<string, unknown>): MarketQuoteSnapshot {
  const price = typeof raw.regularMarketPrice === "number" ? raw.regularMarketPrice : undefined;

  return {
    symbol: String(raw.symbol || "").toUpperCase(),
    price,
    open: typeof raw.regularMarketOpen === "number" ? raw.regularMarketOpen : undefined,
    dayHigh: typeof raw.regularMarketDayHigh === "number" ? raw.regularMarketDayHigh : undefined,
    dayLow: typeof raw.regularMarketDayLow === "number" ? raw.regularMarketDayLow : undefined,
    previousClose: typeof raw.regularMarketPreviousClose === "number" ? raw.regularMarketPreviousClose : undefined,
    change: typeof raw.regularMarketChange === "number" ? raw.regularMarketChange : undefined,
    changePercent: typeof raw.regularMarketChangePercent === "number" ? raw.regularMarketChangePercent : undefined,
    volume: typeof raw.regularMarketVolume === "number" ? raw.regularMarketVolume : undefined,
    asOf: new Date().toISOString(),
    source: "yahoo-finance2",
    disclaimer: "Market data from Yahoo Finance — delayed.",
  };
}
