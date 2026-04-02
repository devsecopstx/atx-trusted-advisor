import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import { executePriceScannerJob } from "@/modules/scanner/price-scanner-job";

export {
  executePriceScannerJob,
  PRICE_SCANNER_SERVICE_ID,
  type PriceScannerJobInput
} from "@/modules/scanner/price-scanner-job";

export async function runPriceScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  return executePriceScannerJob({ tenantId: task.tenantId });
}
