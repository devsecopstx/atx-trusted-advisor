import type { ObjectId } from "mongodb";

export type UserTaskType = "prompt" | "strategy" | "scan" | "report";

/** Desk scope for prompt enrichment (portfolio book, watchlist, or general). */
export type UserTaskScopeKind = "portfolio" | "watchlist" | "all";

export type UserTaskDeliveryChannel = "in_app" | "email";

export type UserTaskParams = {
  scope?: UserTaskScopeKind;
  /** Mirrors risk hints for future strategy hooks; stored only. */
  riskProfile?: "conservative" | "balanced" | "aggressive";
  symbols?: string[];
};

export type UserTask = {
  _id?: ObjectId;
  tenantId: ObjectId;
  userId: ObjectId;
  /** Optional workspace portfolio for portfolio-scoped prompts / future strategy hooks. */
  portfolioId?: ObjectId | null;
  name: string;
  description?: string;
  type: UserTaskType;
  /** Primary prompt text for `prompt` tasks (xChat routing). */
  prompt: string;
  /** Optional published persona id for xChat (same semantics as POST /api/xchat/ask `personaId`). */
  personaId?: string | null;
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
  /** Preset label when user picks daily/weekly/monthly instead of raw cron. */
  schedulePreset?: "daily" | "weekly" | "monthly" | null;
  /** IANA timezone for display / future RRULE TZID — scheduling math uses UTC cron for MVP. */
  timeZone?: string;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
  enabled: boolean;
  lastResultSnippet?: string | null;
  lastRunId?: ObjectId | null;
  delivery: UserTaskDeliveryChannel[];
  params?: UserTaskParams;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: ObjectId;
  updatedByUserId: ObjectId;
};

export type UserTaskRunStatus = "running" | "success" | "failed" | "skipped";

export type UserTaskRun = {
  _id?: ObjectId;
  tenantId: ObjectId;
  userId: ObjectId;
  taskId: ObjectId;
  status: UserTaskRunStatus;
  triggeredBy: string;
  /** Short excerpt for list UI / email preheader */
  outputSnippet?: string;
  errorCode?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  /** Optional deep link (e.g. xChat thread) */
  linkHint?: string;
};
