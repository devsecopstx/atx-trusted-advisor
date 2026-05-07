import { ObjectId } from "mongodb";

import type {
    AdminOpsCostEstimateDto,
    AdminOpsJobRunRow,
    AdminOpsPlatformMetrics,
    AdminOpsXchatStats
} from "@/lib/admin-ops-summary-contract";
import { getDb } from "@/lib/mongodb";
import {
    computeOpsCostEstimate,
    defaultCloudRunVcpuHoursMtd,
    readDefaultCloudRunVcpuHoursToday,
    readOpsCostRatesFromEnv,
    type OpsCostEstimateResult
} from "@/modules/admin/ops-cost-estimate";
import { listTaskRuns } from "@/modules/core-admin/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import type { Tenant } from "@/modules/identity/types";
import { listBatchJobs, type BatchJobRecord } from "@/modules/xchat/batch-service";

const STRATEGY_JOBS = "strategy_jobs";
const AUDIT_LOGIN = "audit_login";
const CORE_USERS = "core_users";
const CORE_TENANTS = "core_tenants";
const MEMBERSHIPS = "core_tenant_memberships";
const XCHAT_USAGE = "xchat_usage_limits";
const XCHAT_LOGS = "xchat_logs";

type UsageBucketDoc = {
  kind: string;
  count: number;
  bucketStart: Date;
  tenantId?: string;
};

type StrategyJobDoc = {
  _id: ObjectId;
  tenantId?: string;
  userId?: string;
  status?: string;
  artifactStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
  turns?: unknown[];
  slots?: Record<string, unknown>;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return null;
  }
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

function normalizeUnifiedStatus(
  kind: "batch" | "task" | "strategy",
  raw: string | undefined,
  artifactStatus?: string | undefined
): AdminOpsJobRunRow["status"] {
  const s = (raw ?? "").toLowerCase();
  if (kind === "task") {
    if (s === "success") {
      return "success";
    }
    if (s === "failed") {
      return "failed";
    }
    return "running";
  }
  if (kind === "batch") {
    if (s === "completed") {
      return "success";
    }
    if (s === "failed" || s === "cancelled" || s === "canceled") {
      return "failed";
    }
    return "running";
  }
  const art = (artifactStatus ?? "").toLowerCase();
  if (art === "failed") {
    return "failed";
  }
  if (s === "slots_complete" && (art === "ready" || art === "")) {
    return art === "ready" ? "success" : "running";
  }
  if (s === "slots_complete" && (art === "pending" || art === "running")) {
    return "running";
  }
  if (s === "collecting") {
    return "running";
  }
  return "running";
}

function strategyJobDurationMs(doc: StrategyJobDoc): number | null {
  const a = doc.createdAt?.getTime();
  const b = doc.updatedAt?.getTime();
  if (a === undefined || b === undefined) {
    return null;
  }
  const d = b - a;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function strategyJobItems(doc: StrategyJobDoc): { processed: number | null; errors: number | null } {
  const turns = Array.isArray(doc.turns) ? doc.turns.length : 0;
  const slotCount =
    doc.slots && typeof doc.slots === "object" ? Object.keys(doc.slots).length : 0;
  const processed = Math.max(turns, slotCount, 0);
  const art = (doc.artifactStatus ?? "").toLowerCase();
  const errors = art === "failed" ? 1 : 0;
  return { processed: processed > 0 ? processed : null, errors };
}

function classifyTaskType(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("scanner") || c.includes("scan")) {
    return "options_scanner";
  }
  return "scheduled_task";
}

function batchTrigger(job: BatchJobRecord): string {
  const sub = job.submittedBy?.trim();
  if (sub) {
    return sub.includes("@") || sub.includes(":") ? sub : `user:${sub}`;
  }
  return `user:${job.userId}`;
}

function toDetailHref(
  jobType: AdminOpsJobRunRow["jobType"],
  jobId: string,
  xaiBatchId?: string
): string {
  if (jobType === "xchat_batch") {
    return `/admin/batch/${xaiBatchId ?? jobId}`;
  }
  if (jobType === "strategy_job") {
    return `/xoptions?strategyJobId=${encodeURIComponent(jobId)}`;
  }
  return `/admin/tasks`;
}

