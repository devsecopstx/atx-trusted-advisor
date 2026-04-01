import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import {
    adminListOptionsStrategyPreferenceSummaries,
    adminListOptionsStrategySummaries,
} from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";

const ACCOUNT_COLLECTION = "portfolio_accounts";

function tenantFilter(tenantId?: ObjectId): Record<string, unknown> {
  if (tenantId) {
    return { tenantId };
  }
  return {};
}

/**
 * OptionsStrategyScannerService (PLAN 270) — scheduled `daily_options_scanner` hook.
 * v1: inventory pass over Mongo strategy catalog + preference docs (RAG-aligned seeds).
 * Full chain scan / ranking stays on roadmap (see `atx-docs/design-system/scheduled-task/options-scanner.md`).
 */
export async function runOptionsStrategyScanner(
  task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  const categoryLabel =
    task.category === "options_scanner" ? "options_scanner" : "daily_options_scanner";
  try {
    const db = await getDb();
    const scope = tenantFilter(task.tenantId);
    const [portfolioCount, accountCount] = await Promise.all([
      db.collection(TENANT_PORTFOLIO_COLLECTION).countDocuments(scope),
      db.collection(ACCOUNT_COLLECTION).countDocuments(scope)
    ]);

    const strategies = await adminListOptionsStrategySummaries();
    const prefs = await adminListOptionsStrategyPreferenceSummaries();
    const itemsScanned = strategies.length + prefs.length;
    const slugs = strategies.map((s) => s.slug).sort();
    const slugPreview =
      slugs.length === 0
        ? "(none)"
        : slugs.length <= 24
          ? slugs.join(", ")
          : `${slugs.slice(0, 24).join(", ")} …+${slugs.length - 24}`;
    return {
      status: "success",
      output: `${categoryLabel}: portfolios=${portfolioCount} accounts=${accountCount} items_scanned=${itemsScanned} strategies=${strategies.length} preferences=${prefs.length} slugs: ${slugPreview}`,
      auditDetails: {
        portfolioCount,
        accountCount,
        itemsScanned,
        strategyCount: strategies.length,
        preferenceCount: prefs.length,
        slugCount: slugs.length
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      output: `${categoryLabel} failed: ${msg}`
    };
  }
}
