import { getAllWatchlists, updateWatchlistSymbolPrices } from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
  evaluateSignificantPriceMoves,
  type PersistedPriceAlertRow,
  persistPriceMoveAlerts,
} from "./price-alert-service";
import { getYahooBatchQuotes } from "./yahoo-batch-quotes";

/**
 * WatchlistScannerService — PLAN priority 210
 * Runs as a ScheduledTask (category: "watchlist_price_scanner").
 * Batch-updates prices from Yahoo Finance and triggers basic alerts.
 */
type WatchlistPriceUpdate = {
  symbol: string;
  lastPrice: number;
  lastUpdatedAt: Date;
};

export async function runWatchlistPriceScanner(
  _task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  void _task;
  const start = Date.now();

  try {
    const watchlists = await getAllWatchlists();

    if (watchlists.length === 0) {
      return {
        status: "success",
        output: "watchlist_price_scanner: no watchlists found.",
        auditDetails: { watchlistCount: 0, updatedSymbols: 0, alertsCreated: 0 }
      };
    }

    let updatedCount = 0;
    let alertCount = 0;
    const auditAlertRows: PersistedPriceAlertRow[] = [];

    for (const wl of watchlists) {
      const symbols = wl.symbols || [];
      if (symbols.length === 0) continue;

      const tickers = symbols.map((s) => s.symbol);
      const quotes = await getYahooBatchQuotes(tickers);

      const updates: WatchlistPriceUpdate[] = [];
      for (const s of symbols) {
        const quote = quotes.find((q) => q.symbol === s.symbol);
        if (quote?.price !== undefined) {
          updates.push({
            symbol: s.symbol,
            lastPrice: quote.price,
            lastUpdatedAt: new Date(),
          });
        }
      }

      if (updates.length > 0 && wl._id) {
        await updateWatchlistSymbolPrices(wl._id, updates);
        updatedCount += updates.length;

        const moves = evaluateSignificantPriceMoves(symbols, updates);
        const persist = await persistPriceMoveAlerts(wl.portfolioId.toHexString(), moves);
        alertCount += persist.created;
        if (persist.recorded.length > 0) {
          auditAlertRows.push(...persist.recorded);
        }
      }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return {
      status: "success",
      output: `watchlist_price_scanner: updated ${updatedCount} symbols across ${watchlists.length} watchlists, created ${alertCount} alerts in ${duration}s.`,
      auditDetails: {
        watchlistCount: watchlists.length,
        updatedSymbols: updatedCount,
        alertsCreated: alertCount,
        durationSeconds: Number(duration)
      },
      auditAlertRows: auditAlertRows.length > 0 ? auditAlertRows : undefined
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `watchlist_price_scanner failed: ${msg}`
    };
  }
}
