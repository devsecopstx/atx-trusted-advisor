import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import { executeOptionsStrategyScannerJob } from "@/modules/strategy-options/options-strategy-scanner-job";

/**
 * Scheduled hook for `options_scanner` — delegates to {@link executeOptionsStrategyScannerJob}.
 */
export async function runOptionsStrategyScanner(
  task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  return executeOptionsStrategyScannerJob({ tenantId: task.tenantId });
}
