import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    executeOptionsStrategyScannerJob,
    type OptionsStrategyScannerCategory
} from "@/modules/strategy-options/options-strategy-scanner-job";

function resolveCategory(task: ScheduledTask): OptionsStrategyScannerCategory {
  return task.category === "daily_options_scanner" ? "daily_options_scanner" : "options_scanner";
}

/**
 * Scheduled hook for `options_scanner` / `daily_options_scanner` — delegates to
 * {@link executeOptionsStrategyScannerJob} (single implementation).
 */
export async function runOptionsStrategyScanner(
  task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  return executeOptionsStrategyScannerJob({
    tenantId: task.tenantId,
    category: resolveCategory(task)
  });
}
