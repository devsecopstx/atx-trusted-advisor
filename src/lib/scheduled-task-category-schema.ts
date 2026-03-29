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

export const SCHEDULED_TASK_CATEGORY_DEFAULT_CRON: Record<ScheduledTaskCategory, string> = {
  price_scanner: "0 * * * 1-5",
  options_scanner: "15 9 * * 1-5",
  user_access_requests: "*/15 * * * 1-5",
  "sync-broker": "0 2 * * *",
  rebalance: "0 3 * * *",
  compliance: "0 5 * * *",
  notifications: "0 8 * * *",
  "user-history": "*/30 * * * *",
  watchlist_price_scanner: "0 * * * 1-5",
  daily_options_scanner: "15 9 * * 1-5"
};

export const scheduledTaskCategorySchema = z.enum(SCHEDULED_TASK_CATEGORIES);
