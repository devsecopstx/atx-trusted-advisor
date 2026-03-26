import { ObjectId } from "mongodb";

import type { ScheduledTask } from "@/modules/core-admin/types";
import {
  getAllWatchlists,
  updateWatchlistSymbolPrices,
} from "@/modules/core-admin/repository";
import { getYahooBatchQuotes } from "./yahoo-batch-quotes";
import { createPortfolioAlert } from "@/modules/core-admin/repository";

/**
 * WatchlistScannerService — Priority 200
 * Runs as a ScheduledTask (category: "watchlist_price_scanner").
 * Batch-updates prices from Yahoo Finance and triggers basic alerts.
 */
export async function runWatchlistPriceScanner(
  task: ScheduledTask
): Promise<{ status: "success" | "failed"; output: string }> {
  const start = Date.now();

  try {
    const watchlists = await getAllWatchlists();

    if (watchlists.length === 0) {
      return {
        status: "success",
        output: "watchlist_price_scanner: no watchlists found.",
      };
    }

    let updatedCount = 0;
    let alertCount = 0;

    for (const wl of watchlists) {
      const symbols = wl.symbols || [];
      if (symbols.length === 0) continue;

      const tickers = symbols.map((s) => s.symbol);
      const quotes = await getYahooBatchQuotes(tickers);

      const updates = symbols.map((s) => {
        const quote = quotes.find((q) => q.symbol === s.symbol);
        if (quote && quote.price !== undefined) {
          return {
            symbol: s.symbol,
            lastPrice: quote.price,
            lastUpdatedAt: new Date(),
          };
        }
        return null;
      }).filter(Boolean);

      if (updates.length > 0) {
        await updateWatchlistSymbolPrices(wl._id!, updates as any);
        updatedCount += updates.length;

        // Basic alert for significant price change (>5%)
        for (const u of updates) {
          const oldSymbol = symbols.find((s) => s.symbol === u.symbol);
          if (oldSymbol?.lastPrice && u.lastPrice) {
            const changePct = Math.abs((u.lastPrice - oldSymbol.lastPrice) / oldSymbol.lastPrice) * 100;
            if (changePct > 5) {
              await createPortfolioAlert({
                portfolioId: wl.portfolioId,
                userId: wl.userId,
                title: `${u.symbol} price alert`,
                body: `Price moved ${changePct.toFixed(1)}% to $${u.lastPrice}`,
                severity: "info",
              });
              alertCount++;
            }
          }
        }
      }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return {
      status: "success",
      output: `watchlist_price_scanner: updated ${updatedCount} symbols across ${watchlists.length} watchlists, created ${alertCount} alerts in ${duration}s.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `watchlist_price_scanner failed: ${msg}`,
    };
  }
}