export async function collectPlatformOpsMetrics(input: {
  session: { tenantId: string; roles: string[] };
}): Promise<AdminOpsPlatformMetrics> {
  const db = await getDb();
  const now = new Date();
  const platformWide = isGlobalAdmin(input.session.roles);
  const tenantHex = input.session.tenantId.trim();
  const tenantOid = ObjectId.isValid(tenantHex) ? new ObjectId(tenantHex) : null;

  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const tenantLabelMap = new Map<string, { slug: string; name: string }>();
  const tenants = await db
    .collection<Tenant>(CORE_TENANTS)
    .find({}, { projection: { slug: 1, name: 1 } })
    .toArray();
  for (const t of tenants) {
    if (t._id) {
      tenantLabelMap.set(t._id.toHexString(), { slug: t.slug, name: t.name });
    }
  }

  let tenantsActive = 0;
  let usersRegistered = 0;
  let logins24h: number | null = null;
  let logins7d: number | null = null;
  let loginsUnavailableReason: string | undefined;

  if (platformWide) {
    tenantsActive = await db.collection(CORE_TENANTS).countDocuments({});
    usersRegistered = await db.collection(CORE_USERS).countDocuments({});
    logins24h = await db
      .collection(AUDIT_LOGIN)
      .countDocuments({ outcome: "success", createdAt: { $gte: since24h } });
    logins7d = await db
      .collection(AUDIT_LOGIN)
      .countDocuments({ outcome: "success", createdAt: { $gte: since7d } });
  } else {
    tenantsActive = 1;
    if (tenantOid) {
      usersRegistered = await db.collection(MEMBERSHIPS).countDocuments({ tenantId: tenantOid });
    } else {
      usersRegistered = 0;
    }
    logins24h = null;
    logins7d = null;
    loginsUnavailableReason =
      "Login totals require platform-wide audit (`audit_login`). Switch to a global admin session or open Login audit.";
  }

  const usageTenantMatch: Record<string, unknown> =
    platformWide || !tenantHex ? {} : { tenantId: tenantHex };

  const dayUsageFilter: Record<string, unknown> = {
    kind: "day",
    bucketStart: dayStart,
    ...usageTenantMatch
  };
  const dayAgg = await db
    .collection<UsageBucketDoc>(XCHAT_USAGE)
    .aggregate<{ total: number }>([
      { $match: dayUsageFilter },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ])
    .toArray();
  const promptsToday = dayAgg[0]?.total ?? 0;

  const hourAgg = await db
    .collection<UsageBucketDoc>(XCHAT_USAGE)
    .aggregate<{ promptsInHour: number }>([
      {
        $match: {
          kind: "hour",
          bucketStart: { $gte: dayStart, $lte: now },
          ...usageTenantMatch
        }
      },
      { $group: { _id: "$bucketStart", promptsInHour: { $sum: "$count" } } },
      { $sort: { promptsInHour: -1 } },
      { $limit: 1 }
    ])
    .toArray();
  const hourlyPeakToday = hourAgg[0]?.promptsInHour ?? 0;

  let xchatLogsPromptCountToday: number | undefined;
  const includeLogs = process.env.OPS_SUMMARY_INCLUDE_XCHAT_LOGS === "1";
  if (includeLogs) {
    const q: Record<string, unknown> = { createdAt: { $gte: dayStart } };
    if (!platformWide && tenantOid) {
      q.tenantId = tenantOid;
    }
    xchatLogsPromptCountToday = await db.collection(XCHAT_LOGS).countDocuments(q);
  }

  const xchatStats: AdminOpsXchatStats = {
    promptsToday,
    hourlyPeakToday,
    ...(xchatLogsPromptCountToday !== undefined ? { xchatLogsPromptCountToday } : {})
  };

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

  const mtdUsageFilter: Record<string, unknown> = {
    kind: "day",
    bucketStart: { $gte: monthStart },
    ...usageTenantMatch
  };
  const mtdAgg = await db
    .collection<UsageBucketDoc>(XCHAT_USAGE)
    .aggregate<{ total: number }>([
      { $match: mtdUsageFilter },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ])
    .toArray();
  const promptsMtd = mtdAgg[0]?.total ?? 0;

  const hoursToday = readDefaultCloudRunVcpuHoursToday();
  const hoursMtd = defaultCloudRunVcpuHoursMtd(now, hoursToday);
  const rates = readOpsCostRatesFromEnv();
  const costNotes: string[] = [
    "Conservative estimate; tune via OPS_SUMMARY_* env vars.",
    "Logins sourced from `audit_login` (successful sign-ins).",
    "xChat prompts from `xchat_usage_limits` day/hour buckets.",
    "Cloud Run hours default flat per OPS_SUMMARY_CLOUD_RUN_VCPU_HOURS_TODAY × UTC day-of-month for MTD."
  ];
  if (!platformWide && tenantsActive > 0) {
    costNotes.push("Tenant view: Cloud Run row uses platform default hours (not divided per tenant).");
  }

  const rawCost: OpsCostEstimateResult = computeOpsCostEstimate(
    {
      xchatPromptsToday: promptsToday,
      xchatPromptsMtd: promptsMtd,
      strategyJobsToday,
      strategyJobsMtd,
      estimatedCloudRunVcpuHoursToday: hoursToday,
      estimatedCloudRunVcpuHoursMtd: hoursMtd
    },
    rates,
    costNotes
  );

  const costEstimate: AdminOpsCostEstimateDto = {
    currency: rawCost.currency,
    todayTotalUsd: rawCost.todayTotalUsd,
    monthToDateTotalUsd: rawCost.monthToDateTotalUsd,
    breakdownToday: rawCost.today,
    breakdownMonthToDate: rawCost.monthToDate,
    rates: rawCost.rates,
    notes: rawCost.notes
  };

  const taskRuns = await listTaskRuns({
    limit: 15,
    allTenants: platformWide,
    tenantId: platformWide ? undefined : tenantHex
  });

  const batchJobs = await listBatchJobs({
    tenantId: platformWide ? undefined : tenantHex,
    limit: 15
  });

  const strategyCursor = db
    .collection<StrategyJobDoc>(STRATEGY_JOBS)
    .find(strategyFilter)
    .sort({ createdAt: -1 })
    .limit(15);
  const strategyDocs = await strategyCursor.toArray();

  type Candidate = {
    sortKey: number;
    row: AdminOpsJobRunRow;
  };

  const candidates: Candidate[] = [];

  for (const job of batchJobs) {
    const tenantKey = job.tenantId?.trim() ?? "";
    const labels = tenantKey ? tenantLabelMap.get(tenantKey) : undefined;
    const startedAt = job.createdAt ?? now;
    candidates.push({
      sortKey: startedAt.getTime(),
      row: {
        jobId: job.xaiBatchId,
        jobType: "xchat_batch",
        trigger: batchTrigger(job),
        status: normalizeUnifiedStatus("batch", String(job.status ?? "").toLowerCase()),
        startedAt: startedAt.toISOString(),
        durationMs:
          job.completedAt && job.createdAt
            ? job.completedAt.getTime() - job.createdAt.getTime()
            : null,
        durationLabel:
          job.completedAt && job.createdAt
            ? formatDurationMs(job.completedAt.getTime() - job.createdAt.getTime())
            : null,
        tenantSlug: labels?.slug ?? null,
        tenantName: labels?.name ?? null,
        itemsProcessed: job.itemCount,
        errors: job.failedCount,
        detailHref: toDetailHref("xchat_batch", job.xaiBatchId, job.xaiBatchId)
      }
    });
  }

  for (const run of taskRuns) {
    if (!run._id) {
      continue;
    }
    const tenantKey = run.tenantId?.toHexString() ?? "";
    const labels = tenantKey ? tenantLabelMap.get(tenantKey) : undefined;
    const jobType = classifyTaskType(run.category);
    const startedAt = run.startedAt ?? now;
    const durationMs =
      run.durationMs ??
      (run.completedAt && run.startedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null);
    candidates.push({
      sortKey: startedAt.getTime(),
      row: {
        jobId: run._id.toHexString(),
        jobType: jobType as AdminOpsJobRunRow["jobType"],
        trigger: run.triggeredBy || "system-scheduler",
        status: normalizeUnifiedStatus("task", run.status),
        startedAt: startedAt.toISOString(),
        durationMs,
        durationLabel: formatDurationMs(durationMs ?? undefined),
        tenantSlug: labels?.slug ?? null,
        tenantName: labels?.name ?? null,
        itemsProcessed: run.status === "success" ? 1 : run.status === "failed" ? 1 : null,
        errors: run.status === "failed" ? 1 : 0,
        detailHref: toDetailHref(jobType as AdminOpsJobRunRow["jobType"], run._id.toHexString())
      }
    });
  }

  for (const doc of strategyDocs) {
    const tenantKey = (doc.tenantId ?? "").trim();
    const labels = tenantKey ? tenantLabelMap.get(tenantKey) : undefined;
    const startedAt = doc.createdAt ?? now;
    const st = normalizeUnifiedStatus("strategy", doc.status, doc.artifactStatus);
    const { processed, errors } = strategyJobItems(doc);
    const durationMs = strategyJobDurationMs(doc);
    candidates.push({
      sortKey: startedAt.getTime(),
      row: {
        jobId: doc._id.toHexString(),
        jobType: "strategy_job",
        trigger: doc.userId ? `user:${doc.userId}` : "manual",
        status: st,
        startedAt: startedAt.toISOString(),
        durationMs,
        durationLabel: st === "running" ? null : formatDurationMs(durationMs ?? undefined),
        tenantSlug: labels?.slug ?? null,
        tenantName: labels?.name ?? null,
        itemsProcessed: processed,
        errors,
        detailHref: toDetailHref("strategy_job", doc._id.toHexString())
      }
    });
  }

  candidates.sort((a, b) => b.sortKey - a.sortKey);
  const lastFiveJobs = candidates.slice(0, 5).map((c) => c.row);

  let currentTenantSlug: string | null = null;
  let currentTenantName: string | null = null;
  if (tenantOid && tenantLabelMap.has(tenantOid.toHexString())) {
    const cur = tenantLabelMap.get(tenantOid.toHexString())!;
    currentTenantSlug = cur.slug;
    currentTenantName = cur.name;
  }

  return {
    scope: platformWide ? "platform" : "tenant",
    tenantsActive,
    usersRegistered,
    logins24h,
    logins7d,
    ...(loginsUnavailableReason ? { loginsUnavailableReason } : {}),
    currentTenantSlug,
    currentTenantName,
    xchat: xchatStats,
    lastFiveJobs,
    costEstimate
  };
}
