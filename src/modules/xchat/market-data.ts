import {
    setRedisMarketQuote,
    tryGetRedisMarketQuote
} from "@/modules/xchat/market-quote-redis-cache";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

import type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export const MARKET_DATA_DISCLAIMER =
  "Market data is sourced from Yahoo Finance and may be delayed, incomplete, or inaccurate. " +
  "Use an exchange-grade feed for trading decisions.";

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
  if (cached) {
    return cached;
  }
  const quote = (await yahooQuoteWithValidationFallback(getYahooFinance2(), symbol, "single quote")) as Record<
    string,
    unknown
  >;
  const snapshot = buildSnapshotFromYahooQuote(symbol, quote);
  void setRedisMarketQuote(symbol, snapshot);
  return snapshot;
}

function buildSnapshotFromYahooQuote(
  symbol: string,
  quote: Record<string, unknown>
): MarketQuoteSnapshot {
  const regularMarketTime = quote.regularMarketTime;
  const toNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;
  const toString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  return {
    symbol,
    currency: toString(quote.currency),
    shortName: toString(quote.shortName),
    longName: toString(quote.longName),
    price: toNumber(quote.regularMarketPrice),
    open: toNumber(quote.regularMarketOpen),
    dayHigh: toNumber(quote.regularMarketDayHigh),
    dayLow: toNumber(quote.regularMarketDayLow),
    previousClose: toNumber(quote.regularMarketPreviousClose),
    change: toNumber(quote.regularMarketChange),
    changePercent: toNumber(quote.regularMarketChangePercent),
    volume: toNumber(quote.regularMarketVolume),
    fiftyTwoWeekHigh: toNumber(quote.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: toNumber(quote.fiftyTwoWeekLow),
    marketState: toString(quote.marketState),
    asOf:
      regularMarketTime instanceof Date
        ? regularMarketTime.toISOString()
        : typeof regularMarketTime === "number"
          ? new Date(regularMarketTime).toISOString()
          : undefined,
    source: "yahoo-finance2",
    disclaimer: MARKET_DATA_DISCLAIMER
  };
}
