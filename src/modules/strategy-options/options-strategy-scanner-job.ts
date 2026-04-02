import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import {
    adminListOptionsStrategyPreferenceSummaries,
    adminListOptionsStrategySummaries
} from "@/modules/core-admin/repository";
import type { Position, Watchlist } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import { processOptionRecommendationsPass } from "@/modules/strategy-options/options-scanner-engine";
import {
    mergeOptionScanTargets,
    positionsToOptionScanTargets,
    watchlistsToOptionScanTargets
} from "@/modules/strategy-options/options-scanner-targets";

/** Logical service id — both `options_scanner` and `daily_options_scanner` map here. */
export const OPTIONS_STRATEGY_SCANNER_SERVICE_ID = "options-strategy-scanner";

const ACCOUNT_COLLECTION = "portfolio_accounts";
const POSITION_COLLECTION = "portfolio_positions";
const WATCHLIST_COLLECTION = "portfolio_watchlists";

export type OptionsStrategyScannerCategory = "options_scanner" | "daily_options_scanner";

export type OptionsStrategyScannerJobInput = {
  tenantId?: ObjectId;
  /** Source task category (for output/trace only; execution is identical). */
  category: OptionsStrategyScannerCategory;
};

function tenantFilter(tenantId?: ObjectId): Record<string, unknown> {
  if (tenantId) {
    return { tenantId };
  }
  return {};
}

/** Matches option legs in Mongo; includes legacy rows without `type: "option"`. */
function optionPositionFilter(scope: Record<string, unknown>): Record<string, unknown> {
  return {
    ...scope,
    $or: [{ type: "option" }, { optionType: { $in: ["call", "put"] } }]
  };
}

async function loadStrategyInventory(): Promise<{
  strategies: Awaited<ReturnType<typeof adminListOptionsStrategySummaries>>;
  prefs: Awaited<ReturnType<typeof adminListOptionsStrategyPreferenceSummaries>>;
}> {
  const [strategies, prefs] = await Promise.all([
    adminListOptionsStrategySummaries(),
    adminListOptionsStrategyPreferenceSummaries()
  ]);
  return { strategies, prefs };
}

async function loadTenantOptionPositions(scope: Record<string, unknown>): Promise<Position[]> {
  const db = await getDb();
  const match = optionPositionFilter(scope);
  return db
    .collection<Position>(POSITION_COLLECTION)
    .find(match)
    .limit(220)
    .toArray();
}

async function loadTenantWatchlists(scope: Record<string, unknown>): Promise<Watchlist[]> {
  const db = await getDb();
  return db
    .collection<Watchlist>(WATCHLIST_COLLECTION)
    .find(scope)
    .limit(120)
    .toArray();
}

async function countOptionPositionsAndUnderlyings(
  scope: Record<string, unknown>
): Promise<{ optionPositions: number; uniqueUnderlyings: number }> {
  const db = await getDb();
  const match = optionPositionFilter(scope);
  const optionPositions = await db.collection(POSITION_COLLECTION).countDocuments(match);
  const agg = await db
    .collection(POSITION_COLLECTION)
    .aggregate<{ n?: number }>([
      { $match: match },
      {
        $group: {
          _id: {
            $toUpper: {
              $trim: {
                input: { $ifNull: ["$symbol", ""] }
              }
            }
          }
        }
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "n" }
    ])
    .toArray();
  const uniqueUnderlyings = agg[0]?.n ?? 0;
  return { optionPositions, uniqueUnderlyings };
}

/**
 * Unified options strategy scanner job for `options_scanner` and `daily_options_scanner`.
 *
 * **Phase 2 (shipped here):** US regular-session gate (same calendar as price scanner), strategy/prefs
 * inventory, tenant-scoped option-position counts + distinct underlyings, `tenant_market_calendar` row
 * (`sourceTaskCategory: options_strategy_scanner`).
 *
 * **Recommendations:** Yahoo chain per underlying+expiration (batched), rule + optional Grok rationale,
 * upsert `portfolio_recommendations` (`[options-scanner]` notes), alerts on SELL signals (capped per run).
 * **Not shipped:** circuit breaker, Prometheus — see `options-scannerp2.md`.
 */
