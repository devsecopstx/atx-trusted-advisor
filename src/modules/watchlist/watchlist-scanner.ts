import {
    getDefaultPortfolio,
    listWatchlistsForTenantScope,
    updateWatchlistSymbolPrices
} from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import { processUserPriceRulesForPortfolio } from "@/modules/watchlist/user-price-alert-rules";
import {
    evaluateSignificantPriceMoves,
    type PersistedPriceAlertRow,
    persistPriceMoveAlerts
} from "./price-alert-service";
import {
    lastPriceFromRawWatchlistEntry,
    symbolFromRawWatchlistEntry,
    watchlistRowDeskMeta
} from "./watchlist-row-raw";
import {
    refineWatchlistRowRationaleWithPersona,
    resolveWatchlistScannerPersonaContext,
    watchlistScannerGrokEnv
} from "./watchlist-scanner-persona";
import { buildWatchlistScannerRationaleAppendix } from "./watchlist-scanner-rationale";
import { getYahooBatchQuotes } from "./yahoo-batch-quotes";

/**
 * WatchlistScannerService — PLAN priority 210
 * Runs as a ScheduledTask (category: "watchlist_price_scanner").
 * Batch-updates prices from Yahoo Finance and triggers basic alerts.
 */
type WatchlistPriceUpdate = {
  /** Row in `wl.symbols` — duplicate tickers each get their own scan line + rationale. */
  symbolRowIndex: number;
  symbol: string;
  /** Set when Yahoo returned a fresh price; omitted when we only refresh rationale / status. */
  lastPrice?: number;
  lastUpdatedAt?: Date;
  rationale: string;
  rowStatus: "review";
};

function watchlistScannerSkippedMissingTenantId(startMs: number): ScheduledCategoryResult {
  const durationSeconds = Number(((Date.now() - startMs) / 1000).toFixed(1));
  return {
    status: "success",
    output: `watchlist_price_scanner: skipped=true reason=missing_scheduled_task_tenantId — set tenantId on this scheduled task (or use a system-wide row so the runner fans out per tenant). Without tenantId, the job would not match the tenant-scoped watchlist sweep contract. duration_s=${durationSeconds}`,
    auditDetails: {
      skipped: true,
      skipReason: "missing_tenant_id" as const,
      durationSeconds
    }
  };
}

