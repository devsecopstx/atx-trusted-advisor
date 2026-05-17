import {
    getYahooBatchQuotes,
    marketQuoteHasLivePrice
} from "@/modules/watchlist/yahoo-batch-quotes";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export type WatchlistLiveQuotesOptions = {
  allowNetwork?: boolean;
};

/**
 * One Yahoo batch pass (+ per-symbol fallback inside `getYahooBatchQuotes`) for watchlist desks.
 * Prefer this over N parallel `getYahooMarketQuote` calls in xChat post-process (rate limits).
 */
export async function resolveLiveQuotesForWatchlistSymbols(
  symbols: string[],
  opts?: WatchlistLiveQuotesOptions
): Promise<Map<string, MarketQuoteSnapshot>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, MarketQuoteSnapshot>();
  if (unique.length === 0) {
    return out;
  }
  const allowNetwork = opts?.allowNetwork !== false;
  const rows = await getYahooBatchQuotes(unique, { allowNetwork });
  for (const row of rows) {
    const sym = row.symbol.trim().toUpperCase();
    if (sym && marketQuoteHasLivePrice(row)) {
      out.set(sym, row);
    }
  }
  if (allowNetwork && out.size < unique.length) {
    const missing = unique.filter((sym) => !out.has(sym));
    if (missing.length > 0) {
      console.warn("[watchlist/live-quotes] batch missing symbols; retrying chunk", {
        requested: unique.length,
        resolved: out.size,
        missingPreview: missing.slice(0, 8)
      });
      const retry = await getYahooBatchQuotes(missing, { allowNetwork: true });
      for (const row of retry) {
        const sym = row.symbol.trim().toUpperCase();
        if (sym && marketQuoteHasLivePrice(row)) {
          out.set(sym, row);
        }
      }
    }
  }
  if (allowNetwork && out.size < unique.length) {
    const stillMissing = unique.filter((sym) => !out.has(sym));
    for (const sym of stillMissing) {
      try {
        const snap = await getYahooMarketQuote({ symbol: sym });
        if (marketQuoteHasLivePrice(snap)) {
          out.set(sym, snap);
        }
      } catch (err) {
        console.warn("[watchlist/live-quotes] single-symbol fallback failed", {
          symbol: sym,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
  if (allowNetwork && out.size === 0 && unique.length > 0) {
    console.warn("[watchlist/live-quotes] no live prices resolved", {
      symbolCount: unique.length,
      preview: unique.slice(0, 8)
    });
  }
  return out;
}
