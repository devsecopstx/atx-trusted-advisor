import yahooFinance from "yahoo-finance2";

const TICKER_LOGOS_CDN = "https://cdn.tickerlogos.com";
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

function toTickerLogoUrl(website: string | undefined): string | undefined {
  if (!website) {
    return undefined;
  }
  try {
    const hostname = new URL(
      website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`
    ).hostname.replace(/^www\./, "");
    if (!hostname) {
      return undefined;
    }
    return `${TICKER_LOGOS_CDN}/${hostname}`;
  } catch {
    return undefined;
  }
}

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

async function fetchSymbolLookup(symbol: string): Promise<SymbolLookupResult> {
  const quote = (await yahooFinance.quote(symbol)) as Record<string, unknown>;
  const summary = (await yahooFinance.quoteSummary(symbol, {
    modules: ["summaryProfile"]
  })) as Record<string, unknown>;
  const summaryProfile = (summary["summaryProfile"] as Record<string, unknown> | undefined) ?? undefined;
  const companyOverview =
    (summaryProfile?.["longBusinessSummary"] as string | undefined) ??
    undefined;
  const website = (summaryProfile?.["website"] as string | undefined) ?? undefined;
  const logoUrl = toTickerLogoUrl(website);

  return {
    symbol,
    companyName: (quote["longName"] as string | undefined) ?? (quote["shortName"] as string | undefined),
    companyOverview,
    logoUrl,
    price: quote["regularMarketPrice"] as number | undefined,
    change: quote["regularMarketChange"] as number | undefined,
    changePercent: quote["regularMarketChangePercent"] as number | undefined,
    volume: quote["regularMarketVolume"] as number | undefined,
    low: quote["regularMarketDayLow"] as number | undefined,
    high: quote["regularMarketDayHigh"] as number | undefined,
    currency: quote["currency"] as string | undefined,
    source: LOOKUP_ROUTE
  };
}

export async function lookupSymbols(symbols: string[]): Promise<Map<string, SymbolLookupResult>> {
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map(normalizeSymbol)
        .filter((symbol) => symbol.length > 0)
    )
  );
  const result = new Map<string, SymbolLookupResult>();

  await Promise.all(
    normalizedSymbols.map(async (symbol) => {
      const cached = getCached(symbol);
      if (cached) {
        result.set(symbol, cached);
        return;
      }
      try {
        const lookup = await fetchSymbolLookup(symbol);
        setCached(symbol, lookup);
        result.set(symbol, lookup);
      } catch {
        // Keep partial watchlist UX healthy even if one symbol lookup fails.
      }
    })
  );

  return result;
}