export async function runWatchlistPriceScanner(
  task: ScheduledTask,
  runOptions?: { bypassMarketWindow?: boolean }
): Promise<ScheduledCategoryResult> {
  const start = Date.now();
  const tenantId = task.tenantId;
  const bypassMarketWindow = Boolean(runOptions?.bypassMarketWindow);

  try {
    if (!tenantId) {
      return watchlistScannerSkippedMissingTenantId(start);
    }

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
        output: `watchlist_price_scanner: skipped — ${reason} [${market.marketDate} ${market.timezone}] | watchlists=${watchlists.length} watchlists_with_symbols=${watchlistsWithSymbols} items_updated=0 rows_marked_review=0 persona_grok_calls=0 items_scanned=0 symbols_quoted=0 alerts_created=0 alerts_skipped_cooldown=0 nl_user_price_rules_fired=0 nl_user_price_rules_armed_updates=0 duration_s=${durationSeconds}`,
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
          rowsMarkedReview: 0,
          personaGrokCalls: 0,
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
        output: `watchlist_price_scanner: watchlists=0 watchlists_with_symbols=0 items_updated=0 rows_marked_review=0 persona_grok_calls=0 items_scanned=0 symbols_quoted=0 alerts_created=0 alerts_skipped_cooldown=0 nl_user_price_rules_fired=0 nl_user_price_rules_armed_updates=0 duration_s=${durationSeconds}`,
        auditDetails: {
          watchlistCount: 0,
          watchlistsWithSymbols: 0,
          itemsUpdated: 0,
          itemsScanned: 0,
          symbolsQuoted: 0,
          alertsCreated: 0,
          alertsSkippedCooldown: 0,
          rowsMarkedReview: 0,
          personaGrokCalls: 0,
          durationSeconds
        }
      };
    }

    const personaDisabled = process.env.WATCHLIST_SCANNER_PERSONA_DISABLE === "1";
    const { grokEnabled, maxGrokCalls } = watchlistScannerGrokEnv();
    const personaCtx =
      !personaDisabled && grokEnabled ? await resolveWatchlistScannerPersonaContext() : null;
    let personaGrokCalls = 0;

    let updatedCount = 0;
    let rowsMarkedReview = 0;
    let alertCount = 0;
    let alertsSkippedCooldown = 0;
    let itemsScanned = 0;
    let symbolsQuoted = 0;
    const auditAlertRows: PersistedPriceAlertRow[] = [];
    let nlUserPriceRulesFired = 0;
    let nlUserPriceRulesArmedUpdates = 0;
    const portfoliosProcessedForNlRules = new Set<string>();

    const tenantTickerSet = new Set<string>();
    for (const wl of watchlists) {
      for (const raw of wl.symbols ?? []) {
        const s = symbolFromRawWatchlistEntry(raw);
        if (s) {
          tenantTickerSet.add(s);
        }
      }
    }
    const uniqueTenantTickers = [...tenantTickerSet].sort();
    const tenantQuotes =
      uniqueTenantTickers.length > 0 ? await getYahooBatchQuotes(uniqueTenantTickers) : [];
    symbolsQuoted += tenantQuotes.filter(
      (q) => q.price !== undefined && Number.isFinite(q.price)
    ).length;

    const quoteByNorm = new Map<string, (typeof tenantQuotes)[number]>();
    for (const q of tenantQuotes) {
      if (q.price !== undefined && Number.isFinite(q.price)) {
        quoteByNorm.set(String(q.symbol).trim().toUpperCase(), q);
      }
    }

    for (const wl of watchlists) {
      const symbols = wl.symbols || [];
      if (symbols.length === 0) continue;

      itemsScanned += symbols.length;

      const nowRow = new Date();
      const updates: WatchlistPriceUpdate[] = [];
      for (let i = 0; i < symbols.length; i++) {
        const raw = symbols[i]!;
        const sym = symbolFromRawWatchlistEntry(raw);
        if (!sym) {
          continue;
        }
        const quote = quoteByNorm.get(sym);
        const yahooPx =
          quote?.price !== undefined && Number.isFinite(quote.price) ? quote.price : undefined;
        const priorPx = lastPriceFromRawWatchlistEntry(raw);
        const spotForGrok =
          yahooPx !== undefined ? yahooPx : priorPx !== undefined ? priorPx : undefined;
        const desk = watchlistRowDeskMeta(raw);
        let grokLine: string | null = null;
        if (personaCtx != null && personaGrokCalls < maxGrokCalls && spotForGrok !== undefined) {
          personaGrokCalls += 1;
          grokLine = await refineWatchlistRowRationaleWithPersona(personaCtx, {
            symbol: sym,
            spotPrice: spotForGrok,
            priorRationale: desk.rationale,
            lineType: desk.lineType,
            strategy: desk.strategy
          });
        }
        const stitched = [desk.rationale?.trim(), grokLine].filter((x) => (x?.length ?? 0) > 0).join("\n\n");
        const appendixSpot = yahooPx ?? priorPx;
        updates.push({
          symbolRowIndex: i,
          symbol: sym,
          ...(yahooPx !== undefined ? { lastPrice: yahooPx } : {}),
          /** Always stamp so `/watchlist` “Last update” reflects a scan even when Yahoo missed (rationale-only merge). */
          lastUpdatedAt: nowRow,
          rationale: buildWatchlistScannerRationaleAppendix(stitched || undefined, appendixSpot, nowRow),
          rowStatus: "review"
        });
      }

      if (updates.length > 0 && wl._id) {
        const patched = await updateWatchlistSymbolPrices(wl._id, updates);
        if (patched < updates.length) {
          console.warn("[watchlist/scanner] fewer Mongo symbol rows patched than quote hits", {
            watchlistId: wl._id.toHexString(),
            attempted: updates.length,
            patched
          });
        }
        updatedCount += patched;
        rowsMarkedReview += patched;

        const moves = evaluateSignificantPriceMoves(symbols, updates);
        const uid = normalizeMongoUserIdHex(wl.userId);
        const tenantHex = wl.tenantId?.toHexString();
        const explicitPfHex = wl.portfolioId != null ? wl.portfolioId.toHexString() : null;
        const defaultPf =
          explicitPfHex == null && uid != null
            ? await getDefaultPortfolio(uid, tenantHex ? { tenantId: tenantHex } : undefined)
            : null;
        const alertPortfolioId = explicitPfHex ?? defaultPf?._id?.toHexString() ?? null;
        const persist =
          alertPortfolioId != null
            ? await persistPriceMoveAlerts(alertPortfolioId, moves)
            : { created: 0, recorded: [] as PersistedPriceAlertRow[], skippedCooldown: 0 };
        alertCount += persist.created;
        alertsSkippedCooldown += persist.skippedCooldown;
        if (persist.recorded.length > 0) {
          auditAlertRows.push(...persist.recorded);
        }

        if (alertPortfolioId != null && !portfoliosProcessedForNlRules.has(alertPortfolioId)) {
          portfoliosProcessedForNlRules.add(alertPortfolioId);
          const quotePrices = new Map<string, number>();
          for (const [sym, q] of quoteByNorm) {
            if (q.price !== undefined && Number.isFinite(q.price)) {
              quotePrices.set(sym, q.price);
            }
          }
          const ur = await processUserPriceRulesForPortfolio(alertPortfolioId, quotePrices);
          nlUserPriceRulesFired += ur?.fired ?? 0;
          nlUserPriceRulesArmedUpdates += ur?.armedUpdates ?? 0;
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
      output: `watchlist_price_scanner: watchlists=${watchlists.length} watchlists_with_symbols=${watchlistsWithSymbols} items_updated=${updatedCount} rows_marked_review=${rowsMarkedReview} persona_grok_calls=${personaGrokCalls} items_scanned=${itemsScanned} symbols_quoted=${symbolsQuoted} alerts_created=${alertCount} alerts_skipped_cooldown=${alertsSkippedCooldown} nl_user_price_rules_fired=${nlUserPriceRulesFired} nl_user_price_rules_armed_updates=${nlUserPriceRulesArmedUpdates} duration_s=${durationSeconds}`,
      auditDetails: {
        marketDate: market.marketDate,
        marketTimezone: market.timezone,
        watchlistCount: watchlists.length,
        watchlistsWithSymbols,
        itemsUpdated: updatedCount,
        rowsMarkedReview,
        personaGrokCalls,
        personaResolved: Boolean(personaCtx),
        itemsScanned,
        symbolsQuoted,
        alertsCreated: alertCount,
        alertsSkippedCooldown,
        nlUserPriceRulesFired,
        nlUserPriceRulesArmedUpdates,
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
