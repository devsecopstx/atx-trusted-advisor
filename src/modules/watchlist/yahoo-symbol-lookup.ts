import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-data";

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  data: SymbolLookupResult;
};

const lookupCache = new Map<string, CacheEntry>();

export const LOOKUP_ROUTE = "yahoo-finance2";

export type SymbolLookupResult = {
  symbol: string;
  companyName?: string;
  companyOverview?: string;
  logoUrl?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  low?: number;
  high?: number;
  currency?: string;
  source: typeof LOOKUP_ROUTE;
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function getCached(symbol: string): SymbolLookupResult | null {
  const cached = lookupCache.get(symbol);
  if (!cached) {
    return null;
  }
  if (Date.now() >= cached.expiresAt) {
    lookupCache.delete(symbol);
    return null;
  }
  return cached.data;
}

function setCached(symbol: string, data: SymbolLookupResult): void {
  lookupCache.set(symbol, {
    data,
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS
  });
}

function snapshotToLookup(symbol: string, snap: MarketQuoteSnapshot): SymbolLookupResult {
  return {
    symbol,
    price: snap.price,
    change: snap.change,
    changePercent: snap.changePercent,
    volume: snap.volume,
    low: snap.dayLow,
    high: snap.dayHigh,
    currency: snap.currency,
    source: LOOKUP_ROUTE
  };
}

/**
 * Resolves live quote fields using **one** Yahoo batch call (+ Redis cache in `getYahooBatchQuotes`)
 * instead of 2×N parallel `quote`+`quoteSummary` calls — reduces server-side Yahoo rate limiting.
 * Rich fields (`companyOverview`, `logoUrl`) are omitted unless served from the in-memory cache.
 */
export async function lookupSymbols(symbols: string[]): Promise<Map<string, SymbolLookupResult>> {
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map(normalizeSymbol)
        .filter((symbol) => symbol.length > 0)
    )
  );
  const result = new Map<string, SymbolLookupResult>();

  const needBatch: string[] = [];
  for (const symbol of normalizedSymbols) {
    const cached = getCached(symbol);
    if (cached) {
      result.set(symbol, cached);
    } else {
      needBatch.push(symbol);
    }
  }

  if (needBatch.length > 0) {
    const snapshots = await getYahooBatchQuotes(needBatch);
    const bySymbol = new Map(snapshots.map((s) => [s.symbol.toUpperCase(), s]));
    for (const symbol of needBatch) {
      const snap = bySymbol.get(symbol);
      if (!snap) {
        continue;
      }
      const lookup = snapshotToLookup(symbol, snap);
      setCached(symbol, lookup);
      result.set(symbol, lookup);
    }
  }

  return result;
}
