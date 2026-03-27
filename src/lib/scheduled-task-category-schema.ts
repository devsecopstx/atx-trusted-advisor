import { z } from "zod";

/** Single source for admin API + UI — keep in sync with `ScheduledTask["category"]` in core-admin types. */
export const SCHEDULED_TASK_CATEGORIES = [
  "sync-broker",
  "rebalance",
  "compliance",
  "notifications",
  "user-history",
  "watchlist_price_scanner",
  "daily_options_scanner",
] as const;

export const scheduledTaskCategorySchema = z.enum(SCHEDULED_TASK_CATEGORIES);
