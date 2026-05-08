import type { ScheduledTask } from "@/modules/core-admin/types";
import {
    expireActivePortfolioPriceAlertsPastExpiry,
    listAllActivePortfolioPriceAlertsForTenant
} from "@/modules/price-alerts/portfolio-price-alerts-repository";
import { processPortfolioPriceAlertsWithQuotes } from "@/modules/price-alerts/process-portfolio-price-alerts";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";

/**
 * Tenant job (`user_alert_manager`): quotes every distinct symbol with an active NL alert and evaluates rules.
 * Supplements `watchlist_price_scanner` when alerts reference symbols that are not on any tenant watchlist.
 */
export async function runUserAlertManagerScanner(
  task: ScheduledTask,
  runOptions?: { bypassMarketWindow?: boolean }
): Promise<ScheduledCategoryResult> {
  const start = Date.now();
  const tenantId = task.tenantId;
  const bypassMarketWindow = Boolean(runOptions?.bypassMarketWindow);

  try {
    if (!tenantId) {
      const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
      return {
        status: "success",
        output: `user_alert_manager: skipped=true reason=missing_scheduled_task_tenantId duration_s=${durationSeconds}`,
        auditDetails: {
          skipped: true,
          skipReason: "missing_tenant_id" as const,
          durationSeconds
        }
      };
    }

    const tenantHex = tenantId.toHexString();
    const market = resolveUsMarketDayContext(new Date());
    const skipForMarket =
      !bypassMarketWindow && (!market.isBusinessDay || !market.marketWindowOpen);
    if (skipForMarket) {
      const reason = market.isHoliday
        ? `holiday (${market.holidayName ?? "market holiday"})`
        : "outside market hours";
      const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
      return {
        status: "success",
        output: `user_alert_manager: skipped — ${reason} [${market.marketDate} ${market.timezone}] duration_s=${durationSeconds}`,
        auditDetails: {
          skipped: true,
          marketDate: market.marketDate,
          marketTimezone: market.timezone,
          holiday: market.holidayName ?? null,
          durationSeconds,
          ...(bypassMarketWindow ? { adminOnDemandMarketWindowBypass: true as const } : {})
        }
      };
    }

    const expired = await expireActivePortfolioPriceAlertsPastExpiry({ tenantIdHex: tenantHex });

    const alerts = await listAllActivePortfolioPriceAlertsForTenant(tenantHex);
    const symSet = new Set<string>();
    for (const a of alerts) {
      const s = a.symbolNorm.trim().toUpperCase();
      if (s) {
        symSet.add(s);
      }
    }
    const symbols = [...symSet].sort();
    const quotes = symbols.length > 0 ? await getYahooBatchQuotes(symbols) : [];
    const quotePriceBySymbolUpper = new Map<string, number>();
    for (const q of quotes) {
      if (q.price !== undefined && Number.isFinite(q.price)) {
        quotePriceBySymbolUpper.set(String(q.symbol).trim().toUpperCase(), q.price);
      }
    }

    const processed =
      quotePriceBySymbolUpper.size > 0
        ? await processPortfolioPriceAlertsWithQuotes({
            tenantIdHex: tenantHex,
            quotePriceBySymbolUpper
          })
        : {
            evaluated: 0,
            armedUpdates: 0,
            fired: 0,
            skippedCooldown: 0
          };

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: symbols.length,
      quoteCount: quotePriceBySymbolUpper.size,
      portfolioCount: 0,
      accountCount: 0,
      holdingsCount: 0,
      watchlistCount: 0,
      sourceTaskCategory: "user_alert_manager"
    });

    return {
      status: "success",
      output: `user_alert_manager: active_alert_symbols=${symbols.length} symbols_quoted=${quotePriceBySymbolUpper.size} portfolio_price_alerts_evaluated=${processed.evaluated} portfolio_price_alerts_armed_updates=${processed.armedUpdates} portfolio_price_alerts_fired=${processed.fired} portfolio_price_alerts_skipped_cooldown=${processed.skippedCooldown} portfolio_price_alerts_expired=${expired} duration_s=${durationSeconds}`,
      auditDetails: {
        marketDate: market.marketDate,
        marketTimezone: market.timezone,
        activeAlertSymbols: symbols.length,
        symbolsQuoted: quotePriceBySymbolUpper.size,
        portfolioPriceAlertsEvaluated: processed.evaluated,
        portfolioPriceAlertsArmedUpdates: processed.armedUpdates,
        portfolioPriceAlertsFired: processed.fired,
        portfolioPriceAlertsSkippedCooldown: processed.skippedCooldown,
        portfolioPriceAlertsExpired: expired,
        durationSeconds,
        ...(bypassMarketWindow ? { adminOnDemandMarketWindowBypass: true as const } : {})
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `user_alert_manager: failed | ${msg}`
    };
  }
}
