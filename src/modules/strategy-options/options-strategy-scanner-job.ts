import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import {
    adminListOptionsStrategyPreferenceSummaries,
    adminListOptionsStrategySummaries
} from "@/modules/core-admin/repository";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";

/** Logical service id — both `options_scanner` and `daily_options_scanner` map here. */
export const OPTIONS_STRATEGY_SCANNER_SERVICE_ID = "options-strategy-scanner";

const ACCOUNT_COLLECTION = "portfolio_accounts";
const POSITION_COLLECTION = "portfolio_positions";

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
 * **Not shipped:** Yahoo option chains, `optionRecommendations` writes, Grok, circuit breaker, Prometheus
 * — see `atx-docs/design-system/scheduled-task/options-scannerp2.md` roadmap.
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

    const { optionPositions, uniqueUnderlyings } = await countOptionPositionsAndUnderlyings(scope);

    await updateTenantMarketCalendarSnapshot({
      tenantId,
      market,
      symbolCount: uniqueUnderlyings,
      quoteCount: 0,
      portfolioCount,
      accountCount,
      holdingsCount: optionPositions,
      watchlistCount: 0,
      sourceTaskCategory: "options_strategy_scanner"
    });

    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    return {
      status: "success",
      output: `${OPTIONS_STRATEGY_SCANNER_SERVICE_ID}: task_category=${taskCategoryTag} skipped=false market=open portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} option_positions=${optionPositions} unique_underlyings=${uniqueUnderlyings} slugs: ${slugPreview} duration_s=${durationSeconds}`,
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
