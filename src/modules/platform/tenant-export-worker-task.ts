import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import { processTenantExportJob } from "@/modules/platform/tenant-admin-export-processor";
import {
  claimNextPendingTenantExportJob,
  ensureTenantExportJobIndexes,
  getTenantExportJobById
} from "@/modules/platform/tenant-admin-export-repository";

function maxJobsPerRun(): number {
  const raw = process.env.TENANT_EXPORT_WORKER_MAX_JOBS_PER_RUN;
  const n = raw ? Number(raw) : 8;
  if (!Number.isFinite(n) || n < 1) {
    return 8;
  }
  return Math.min(32, Math.floor(n));
}

/**
 * Drains **`tenant_admin_export_jobs`** FIFO (pending → running → completed/failed).
 * Scheduled as a **tenant-scoped** `admin_scheduled_tasks` row (see ops doc); **`task.tenantId`** is ignored for
 * claiming — jobs carry their own tenant scope.
 */
export async function runTenantExportWorkerTask(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  await ensureTenantExportJobIndexes();
  const cap = maxJobsPerRun();
  let drained = 0;
  const lines: string[] = [];

  for (let i = 0; i < cap; i++) {
    const claimed = await claimNextPendingTenantExportJob();
    if (!claimed?._id) {
      break;
    }
    const jobId = claimed._id;
    const tenantId = claimed.tenantId;
    await processTenantExportJob(jobId, tenantId);
    drained += 1;
    const refreshed = (await getTenantExportJobById({ jobId, tenantId })) ?? claimed;
    lines.push(
      `job=${jobId.toHexString()} tenant=${tenantId.toHexString()} status=${refreshed.status}`
    );
  }

  const output = `tenant_export_worker task="${task.name}" drained=${drained}\n${lines.join("\n")}`;
  return {
    status: "success",
    output,
    auditDetails: { tenantExportWorker: true, drained }
  };
}
