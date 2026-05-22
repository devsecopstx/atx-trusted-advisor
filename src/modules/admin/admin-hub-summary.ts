import type { AdminHubQuickStat, AdminHubSummaryResponse } from "@/lib/admin-hub-summary-contract";
import { startOfUtcDay } from "@/lib/audit-login-utc-day";
import type { SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
    computeOpsCostEstimate,
    readDefaultCloudRunVcpuHoursToday,
    readOpsCostRatesFromEnv
} from "@/modules/admin/ops-cost-estimate";
import {
    listScheduledTasks,
    pruneDuplicateSystemWideScheduledTasks
} from "@/modules/core-admin/repository";
import { ACTIONABLE_ACCESS_REQUEST_STATUSES } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { listBatchJobs } from "@/modules/xchat/batch-service";

const ACCESS_REQUESTS = "admin_access_requests";
const TASK_RUNS = "admin_task_runs";
const AUDIT_LOGIN = "audit_login";
const XCHAT_USAGE = "xchat_usage_limits";
const STRATEGY_JOBS = "strategy_jobs";

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return amount < 0.01 ? "<$0.01" : `$${amount.toFixed(2)}`;
}

export async function collectAdminHubSummary(session: SessionUser): Promise<AdminHubSummaryResponse> {
  const db = await getDb();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const platformWide = isGlobalAdmin(session.roles);
  const tenantHex = session.tenantId.trim();

  const pendingAccessRequests = await db.collection(ACCESS_REQUESTS).countDocuments({
    status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES }
  });

  await pruneDuplicateSystemWideScheduledTasks();
  const scheduledRows = await listScheduledTasks({ tenantId: tenantHex, systemWideOnly: true });
  const enabledScheduledJobs = scheduledRows.filter((row) => row.enabled).length;

  const failedTaskRuns24h = await db.collection(TASK_RUNS).countDocuments({
    status: "failed",
    startedAt: { $gte: since24h }
  });

  const batchJobs =
    (await listBatchJobs({
      tenantId: platformWide ? undefined : tenantHex,
      limit: 100
    })) ?? [];
  const batchJobsNeedingAttention = batchJobs.filter((job) => {
    const status = (job.status ?? "").toLowerCase();
    if (status === "failed" || status === "cancelled" || status === "canceled") {
      return true;
    }
    return status === "running" || status === "pending" || status === "queued";
  }).length;

  const usageTenantMatch: Record<string, unknown> =
    platformWide || !tenantHex ? {} : { tenantId: tenantHex };
  const dayAgg = await db
    .collection<{ kind: string; count: number; bucketStart: Date }>(XCHAT_USAGE)
    .aggregate<{ total: number }>([
      { $match: { kind: "day", bucketStart: dayStart, ...usageTenantMatch } },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ])
    .toArray();
  const promptsToday = dayAgg[0]?.total ?? 0;

  const mtdAgg = await db
    .collection<{ kind: string; count: number; bucketStart: Date }>(XCHAT_USAGE)
    .aggregate<{ total: number }>([
      { $match: { kind: "day", bucketStart: { $gte: monthStart }, ...usageTenantMatch } },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ])
    .toArray();
  const promptsMtd = mtdAgg[0]?.total ?? 0;

  const strategyFilter: Record<string, unknown> = {};
  if (!platformWide && tenantHex) {
    strategyFilter.tenantId = tenantHex;
  }
  const strategyJobsToday = await db.collection(STRATEGY_JOBS).countDocuments({
    ...strategyFilter,
    createdAt: { $gte: dayStart }
  });
  const strategyJobsMtd = await db.collection(STRATEGY_JOBS).countDocuments({
    ...strategyFilter,
    createdAt: { $gte: monthStart }
  });

  const cost = computeOpsCostEstimate(
    {
      xchatPromptsToday: promptsToday,
      xchatPromptsMtd: promptsMtd,
      strategyJobsToday,
      strategyJobsMtd,
      estimatedCloudRunVcpuHoursToday: readDefaultCloudRunVcpuHoursToday(),
      estimatedCloudRunVcpuHoursMtd: readDefaultCloudRunVcpuHoursToday() * now.getUTCDate()
    },
    readOpsCostRatesFromEnv()
  );
  const xchatSpendTodayUsd = cost.todayTotalUsd;

  let loginsToday: number | null = null;
  let loginsTodayUnavailable: string | undefined;
  if (platformWide) {
    loginsToday = await db.collection(AUDIT_LOGIN).countDocuments({
      createdAt: { $gte: dayStart }
    });
  } else {
    loginsTodayUnavailable = "Requires global_admin session.";
  }

  const quickStats: AdminHubQuickStat[] = [
    {
      id: "pending-access",
      label: "Pending access",
      value: String(pendingAccessRequests),
      href: "/admin/manage-users",
      emphasis: pendingAccessRequests > 0 ? "warn" : "default",
      title: "Open access requests awaiting review"
    },
    {
      id: "scheduled-jobs",
      label: "Scheduled jobs",
      value: String(enabledScheduledJobs),
      href: "/admin/tasks",
      title: "Enabled tenant-level scheduler jobs"
    },
    {
      id: "failed-runs",
      label: "Failed runs (24h)",
      value: String(failedTaskRuns24h),
      href: "/admin/tasks",
      emphasis: failedTaskRuns24h > 0 ? "warn" : "default",
      title: "Scheduled task runs that failed in the last 24 hours"
    },
    {
      id: "batch-attention",
      label: "Batch jobs active",
      value: String(batchJobsNeedingAttention),
      href: "/admin/batch",
      emphasis: batchJobsNeedingAttention > 0 ? "warn" : "default",
      title: "xChat batch jobs running or needing attention"
    },
    {
      id: "xchat-spend",
      label: "Est. xChat spend today",
      value: formatUsd(xchatSpendTodayUsd),
      href: "/admin/xchat-tool-usage",
      title: "Conservative USD estimate from prompt usage buckets"
    },
    {
      id: "logins-today",
      label: "Logins today (UTC)",
      value: loginsToday === null ? "—" : String(loginsToday),
      href: loginsToday === null ? "/admin/login-audit" : "/admin/logins-today",
      title: loginsTodayUnavailable ?? "All login attempts since UTC midnight"
    }
  ];

  return {
    generatedAt: now.toISOString(),
    sessionTenantId: tenantHex,
    pendingAccessRequests,
    enabledScheduledJobs,
    failedTaskRuns24h,
    batchJobsNeedingAttention,
    xchatSpendTodayUsd,
    loginsToday,
    loginsTodayUnavailable,
    quickStats
  };
}
