import { createHash } from "node:crypto";

import {
    getRedisClientForPlane,
    getRedisQuoteCacheTtlSeconds
} from "@/lib/redis-client";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-data";
import {
    resolveMarketQuoteRedisTtlSeconds,
    setRedisMarketQuote,
    tryGetRedisMarketQuote
} from "@/modules/xchat/market-quote-redis-cache";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function batchQuoteCacheKey(sortedUpperSymbols: string[]): string {
  const h = createHash("sha256").update(sortedUpperSymbols.join(",")).digest("hex").slice(0, 48);
  return `xf:yahoo:batch:v1:${h}`;
}

export function batchQuoteCacheCoversSymbols(
  cached: MarketQuoteSnapshot[],
  requested: readonly string[]
): boolean {
  const have = new Set(cached.map((row) => row.symbol.trim().toUpperCase()));
  return requested.every((sym) => have.has(sym.trim().toUpperCase()));
}

export function marketQuoteHasLivePrice(snapshot: MarketQuoteSnapshot | null | undefined): boolean {
  return typeof snapshot?.price === "number" && Number.isFinite(snapshot.price) && snapshot.price > 0;
}

function rowsFromYahooQuotePayload(quotes: unknown): MarketQuoteSnapshot[] {
  const rows: MarketQuoteSnapshot[] = [];
  if (Array.isArray(quotes)) {
    for (const q of quotes) {
      if (isRecord(q) && "symbol" in q) {
        rows.push(normalizeYahooBatchQuoteRow(q));
      }
    }
  } else if (isRecord(quotes)) {
    rows.push(normalizeYahooBatchQuoteRow(quotes));
  }
  return rows;
}

async function fetchYahooQuoteRowsForSymbols(symbols: string[], logLabel: string): Promise<MarketQuoteSnapshot[]> {
  if (symbols.length === 0) {
    return [];
  }
  const yf = getYahooFinance2();
  const query = symbols.length === 1 ? symbols[0]! : symbols;
  const quotes = await yahooQuoteWithValidationFallback(yf, query, logLabel);
  return rowsFromYahooQuotePayload(quotes);
}

export type YahooBatchQuotesOptions = {
  /** When false, only Redis (if configured) is read — no live Yahoo call on cache miss. */
  allowNetwork?: boolean;
};

export async function getYahooBatchQuotes(
  symbols: string[],
  opts?: YahooBatchQuotesOptions
): Promise<MarketQuoteSnapshot[]> {
  if (symbols.length === 0) return [];
  const allowNetwork = opts?.allowNetwork !== false;

  try {
    const uniqueSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()))].sort();
    const cacheKey = batchQuoteCacheKey(uniqueSymbols);
    const redis = await getRedisClientForPlane("cache");
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((x) => isRecord(x) && typeof x.symbol === "string") &&
            batchQuoteCacheCoversSymbols(parsed as MarketQuoteSnapshot[], uniqueSymbols) &&
            (parsed as MarketQuoteSnapshot[]).every((row) => marketQuoteHasLivePrice(row))
          ) {
            return parsed as MarketQuoteSnapshot[];
          }
        }
      } catch {
        /* miss or corrupt cache — fetch fresh */
      }
    }

    const fromPerSymbolCache: MarketQuoteSnapshot[] = [];
    const symbolsNeedingNetwork: string[] = [];
    if (allowNetwork) {
      for (const sym of uniqueSymbols) {
        const cachedRow = await tryGetRedisMarketQuote(sym);
        if (cachedRow && marketQuoteHasLivePrice(cachedRow)) {
          fromPerSymbolCache.push(cachedRow);
        } else {
          symbolsNeedingNetwork.push(sym);
        }
      }
    }

    if (!allowNetwork) {
      return fromPerSymbolCache;
    }

    const bySymbol = new Map<string, MarketQuoteSnapshot>();
    for (const row of fromPerSymbolCache) {
      bySymbol.set(row.symbol.toUpperCase(), row);
    }

    if (symbolsNeedingNetwork.length > 0) {
      const batchRows = await fetchYahooQuoteRowsChunked(symbolsNeedingNetwork, "batch quote");
      for (const row of batchRows) {
        if (marketQuoteHasLivePrice(row)) {
          bySymbol.set(row.symbol.toUpperCase(), row);
        }
      }

      const stillMissing = symbolsNeedingNetwork.filter((sym) => !bySymbol.has(sym));
      if (stillMissing.length > 0) {
        for (const sym of stillMissing) {
          try {
            const singles = await fetchYahooQuoteRowsForSymbols([sym], `single quote ${sym}`);
            const row = singles.find((r) => r.symbol.toUpperCase() === sym);
            if (row && marketQuoteHasLivePrice(row)) {
              bySymbol.set(sym, row);
            }
          } catch (singleErr) {
            console.warn("[watchlist/scanner] Yahoo single-symbol quote failed", {
              symbol: sym,
              error: String(singleErr)
            });
          }
        }
      }
    }

    const results = uniqueSymbols
      .map((sym) => bySymbol.get(sym))
      .filter((row): row is MarketQuoteSnapshot => row != null);

    const quoteTtl = resolveMarketQuoteRedisTtlSeconds();
    await Promise.all(
      results.filter((row) => marketQuoteHasLivePrice(row)).map((row) => setRedisMarketQuote(row.symbol, row, quoteTtl))
    );

    if (
      redis &&
      results.length > 0 &&
      batchQuoteCacheCoversSymbols(results, uniqueSymbols) &&
      results.every((row) => marketQuoteHasLivePrice(row))
    ) {
      try {
        const ttl = getRedisQuoteCacheTtlSeconds();
        await redis.set(cacheKey, JSON.stringify(results), { EX: ttl });
      } catch {
        /* non-fatal */
      }
    }

    return results;
  } catch (error) {
    if (!allowNetwork) {
      return [];
    }
    console.warn("[watchlist/scanner] Yahoo batch quote failed; retrying per symbol", {
      symbols,
      error: String(error)
    });
    const bySymbol = new Map<string, MarketQuoteSnapshot>();
    for (const sym of [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]) {
      try {
        const singles = await fetchYahooQuoteRowsForSymbols([sym], `batch-fallback ${sym}`);
        const row = singles.find((r) => r.symbol.toUpperCase() === sym);
        if (row && marketQuoteHasLivePrice(row)) {
          bySymbol.set(sym, row);
          void setRedisMarketQuote(sym, row, resolveMarketQuoteRedisTtlSeconds());
        }
      } catch (singleErr) {
        console.warn("[watchlist/scanner] Yahoo per-symbol fallback failed", {
          symbol: sym,
          error: String(singleErr)
        });
      }
    }
    return symbols
      .map((s) => bySymbol.get(s.trim().toUpperCase()))
      .filter((row): row is MarketQuoteSnapshot => row != null);
  }
}

