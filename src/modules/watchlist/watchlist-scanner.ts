import { getDefaultPortfolio, listWatchlistsForTenantScope, updateWatchlistSymbolPrices } from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import {
    evaluateSignificantPriceMoves,
    type PersistedPriceAlertRow,
    persistPriceMoveAlerts
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
  task: ScheduledTask,
  runOptions?: { bypassMarketWindow?: boolean }
): Promise<ScheduledCategoryResult> {
  const start = Date.now();
  const tenantId = task.tenantId;
  const bypassMarketWindow = Boolean(runOptions?.bypassMarketWindow);

  try {
    const market = resolveUsMarketDayContext(new Date());
    const watchlists = await listWatchlistsForTenantScope(tenantId);
    const watchlistsWithSymbols = watchlists.filter((w) => (w.symbols?.length ?? 0) > 0).length;

    const skipForMarket =
      !bypassMarketWindow && (!market.isBusinessDay || !market.marketWindowOpen);
    if (skipForMarket) {
      await updateTenantMarketCalendarSnapshot({
        tenantId,
        market,
        symbolCount: 0,
        quoteCount: 0,
        portfolioCount: 0,
        accountCount: 0,
        holdingsCount: 0,
        watchlistCount: watchlists.length,
        sourceTaskCategory: "watchlist_price_scanner"
      });
      const reason = market.isHoliday
        ? `holiday (${market.holidayName ?? "market holiday"})`
        : "outside market hours";
      const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
      return {
        status: "success",
        output: `watchlist_price_scanner: skipped — ${reason} [${market.marketDate} ${market.timezone}] | watchlists=${watchlists.length} watchlists_with_symbols=${watchlistsWithSymbols} items_updated=0 items_scanned=0 symbols_quoted=0 alerts_created=0 alerts_skipped_cooldown=0 duration_s=${durationSeconds}`,
        auditDetails: {
          skipped: true,
          marketDate: market.marketDate,
          marketTimezone: market.timezone,
          holiday: market.holidayName ?? null,
          watchlistCount: watchlists.length,
          watchlistsWithSymbols,
          itemsUpdated: 0,
          itemsScanned: 0,
          symbolsQuoted: 0,
          alertsCreated: 0,
          alertsSkippedCooldown: 0,
          durationSeconds
        }
      };
    }

    if (watchlists.length === 0) {
      const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
      await updateTenantMarketCalendarSnapshot({
        tenantId,
        market,
        symbolCount: 0,
        quoteCount: 0,
        portfolioCount: 0,
        accountCount: 0,
        holdingsCount: 0,
        watchlistCount: 0,
        sourceTaskCategory: "watchlist_price_scanner"
      });
      return {
        status: "success",
        output: `watchlist_price_scanner: watchlists=0 watchlists_with_symbols=0 items_updated=0 items_scanned=0 symbols_quoted=0 alerts_created=0 alerts_skipped_cooldown=0 duration_s=${durationSeconds}`,
        auditDetails: {
          watchlistCount: 0,
          watchlistsWithSymbols: 0,
          itemsUpdated: 0,
          itemsScanned: 0,
          symbolsQuoted: 0,
          alertsCreated: 0,
          alertsSkippedCooldown: 0,
          durationSeconds
        }
      };
    }

    let updatedCount = 0;
    let alertCount = 0;
    let alertsSkippedCooldown = 0;
    let itemsScanned = 0;
    let symbolsQuoted = 0;
    const auditAlertRows: PersistedPriceAlertRow[] = [];

    for (const wl of watchlists) {
      const symbols = wl.symbols || [];
      if (symbols.length === 0) continue;

      itemsScanned += symbols.length;
      const tickers = symbols.map((s) => s.symbol);
      const quotes = await getYahooBatchQuotes(tickers);
      symbolsQuoted += quotes.filter((q) => q.price !== undefined && Number.isFinite(q.price)).length;

      const updates: WatchlistPriceUpdate[] = [];
      for (const s of symbols) {
        const quote = quotes.find((q) => q.symbol === s.symbol);
        if (quote?.price !== undefined) {
          updates.push({
            symbol: s.symbol,
            lastPrice: quote.price,
            lastUpdatedAt: new Date()
          });
        }
      }

      if (updates.length > 0 && wl._id) {
        await updateWatchlistSymbolPrices(wl._id, updates);
        updatedCount += updates.length;

        const moves = evaluateSignificantPriceMoves(symbols, updates);
        const uid = normalizeMongoUserIdHex(wl.userId);
        const tenantHex = wl.tenantId?.toHexString();
        const defaultPf =
          uid != null
            ? await getDefaultPortfolio(uid, tenantHex ? { tenantId: tenantHex } : undefined)
            : null;
        const alertPortfolioId = defaultPf?._id?.toHexString();
        const persist =
          alertPortfolioId != null
            ? await persistPriceMoveAlerts(alertPortfolioId, moves)
            : { created: 0, recorded: [] as PersistedPriceAlertRow[], skippedCooldown: 0 };
        alertCount += persist.created;
        alertsSkippedCooldown += persist.skippedCooldown;
        if (persist.recorded.length > 0) {
          auditAlertRows.push(...persist.recorded);
        }
      }
    }

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: itemsScanned,
      quoteCount: symbolsQuoted,
      portfolioCount: 0,
      accountCount: 0,
      holdingsCount: 0,
      watchlistCount: watchlists.length,
      sourceTaskCategory: "watchlist_price_scanner"
    });

    return {
      status: "success",
      output: `watchlist_price_scanner: watchlists=${watchlists.length} watchlists_with_symbols=${watchlistsWithSymbols} items_updated=${updatedCount} items_scanned=${itemsScanned} symbols_quoted=${symbolsQuoted} alerts_created=${alertCount} alerts_skipped_cooldown=${alertsSkippedCooldown} duration_s=${durationSeconds}`,
      auditDetails: {
        marketDate: market.marketDate,
        marketTimezone: market.timezone,
        watchlistCount: watchlists.length,
        watchlistsWithSymbols,
        itemsUpdated: updatedCount,
        itemsScanned,
        symbolsQuoted,
        alertsCreated: alertCount,
        alertsSkippedCooldown,
        durationSeconds,
        ...(bypassMarketWindow ? { adminOnDemandMarketWindowBypass: true as const } : {})
      },
      auditAlertRows: auditAlertRows.length > 0 ? auditAlertRows : undefined
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `watchlist_price_scanner: failed | ${msg}`
    };
  }
}
