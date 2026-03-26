import yahooFinance from "yahoo-finance2";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-data";

export async function getYahooBatchQuotes(symbols: string[]): Promise<MarketQuoteSnapshot[]> {
  if (symbols.length === 0) return [];

  try {
    const uniqueSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
    const quotes = await yahooFinance.quote(uniqueSymbols);

    const results: MarketQuoteSnapshot[] = [];

    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (q && typeof q === "object" && "symbol" in q) {
          results.push(normalizeQuote(q as any));
        }
      }
    } else if (quotes && typeof quotes === "object") {
      results.push(normalizeQuote(quotes as any));
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

function normalizeQuote(raw: Record<string, any>): MarketQuoteSnapshot {
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
