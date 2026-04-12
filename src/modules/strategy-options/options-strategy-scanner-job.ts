import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import {
    adminListOptionsStrategyFilterRows,
    adminListOptionsStrategyPreferenceSummaries,
    adminListOptionsStrategySummaries,
    getDefaultPortfolio
} from "@/modules/core-admin/repository";
import type { Position, Watchlist } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import {
    daysToExpirationFromYmd,
    processOptionRecommendationsPass,
    type ScannerRankedSignal
} from "@/modules/strategy-options/options-scanner-engine";
import {
    filterOptionScanTargetsByMergedPrefs,
    mergeOptionsStrategyFilters,
    mergedScannerFiltersActive
} from "@/modules/strategy-options/options-scanner-prefs-filter";
import type { OptionScanTarget } from "@/modules/strategy-options/options-scanner-targets";
import {
    mergeOptionScanTargets,
    positionsToOptionScanTargets,
    watchlistsToOptionScanTargets
} from "@/modules/strategy-options/options-scanner-targets";

/** Logical service id for `options_scanner` scheduled tasks. */
export const OPTIONS_STRATEGY_SCANNER_SERVICE_ID = "options-strategy-scanner";

const OPTIONS_SCANNER_TASK_CATEGORY = "options_scanner" as const;

const ACCOUNT_COLLECTION = "portfolio_accounts";
const POSITION_COLLECTION = "portfolio_positions";
const WATCHLIST_COLLECTION = "portfolio_watchlists";

export type OptionsStrategyScannerJobInput = {
  tenantId?: ObjectId;
  /** Admin manual **Run** — skip US regular-session desk window. */
  bypassMarketWindow?: boolean;
};

function tenantFilter(tenantId?: ObjectId): Record<string, unknown> {
  if (tenantId) {
    return { tenantId };
  }
  return {};
}

/**
 * Positive integer → cap rows/targets. `0`, negative, or non-numeric → unlimited (`null`).
 * Env **unset** → `defaultWhenUnset` (scanner uses `null` = all tenant rows).
 */
