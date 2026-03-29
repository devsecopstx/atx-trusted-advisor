import {
    adminListOptionsStrategyPreferenceSummaries,
    adminListOptionsStrategySummaries,
} from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";

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
    const strategies = await adminListOptionsStrategySummaries();
    const prefs = await adminListOptionsStrategyPreferenceSummaries();
    const slugs = strategies.map((s) => s.slug).sort();
    const slugPreview =
      slugs.length === 0
        ? "(none)"
        : slugs.length <= 24
          ? slugs.join(", ")
          : `${slugs.slice(0, 24).join(", ")} …+${slugs.length - 24}`;
    return {
      status: "success",
      output: `${categoryLabel}: catalog check — ${strategies.length} strategies, ${prefs.length} preference docs — slugs: ${slugPreview}`,
      auditDetails: {
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