export async function executeOptionsStrategyScannerJob(
  input: OptionsStrategyScannerJobInput
): Promise<ScheduledCategoryResult> {
  const taskCategoryTag =
    input.category === "daily_options_scanner" ? "daily_options_scanner" : "options_scanner";
  try {
    const { tenantId } = input;
    const start = Date.now();
    const db = await getDb();
    const scope = tenantFilter(tenantId);
    const market = resolveUsMarketDayContext(new Date());

    const [portfolioCount, accountCount, { strategies, prefs }] = await Promise.all([
      db.collection(TENANT_PORTFOLIO_COLLECTION).countDocuments(scope),
      db.collection(ACCOUNT_COLLECTION).countDocuments(scope),
      loadStrategyInventory()
    ]);

    const slugs = strategies.map((s) => s.slug).sort();
    const slugPreview =
      slugs.length === 0
        ? "(none)"
        : slugs.length <= 24
          ? slugs.join(", ")
          : `${slugs.slice(0, 24).join(", ")} …+${slugs.length - 24}`;
    const itemsScanned = strategies.length + prefs.length;

    if (!market.isBusinessDay || !market.marketWindowOpen) {
      await updateTenantMarketCalendarSnapshot({
        tenantId,
        market,
        symbolCount: 0,
        quoteCount: 0,
        portfolioCount,
        accountCount,
        holdingsCount: 0,
        watchlistCount: 0,
        sourceTaskCategory: "options_strategy_scanner"
      });
      const reason = market.isHoliday
        ? `holiday (${market.holidayName ?? "market holiday"})`
        : "outside market hours";
      const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
      return {
        status: "success",
        output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} skipped=true reason=${reason} [${market.marketDate} ${market.timezone}] portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} option_positions=0 unique_underlyings=0 slugs: ${slugPreview} duration_s=${durationSeconds}`,
        auditDetails: {
          skipped: true,
          taskCategory: taskCategoryTag,
          marketDate: market.marketDate,
          marketTimezone: market.timezone,
          holiday: market.holidayName ?? null,
          portfolioCount,
          accountCount,
          itemsScanned,
          strategyCount: strategies.length,
          preferenceCount: prefs.length,
          slugCount: slugs.length,
          optionPositionCount: 0,
          uniqueUnderlyingCount: 0
        }
      };
    }

    const [countInfo, optionRows, watchlists] = await Promise.all([
      countOptionPositionsAndUnderlyings(scope),
      loadTenantOptionPositions(scope),
      loadTenantWatchlists(scope)
    ]);
    const { optionPositions, uniqueUnderlyings } = countInfo;

    const maxWl = Number.parseInt(process.env.OPTIONS_SCANNER_MAX_WATCHLIST_ROWS ?? "50", 10);
    const maxPosCap = Number.parseInt(process.env.OPTIONS_SCANNER_MAX_POSITIONS ?? "60", 10);
    const wlLimit = Number.isFinite(maxWl) && maxWl > 0 ? maxWl : 50;
    const posLimit = Number.isFinite(maxPosCap) && maxPosCap > 0 ? maxPosCap : 60;
    const posTargets = positionsToOptionScanTargets(optionRows.slice(0, 220));
    const wlTargets = watchlistsToOptionScanTargets(watchlists, wlLimit);
    const merged = mergeOptionScanTargets(posTargets, wlTargets).slice(0, posLimit + wlLimit);

    const recPassRaw = await processOptionRecommendationsPass({ targets: merged });
    const recPass = recPassRaw ?? {
      examined: 0,
      stored: 0,
      updated: 0,
      alertsCreated: 0,
      alertsSuppressedDeduped: 0,
      alertsDismissedOnHold: 0,
      chainFailures: 0,
      grokCalls: 0,
      skippedBadRow: 0,
      fromPositions: 0,
      fromWatchlist: 0
    };

    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: uniqueUnderlyings,
      quoteCount: 0,
      portfolioCount,
      accountCount,
      holdingsCount: optionPositions,
      watchlistCount: wlTargets.length,
      sourceTaskCategory: "options_strategy_scanner"
    });

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    const recSummary = `rec_examined=${recPass.examined} rec_from_pos=${recPass.fromPositions} rec_from_wl=${recPass.fromWatchlist} rec_stored=${recPass.stored} rec_updated=${recPass.updated} chain_fail=${recPass.chainFailures} grok=${recPass.grokCalls} alerts=${recPass.alertsCreated} alert_dedupe=${recPass.alertsSuppressedDeduped} hold_dismiss=${recPass.alertsDismissedOnHold} skipped_bad=${recPass.skippedBadRow}`;
    return {
      status: "success",
      output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} skipped=false market=open portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} option_positions=${optionPositions} unique_underlyings=${uniqueUnderlyings} ${recSummary} slugs: ${slugPreview} duration_s=${durationSeconds}`,
      auditDetails: {
        skipped: false,
        taskCategory: taskCategoryTag,
        marketDate: market.marketDate,
        marketTimezone: market.timezone,
        portfolioCount,
        accountCount,
        itemsScanned,
        strategyCount: strategies.length,
        preferenceCount: prefs.length,
        slugCount: slugs.length,
        optionPositionCount: optionPositions,
        uniqueUnderlyingCount: uniqueUnderlyings,
        recommendationsExamined: recPass.examined,
        recommendationsStored: recPass.stored,
        recommendationsUpdated: recPass.updated,
        chainFailures: recPass.chainFailures,
        grokCalls: recPass.grokCalls,
        alertsCreated: recPass.alertsCreated,
        alertsSuppressedDeduped: recPass.alertsSuppressedDeduped,
        alertsDismissedOnHold: recPass.alertsDismissedOnHold,
        skippedBadPositions: recPass.skippedBadRow,
        recommendationSourcesFromPositions: recPass.fromPositions,
        recommendationSourcesFromWatchlist: recPass.fromWatchlist,
        watchlistOptionRows: wlTargets.length,
        durationSeconds
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} failed: ${msg}`
    };
  }
}