function parseOptionsScannerCapEnv(
  raw: string | undefined,
  defaultWhenUnset: number | null
): number | null {
  if (raw === undefined || raw.trim() === "") {
    return defaultWhenUnset;
  }
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/** Without `tenantId` on `admin_scheduled_tasks`, Mongo scope would match all tenants — never write recs. */
function optionsScannerJobSkippedMissingTenant(
  serviceId: string,
  taskCategoryTag: string,
  startMs: number
): ScheduledCategoryResult {
  const durationSeconds = Number(((Date.now() - startMs) / 1000).toFixed(1));
  return {
    status: "success",
    output: `${serviceId}: task_category=${taskCategoryTag} skipped=true reason=missing_scheduled_task_tenantId — set tenantId on this scheduled task so the scanner only loads positions/watchlists and writes portfolio_recommendations for that tenant (app users already see recs only via tenant-scoped GET /api/portfolios/:id/recommendations). duration_s=${durationSeconds}`,
    auditDetails: {
      skipped: true,
      taskCategory: taskCategoryTag,
      skipReason: "missing_tenant_id",
      durationSeconds
    }
  };
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
  strategyFilterRows: Awaited<ReturnType<typeof adminListOptionsStrategyFilterRows>>;
}> {
  const [strategies, prefs, strategyFilterRows] = await Promise.all([
    adminListOptionsStrategySummaries(),
    adminListOptionsStrategyPreferenceSummaries(),
    adminListOptionsStrategyFilterRows()
  ]);
  return { strategies, prefs, strategyFilterRows };
}

function formatRankTop(signals: ScannerRankedSignal[]): string {
  if (signals.length === 0) {
    return "";
  }
  return signals
    .slice(0, 8)
    .map((s) => `${s.underlying}:${s.confidence}`)
    .join("|");
}

function applyPrefsFiltersToTargets(
  merged: OptionScanTarget[],
  strategyFilterRows: Awaited<ReturnType<typeof adminListOptionsStrategyFilterRows>>
): { filtered: OptionScanTarget[]; prefsActive: boolean } {
  const mergedFilters = mergeOptionsStrategyFilters(strategyFilterRows);
  const prefsActive = mergedScannerFiltersActive(mergedFilters);
  const filtered = filterOptionScanTargetsByMergedPrefs(merged, mergedFilters);
  return { filtered, prefsActive };
}

/**
 * All option legs in the tenant (every `portfolio_positions` row with `tenantId` + option shape).
 * Same scope idea as `watchlist_price_scanner` listing every `portfolio_watchlists` doc for the tenant —
 * no arbitrary global `.limit()` so each user’s portfolios are covered.
 */
async function loadTenantOptionPositions(scope: Record<string, unknown>): Promise<Position[]> {
  const db = await getDb();
  const match = optionPositionFilter(scope);
  return db.collection<Position>(POSITION_COLLECTION).find(match).toArray();
}

/** Every tenant watchlist document (typically one canonical list per user), like `listWatchlistsForTenantScope`. */
async function loadTenantWatchlists(scope: Record<string, unknown>): Promise<Watchlist[]> {
  const db = await getDb();
  return db.collection<Watchlist>(WATCHLIST_COLLECTION).find(scope).toArray();
}

async function defaultPortfolioIdsForWatchlistOwners(
  watchlists: Watchlist[],
  tenantId?: ObjectId
): Promise<Map<string, ObjectId>> {
  const tenantHex = tenantId?.toHexString();
  const keys = new Set<string>();
  for (const w of watchlists) {
    const k = normalizeMongoUserIdHex(w.userId);
    if (k) {
      keys.add(k);
    }
  }
  const out = new Map<string, ObjectId>();
  await Promise.all(
    [...keys].map(async (uid) => {
      const p = await getDefaultPortfolio(uid, tenantHex ? { tenantId: tenantHex } : undefined);
      if (p?._id) {
        out.set(uid, p._id);
      }
    })
  );
  return out;
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

/** Shared target merge for options scanner + Phase 3 expiration/roll job. */
export async function buildMergedOptionScanTargets(input: {
  tenantId?: ObjectId;
}): Promise<{
  merged: OptionScanTarget[];
  optionPositions: number;
  uniqueUnderlyings: number;
  wlTargetsLength: number;
  scope: Record<string, unknown>;
}> {
  const { tenantId } = input;
  const scope = tenantFilter(tenantId);
  const [countInfo, optionRows, watchlists] = await Promise.all([
    countOptionPositionsAndUnderlyings(scope),
    loadTenantOptionPositions(scope),
    loadTenantWatchlists(scope)
  ]);
  const { optionPositions, uniqueUnderlyings } = countInfo;

  const wlCap = parseOptionsScannerCapEnv(process.env.OPTIONS_SCANNER_MAX_WATCHLIST_ROWS, null);
  const posCap = parseOptionsScannerCapEnv(process.env.OPTIONS_SCANNER_MAX_POSITIONS, null);
  const positionsForTargets = posCap != null ? optionRows.slice(0, posCap) : optionRows;
  const posTargets = positionsToOptionScanTargets(positionsForTargets);
  const defaultByUser = await defaultPortfolioIdsForWatchlistOwners(watchlists, tenantId);
  const wlTargets = watchlistsToOptionScanTargets(watchlists, wlCap, defaultByUser);
  const merged = mergeOptionScanTargets(posTargets, wlTargets);
  return {
    merged,
    optionPositions,
    uniqueUnderlyings,
    wlTargetsLength: wlTargets.length,
    scope
  };
}

/**
 * Options legs with DTE ≤ {@link OPTIONS_ROLL_MAX_DTE} (default 7) — uses same pipeline as options scanner
 * with Mongo-backed chain cache + circuit breaker (Phase 3).
 */
export async function executeOptionsExpirationRollJob(
  input: OptionsStrategyScannerJobInput
): Promise<ScheduledCategoryResult> {
  const taskCategoryTag = "options_expiration_roll_manager";
  const rollMaxDte = Number.parseInt(process.env.OPTIONS_ROLL_MAX_DTE ?? "7", 10);
  const maxDte = Number.isFinite(rollMaxDte) && rollMaxDte >= 1 && rollMaxDte <= 60 ? rollMaxDte : 7;

  try {
    const { tenantId } = input;
    const start = Date.now();
    if (!tenantId) {
      return optionsScannerJobSkippedMissingTenant(
        "options-expiration-roll-manager",
        taskCategoryTag,
        start
      );
    }
    const db = await getDb();
    const scope = tenantFilter(tenantId);
    const market = resolveUsMarketDayContext(new Date());

    const [portfolioCount, accountCount, { strategies, prefs, strategyFilterRows }] = await Promise.all([
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

    const skipMarketRoll =
      !input.bypassMarketWindow && (!market.isBusinessDay || !market.marketWindowOpen);
    if (skipMarketRoll) {
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
        output: `options-expiration-roll-manager: task_category=${taskCategoryTag} skipped=true reason=${reason} [${market.marketDate} ${market.timezone}] portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} strategy_filter_rows=${strategyFilterRows.length} roll_max_dte=${maxDte} duration_s=${durationSeconds}`,
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
          uniqueUnderlyingCount: 0,
          rollMaxDte: maxDte
        }
      };
    }

    const built = await buildMergedOptionScanTargets({ tenantId });
    const { filtered: afterPrefs, prefsActive } = applyPrefsFiltersToTargets(
      built.merged,
      strategyFilterRows
    );
    const filtered = afterPrefs.filter((t) => {
      const dte = daysToExpirationFromYmd(t.expYmd);
      return dte >= 0 && dte <= maxDte;
    });

    const recPassRaw = await processOptionRecommendationsPass({
      targets: filtered,
      tenantId
    });
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
      fromWatchlist: 0,
      chainBatches: 0,
      rankedSignals: [],
      watchlistRowsAdded: 0,
      watchlistRowsUpdated: 0
    };

    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: built.uniqueUnderlyings,
      quoteCount: 0,
      portfolioCount,
      accountCount,
      holdingsCount: built.optionPositions,
      watchlistCount: built.wlTargetsLength,
      sourceTaskCategory: "options_strategy_scanner"
    });

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    const rankTop = formatRankTop(recPass.rankedSignals);
    const recSummary = `scan_targets=${built.merged.length} prefs_after=${afterPrefs.length} prefs_active=${prefsActive} targets_roll_window=${filtered.length} chain_batches=${recPass.chainBatches} rank_top=${rankTop || "none"} rec_examined=${recPass.examined} rec_stored=${recPass.stored} chain_fail=${recPass.chainFailures} grok=${recPass.grokCalls} alerts=${recPass.alertsCreated}`;
    const rollMarketLabel = input.bypassMarketWindow ? "admin_bypass_desk_window" : "open";
    return {
      status: "success",
      output: `options-expiration-roll-manager: task_category=${taskCategoryTag} skipped=false market=${rollMarketLabel} roll_max_dte=${maxDte} portfolios=${portfolioCount} accounts=${accountCount} option_positions=${built.optionPositions} unique_underlyings=${built.uniqueUnderlyings} ${recSummary} slugs: ${slugPreview} duration_s=${durationSeconds}`,
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
        optionPositionCount: built.optionPositions,
        uniqueUnderlyingCount: built.uniqueUnderlyings,
        rollMaxDte: maxDte,
        rollTargets: filtered.length,
        strategyFilterRowCount: strategyFilterRows.length,
        scanTargetsPrePrefs: built.merged.length,
        scanTargetsPostPrefs: afterPrefs.length,
        prefsFilterActive: prefsActive,
        rankTopPreview: rankTop || null,
        chainBatches: recPass.chainBatches,
        recommendationsExamined: recPass.examined,
        chainFailures: recPass.chainFailures,
        grokCalls: recPass.grokCalls,
        alertsCreated: recPass.alertsCreated,
        durationSeconds,
        ...(input.bypassMarketWindow ? { adminOnDemandMarketWindowBypass: true as const } : {})
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `options-expiration-roll-manager: task_category=${taskCategoryTag} failed: ${msg}`
    };
  }
}

