import type { ScheduledTask } from "@/modules/core-admin/types";
import { refreshInvestmentOutlooksForTenant } from "@/modules/portfolio/investment-outlooks";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";

function scannerDisabled(): boolean {
  const v = String(process.env.INVESTMENT_OUTLOOK_SCANNER_ENABLED ?? "").toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

/**
 * Scheduled category `investment_outlook_scanner` — regenerates `investment_outlooks` for the task tenant.
 * Dispatched from Mongo **`admin_scheduled_tasks`** (JVM ShedLock poller or manual Admin → Run).
 *
 * **Note:** Interactive **`POST /api/strategy-jobs`** remains the Spring xOptions orchestrator; this job is the
 * batch outlook refresh path so xChat reads precomputed rows only.
 */
export async function runInvestmentOutlookScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const taskCategoryTag = "investment_outlook_scanner";
  const start = Date.now();
  if (scannerDisabled()) {
    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    return {
      status: "success",
      output: `${taskCategoryTag}: skipped=true reason=INVESTMENT_OUTLOOK_SCANNER_ENABLED off duration_s=${durationSeconds}`,
      auditDetails: { skipped: true, taskCategory: taskCategoryTag, durationSeconds }
    };
  }
  if (!task.tenantId) {
    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    return {
      status: "success",
      output: `${taskCategoryTag}: skipped=true reason=missing_scheduled_task_tenantId duration_s=${durationSeconds}`,
      auditDetails: { skipped: true, taskCategory: taskCategoryTag, skipReason: "missing_tenant_id", durationSeconds }
    };
  }
  try {
    await refreshInvestmentOutlooksForTenant(task.tenantId);
    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    return {
      status: "success",
      output: `${taskCategoryTag}: refreshed tenant portfolios tenantId=${task.tenantId.toHexString()} duration_s=${durationSeconds}`,
      auditDetails: { taskCategory: taskCategoryTag, durationSeconds }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
    return {
      status: "failed",
      output: `${taskCategoryTag}: failed: ${msg} duration_s=${durationSeconds}`
    };
  }
}
