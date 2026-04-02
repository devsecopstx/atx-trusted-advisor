import { z } from "zod";

/** Single source for admin API + UI — keep in sync with `ScheduledTask["category"]` in core-admin types. */
export const SCHEDULED_TASK_CATEGORIES = [
  "price_scanner",
  "options_scanner",
  "user_access_requests",
  "sync-broker",
  "rebalance",
  "compliance",
  "notifications",
  "user-history",
  "watchlist_price_scanner",
  "daily_options_scanner",
] as const;

export type ScheduledTaskCategory = (typeof SCHEDULED_TASK_CATEGORIES)[number];

/** Weekday desk window: every 15m from 08:00–17:59 UTC (align cron TZ with your scheduler if needed). */
export const DEFAULT_SCHEDULED_TASK_CRON = "0,15,30,45 8-17 * * 1-5";

export const SCHEDULED_TASK_CATEGORY_DEFAULT_CRON: Record<ScheduledTaskCategory, string> = {
  price_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  options_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  user_access_requests: DEFAULT_SCHEDULED_TASK_CRON,
  "sync-broker": DEFAULT_SCHEDULED_TASK_CRON,
  rebalance: DEFAULT_SCHEDULED_TASK_CRON,
  compliance: DEFAULT_SCHEDULED_TASK_CRON,
  notifications: DEFAULT_SCHEDULED_TASK_CRON,
  "user-history": DEFAULT_SCHEDULED_TASK_CRON,
  watchlist_price_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  daily_options_scanner: DEFAULT_SCHEDULED_TASK_CRON
};

export const scheduledTaskCategorySchema = z.enum(SCHEDULED_TASK_CATEGORIES);
