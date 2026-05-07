import { resolveCachedEquityLogoUrl } from "@/modules/watchlist/symbol-logo-cache";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-data";

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
/** Bumps in-memory cache when lookup payload shape changes (e.g. logo resolution). */
const LOOKUP_CACHE_KEY_VER = "v5";

type CacheEntry = {
  expiresAt: number;
  data: SymbolLookupResult;
};

const lookupCache = new Map<string, CacheEntry>();

export { defaultWatchlistLogoUrl, equityLogoKeyRoot } from "./equity-logo-url";

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
  /** Trailing 52-week range from Yahoo quote when available. */
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  currency?: string;
  source: typeof LOOKUP_ROUTE;
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function lookupCacheKey(symbol: string): string {
  return `${LOOKUP_CACHE_KEY_VER}:${symbol}`;
}

function getCached(symbol: string): SymbolLookupResult | null {
  const cached = lookupCache.get(lookupCacheKey(symbol));
  if (!cached) {
    return null;
  }
  if (Date.now() >= cached.expiresAt) {
    lookupCache.delete(lookupCacheKey(symbol));
    return null;
  }
  return cached.data;
}

function setCached(symbol: string, data: SymbolLookupResult): void {
  lookupCache.set(lookupCacheKey(symbol), {
    data,
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS
  });
}

function snapshotToLookupBase(symbol: string, snap: MarketQuoteSnapshot): SymbolLookupResult {
  const name =
    [snap.shortName, snap.longName].find((s) => typeof s === "string" && s.trim().length > 0)?.trim() ?? undefined;
  return {
    symbol,
    companyName: name,
    price: snap.price,
    change: snap.change,
    changePercent: snap.changePercent,
    volume: snap.volume,
    low: snap.dayLow,
    high: snap.dayHigh,
    fiftyTwoWeekLow: snap.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: snap.fiftyTwoWeekHigh,
    currency: snap.currency,
    source: LOOKUP_ROUTE
  };
}

export type LookupSymbolsOptions = {
  allowNetwork?: boolean;
};

/**
 * Resolves live quote fields using **one** Yahoo batch call (+ Redis cache in `getYahooBatchQuotes`)
 * instead of 2×N parallel `quote`+`quoteSummary` calls — reduces server-side Yahoo rate limiting.
 * Rich fields (`companyOverview`) are omitted unless served from the in-memory cache.
 * `logoUrl` is filled via {@link resolveCachedEquityLogoUrl} (Fool CDN, Redis + memory keyed by equity root).
 */
export async function lookupSymbols(
  symbols: string[],
  opts?: LookupSymbolsOptions
): Promise<Map<string, SymbolLookupResult>> {
  const allowNetwork = opts?.allowNetwork !== false;
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
      let row = cached;
      if (!row.logoUrl) {
        const logoUrl = await resolveCachedEquityLogoUrl(symbol);
        if (logoUrl) {
          row = { ...cached, logoUrl };
          setCached(symbol, row);
        }
      }
      result.set(symbol, row);
    } else {
      needBatch.push(symbol);
    }
  }

  if (needBatch.length > 0) {
    const snapshots = await getYahooBatchQuotes(needBatch, { allowNetwork });
    const bySymbol = new Map(snapshots.map((s) => [s.symbol.toUpperCase(), s]));
    for (const symbol of needBatch) {
      const snap = bySymbol.get(symbol);
      if (!snap) {
        continue;
      }
      const base = snapshotToLookupBase(symbol, snap);
      const logoUrl = await resolveCachedEquityLogoUrl(symbol);
      const lookup: SymbolLookupResult = { ...base, ...(logoUrl ? { logoUrl } : {}) };
      setCached(symbol, lookup);
      result.set(symbol, lookup);
    }
  }

  return result;
}