/** Yahoo `quote()` is more reliable in smaller chunks on serverless (timeouts / rate limits). */
const YAHOO_BATCH_QUOTE_CHUNK_SIZE = 8;

export async function fetchYahooQuoteRowsChunked(
  symbols: string[],
  logLabel: string
): Promise<MarketQuoteSnapshot[]> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  if (unique.length <= YAHOO_BATCH_QUOTE_CHUNK_SIZE) {
    return fetchYahooQuoteRowsForSymbols(unique, logLabel);
  }
  const rows: MarketQuoteSnapshot[] = [];
  for (let i = 0; i < unique.length; i += YAHOO_BATCH_QUOTE_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + YAHOO_BATCH_QUOTE_CHUNK_SIZE);
    const chunkRows = await fetchYahooQuoteRowsForSymbols(chunk, `${logLabel} chunk`);
    rows.push(...chunkRows);
  }
  return rows;
}

function resolveYahooQuoteLastPrice(raw: Record<string, unknown>): number | undefined {
  const candidates = [raw.regularMarketPrice, raw.postMarketPrice, raw.preMarketPrice];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return undefined;
}

/** Normalizes a single Yahoo `quote()` row — exported for unit tests. */
export function normalizeYahooBatchQuoteRow(raw: Record<string, unknown>): MarketQuoteSnapshot {
  const price = resolveYahooQuoteLastPrice(raw);
  const toStr = (k: string): string | undefined =>
    typeof raw[k] === "string" && String(raw[k]).trim() ? String(raw[k]).trim() : undefined;
  const toNum = (k: string): number | undefined =>
    typeof raw[k] === "number" && Number.isFinite(raw[k] as number) ? (raw[k] as number) : undefined;

  return {
    symbol: String(raw.symbol || "").toUpperCase(),
    shortName: toStr("shortName"),
    longName: toStr("longName"),
    price,
    open: typeof raw.regularMarketOpen === "number" ? raw.regularMarketOpen : undefined,
    dayHigh: typeof raw.regularMarketDayHigh === "number" ? raw.regularMarketDayHigh : undefined,
    dayLow: typeof raw.regularMarketDayLow === "number" ? raw.regularMarketDayLow : undefined,
    previousClose: typeof raw.regularMarketPreviousClose === "number" ? raw.regularMarketPreviousClose : undefined,
    change: typeof raw.regularMarketChange === "number" ? raw.regularMarketChange : undefined,
    changePercent: typeof raw.regularMarketChangePercent === "number" ? raw.regularMarketChangePercent : undefined,
    volume: typeof raw.regularMarketVolume === "number" ? raw.regularMarketVolume : undefined,
    fiftyTwoWeekHigh: toNum("fiftyTwoWeekHigh"),
    fiftyTwoWeekLow: toNum("fiftyTwoWeekLow"),
    asOf: new Date().toISOString(),
    source: "yahoo-finance2",
    disclaimer: "Market data from Yahoo Finance — delayed."
  };
}
