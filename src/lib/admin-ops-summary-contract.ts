import type { RedisHealth } from "@/lib/redis-client";

export type AdminOpsSummaryBackend = {
  role: "compute_backend";
  label: string;
  configured: boolean;
  origin: string | null;
  skippedReason?: string;
  httpReachable: boolean;
  httpStatus?: number;
  fetchError?: string;
  service?: string;
  timeUtc?: string;
  mongoStatus?: string;
  redisStatus?: string;
  redisDetail?: string;
};

export type AdminOpsXchatStats = {
  promptsToday: number;
  hourlyPeakToday: number;
  xchatLogsPromptCountToday?: number;
};

export type AdminOpsJobRunRow = {
  jobId: string;
  jobType: "xchat_batch" | "strategy_job" | "scheduled_task" | "options_scanner";
  trigger: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  durationMs: number | null;
  durationLabel: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  itemsProcessed: number | null;
  errors: number | null;
  detailHref: string;
};

export type AdminOpsCostEstimateDto = {
  currency: "USD";
  todayTotalUsd: number;
  monthToDateTotalUsd: number;
  breakdownToday: {
    xchatUsd: number;
    strategyJobsUsd: number;
    cloudRunUsd: number;
  };
  breakdownMonthToDate: {
    xchatUsd: number;
    strategyJobsUsd: number;
    cloudRunUsd: number;
  };
  rates: {
    xaiCostPerPromptUsd: number;
    strategyJobPerRunUsd: number;
    gcpRunCostPerVcpuHourUsd: number;
  };
  notes: string[];
};

export type AdminOpsPlatformMetrics = {
  scope: "platform" | "tenant";
  tenantsActive: number;
  usersRegistered: number;
  logins24h: number | null;
  logins7d: number | null;
  loginsUnavailableReason?: string;
  currentTenantSlug?: string | null;
  currentTenantName?: string | null;
  xchat: AdminOpsXchatStats;
  lastFiveJobs: AdminOpsJobRunRow[];
  costEstimate: AdminOpsCostEstimateDto;
};

export type AdminOpsSummaryResponse = {
  generatedAt: string;
  sessionTenantId: string;
  nextApp: {
    role: "frontend";
    label: string;
    service: string;
    version: string;
    database: { ok: boolean; name: string | null; error?: string };
    redis: RedisHealth;
  };
  backend: AdminOpsSummaryBackend;
  platformOps: AdminOpsPlatformMetrics;
};
