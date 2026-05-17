import {
    getYahooBatchQuotes,
    marketQuoteHasLivePrice
} from "@/modules/watchlist/yahoo-batch-quotes";
import { tryGetRedisMarketQuote } from "@/modules/xchat/market-quote-redis-cache";

import type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export const MARKET_DATA_DISCLAIMER =
  "Market data is sourced from Yahoo Finance and may be delayed, incomplete, or inaccurate. " +
  "Use an exchange-grade feed for trading decisions.";

export class MarketQuoteUnavailableError extends Error {
  readonly code = "market_quote_unavailable" as const;
  readonly symbol: string;

  constructor(symbol: string, cause?: unknown) {
    super(`Market quote unavailable for ${symbol}`);
    this.name = "MarketQuoteUnavailableError";
    this.symbol = symbol;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function normalizeSymbol(raw: unknown): string {
  const fallback = "TSLA";
  if (typeof raw !== "string") {
    return fallback;
  }
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return fallback;
  }
  if (!/^[A-Z0-9.^-]{1,15}$/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export async function getYahooMarketQuote(input: {
  symbol?: string;
}): Promise<MarketQuoteSnapshot> {
  const symbol = normalizeSymbol(input.symbol);
  const cached = await tryGetRedisMarketQuote(symbol);
  if (cached && marketQuoteHasLivePrice(cached)) {
    return cached;
  }

  const rows = await getYahooBatchQuotes([symbol]);
  const row = rows.find((r) => r.symbol.trim().toUpperCase() === symbol) ?? rows[0];
  if (!row || !marketQuoteHasLivePrice(row)) {
    throw new MarketQuoteUnavailableError(symbol);
  }
  return row;
}
