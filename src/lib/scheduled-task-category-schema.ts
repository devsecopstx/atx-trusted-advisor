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
  "corporate_events_scanner",
  "income_cash_flow_projector",
  "options_expiration_roll_manager",
  "risk_concentration_scanner",
  "tax_loss_harvest_scanner",
  "marketing_post",
  "user_alert_manager",
  "xchat_spend_alert",
  "tenant_export_worker",
] as const;

export type ScheduledTaskCategory = (typeof SCHEDULED_TASK_CATEGORIES)[number];

/** Weekday UTC: top of each hour 14:00–21:59 UTC Mon–Fri; task runners still gate US RTH (`resolveUsMarketDayContext`). */
export const DEFAULT_SCHEDULED_TASK_CRON = "0 14-21 * * 1-5";

/** Post-US-close snapshots (UTC-oriented; adjust if scheduler TZ differs). */
const EOD_US_CRON_UTC = "0 21 * * 1-5";
const RISK_DAILY_CRON = "0 22 * * 1-5";
const TAX_SCAN_DAILY_CRON = "0 23 * * *";

export const SCHEDULED_TASK_CATEGORY_DEFAULT_CRON: Record<ScheduledTaskCategory, string> = {
  price_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  options_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  user_access_requests: DEFAULT_SCHEDULED_TASK_CRON,
  "sync-broker": DEFAULT_SCHEDULED_TASK_CRON,
  rebalance: EOD_US_CRON_UTC,
  compliance: DEFAULT_SCHEDULED_TASK_CRON,
  notifications: DEFAULT_SCHEDULED_TASK_CRON,
  "user-history": DEFAULT_SCHEDULED_TASK_CRON,
  watchlist_price_scanner: DEFAULT_SCHEDULED_TASK_CRON,
  corporate_events_scanner: "0,30 8-17 * * 1-5",
  income_cash_flow_projector: EOD_US_CRON_UTC,
  options_expiration_roll_manager: DEFAULT_SCHEDULED_TASK_CRON,
  risk_concentration_scanner: RISK_DAILY_CRON,
  tax_loss_harvest_scanner: TAX_SCAN_DAILY_CRON,
  marketing_post: "0 13 * * 1-5",
  user_alert_manager: DEFAULT_SCHEDULED_TASK_CRON,
  /** Daily tenant xChat vendor-spend check (rolling 24h vs threshold on `core_tenants.tenantPreferences`). */
  xchat_spend_alert: "30 13 * * 1-5",
  /** Drains `tenant_admin_export_jobs` (live YAML + bootstrap CSV exports). Prefer one tenant-scoped row + manual Run; excluded from bulk spec sync. */
  tenant_export_worker: "*/15 * * * *"
};

export const scheduledTaskCategorySchema = z.enum(SCHEDULED_TASK_CATEGORIES);
