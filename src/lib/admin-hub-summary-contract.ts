export type AdminHubQuickStat = {
  id: string;
  label: string;
  value: string;
  href: string;
  emphasis?: "default" | "warn" | "ok";
  title?: string;
};

export type AdminHubSummaryResponse = {
  generatedAt: string;
  sessionTenantId: string;
  pendingAccessRequests: number;
  enabledScheduledJobs: number;
  failedTaskRuns24h: number;
  batchJobsNeedingAttention: number;
  xchatSpendTodayUsd: number | null;
  loginsToday: number | null;
  loginsTodayUnavailable?: string;
  quickStats: AdminHubQuickStat[];
};