/**
 * Options strategy scanner job for scheduled task category `options_scanner`.
 *
 * **Phase 2 (shipped here):** US regular-session gate (same calendar as price scanner), strategy/prefs
 * inventory, tenant-scoped option-position counts + distinct underlyings, `tenant_market_calendar` row
 * (`sourceTaskCategory: options_strategy_scanner`).
 *
 * **Tenant · user · books:** Loads **all** option legs with the task `tenantId` (every portfolio’s positions
 * in that tenant) and **all** tenant `portfolio_watchlists` rows for option-line targets — same sweep pattern
 * as `watchlist_price_scanner`. Optional `OPTIONS_SCANNER_MAX_POSITIONS` / `OPTIONS_SCANNER_MAX_WATCHLIST_ROWS`
 * cap cost on huge tenants (`0` or unset default = no cap).
 *
 * **Recommendations:** Yahoo chain per underlying+expiration (batched), rule + optional Grok rationale,
 * upsert `portfolio_recommendations` (`[options-scanner]` notes), alerts on SELL signals (capped per run).
 * **Phase 3:** Mongo option-chain cache + per-tenant Yahoo circuit breaker (`yahoo-option-chain-scanner`).
 */
export async function executeOptionsStrategyScannerJob(
  input: OptionsStrategyScannerJobInput
): Promise<ScheduledCategoryResult> {
  const taskCategoryTag = OPTIONS_SCANNER_TASK_CATEGORY;
  try {
    const { tenantId } = input;
    const start = Date.now();
    if (!tenantId) {
      return optionsScannerJobSkippedMissingTenant(
        OPTIONS_STRATEGY_SCANNER_SERVICE_ID,
        taskCategoryTag,
        start
      );
    }
    const db = await getDb();
    const scope = tenantFilter(tenantId);
    const market = resolveUsMarketDayContext(new Date());

    const [portfolioCount, accountCount, { strategies, prefs, strategyFilterRows }] = await Promise.all([
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

    const skipMarketOptions =
      !input.bypassMarketWindow && (!market.isBusinessDay || !market.marketWindowOpen);
    if (skipMarketOptions) {
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
        output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} skipped=true reason=${reason} [${market.marketDate} ${market.timezone}] portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} strategy_filter_rows=${strategyFilterRows.length} option_positions=0 unique_underlyings=0 slugs: ${slugPreview} duration_s=${durationSeconds}`,
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

    const built = await buildMergedOptionScanTargets({ tenantId });
    const { merged, optionPositions, uniqueUnderlyings, wlTargetsLength: wlTargetsLen } = built;
    const { filtered: scanTargets, prefsActive } = applyPrefsFiltersToTargets(merged, strategyFilterRows);

    const recPassRaw = await processOptionRecommendationsPass({ targets: scanTargets, tenantId });
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
      fromWatchlist: 0,
      chainBatches: 0,
      rankedSignals: [],
      watchlistRowsAdded: 0,
      watchlistRowsUpdated: 0
    };

    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: uniqueUnderlyings,
      quoteCount: 0,
      portfolioCount,
      accountCount,
      holdingsCount: optionPositions,
      watchlistCount: wlTargetsLen,
      sourceTaskCategory: "options_strategy_scanner"
    });

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    const rankTop = formatRankTop(recPass.rankedSignals);
    const recSummary = `scan_targets=${merged.length} prefs_after=${scanTargets.length} prefs_active=${prefsActive} chain_batches=${recPass.chainBatches} rank_top=${rankTop || "none"} rec_examined=${recPass.examined} rec_from_pos=${recPass.fromPositions} rec_from_wl=${recPass.fromWatchlist} rec_stored=${recPass.stored} rec_updated=${recPass.updated} chain_fail=${recPass.chainFailures} grok=${recPass.grokCalls} alerts=${recPass.alertsCreated} alert_dedupe=${recPass.alertsSuppressedDeduped} hold_dismiss=${recPass.alertsDismissedOnHold} skipped_bad=${recPass.skippedBadRow} wl_rows_added=${recPass.watchlistRowsAdded} wl_rows_updated=${recPass.watchlistRowsUpdated}`;
    const marketRunLabel = input.bypassMarketWindow ? "admin_bypass_desk_window" : "open";
    return {
      status: "success",
      output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} skipped=false market=${marketRunLabel} portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} strategy_filter_rows=${strategyFilterRows.length} option_positions=${optionPositions} unique_underlyings=${uniqueUnderlyings} ${recSummary} slugs: ${slugPreview} duration_s=${durationSeconds}`,
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
        watchlistOptionRows: wlTargetsLen,
        strategyFilterRowCount: strategyFilterRows.length,
        scanTargetsPrePrefs: merged.length,
        scanTargetsPostPrefs: scanTargets.length,
        prefsFilterActive: prefsActive,
        rankTopPreview: rankTop || null,
        chainBatches: recPass.chainBatches,
        durationSeconds,
        watchlistRowsAdded: recPass.watchlistRowsAdded,
        watchlistRowsUpdated: recPass.watchlistRowsUpdated,
        ...(input.bypassMarketWindow ? { adminOnDemandMarketWindowBypass: true as const } : {})
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
