import yahooFinance from "yahoo-finance2";

export const MARKET_DATA_DISCLAIMER =
  "Market data is sourced from Yahoo Finance and may be delayed, incomplete, or inaccurate. " +
  "Use an exchange-grade feed for trading decisions.";

export type MarketQuoteSnapshot = {
  symbol: string;
  currency?: string;
  price?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  marketState?: string;
  asOf?: string;
  source: "yahoo-finance2";
  disclaimer: string;
};

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
  const quote = (await yahooFinance.quote(symbol)) as Record<string, unknown>;
  const regularMarketTime = quote.regularMarketTime;
  const toNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;
  const toString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  return {
    symbol,
    currency: toString(quote.currency),
    price: toNumber(quote.regularMarketPrice),
    open: toNumber(quote.regularMarketOpen),
    dayHigh: toNumber(quote.regularMarketDayHigh),
    dayLow: toNumber(quote.regularMarketDayLow),
    previousClose: toNumber(quote.regularMarketPreviousClose),
    change: toNumber(quote.regularMarketChange),
    changePercent: toNumber(quote.regularMarketChangePercent),
    volume: toNumber(quote.regularMarketVolume),
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
