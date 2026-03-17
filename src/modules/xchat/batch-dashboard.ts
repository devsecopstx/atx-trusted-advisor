import type { BatchJobRecord } from "@/modules/xchat/batch-service";

const TERMINAL_BATCH_STATUSES = new Set(["completed", "failed", "cancelled", "expired"]);

export type BatchDashboardJob = {
  xaiBatchId: string;
  status: string;
  personaName: string;
  submittedBy: string;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  completionPct: number;
  errorPct: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  lastError: string | null;
  isTerminal: boolean;
};

export type BatchDashboardSummary = {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  pendingItems: number;
  completionPct: number;
  errorPct: number;
};

export function toBatchDashboardJob(
  job: BatchJobRecord,
  lastError: string | null = null
): BatchDashboardJob {
  const completedCount = Math.max(0, job.completedCount ?? 0);
  const failedCount = Math.max(0, job.failedCount ?? 0);
  const itemCount = Math.max(0, job.itemCount ?? 0);
  const pendingCount = Math.max(0, itemCount - completedCount - failedCount);
  const completionPct =
    itemCount > 0 ? Math.min(100, Math.round(((completedCount + failedCount) / itemCount) * 100)) : 0;
  const errorPct = itemCount > 0 ? Math.min(100, Math.round((failedCount / itemCount) * 100)) : 0;

  return {
    xaiBatchId: job.xaiBatchId,
    status: job.status,
    personaName: job.personaName,
    submittedBy: job.submittedBy,
    itemCount,
    completedCount,
    failedCount,
    pendingCount,
    completionPct,
    errorPct,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    lastError,
    isTerminal: TERMINAL_BATCH_STATUSES.has(job.status)
  };
}

export function buildBatchDashboardSummary(jobs: BatchDashboardJob[]): BatchDashboardSummary {
  const totals = jobs.reduce(
    (acc, job) => {
      acc.totalItems += job.itemCount;
      acc.completedItems += job.completedCount;
      acc.failedItems += job.failedCount;
      acc.pendingItems += job.pendingCount;
      if (job.status === "completed") acc.completedJobs += 1;
      if (job.status === "failed") acc.failedJobs += 1;
      if (!job.isTerminal) acc.activeJobs += 1;
      return acc;
    },
    {
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      pendingItems: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0
    }
  );

  const completionPct =
    totals.totalItems > 0
      ? Math.min(
          100,
          Math.round(((totals.completedItems + totals.failedItems) / totals.totalItems) * 100)
        )
      : 0;
  const errorPct =
    totals.totalItems > 0 ? Math.min(100, Math.round((totals.failedItems / totals.totalItems) * 100)) : 0;

  return {
    totalJobs: jobs.length,
    activeJobs: totals.activeJobs,
    completedJobs: totals.completedJobs,
    failedJobs: totals.failedJobs,
    totalItems: totals.totalItems,
    completedItems: totals.completedItems,
    failedItems: totals.failedItems,
    pendingItems: totals.pendingItems,
    completionPct,
    errorPct
  };
}
