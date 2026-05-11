import {
    type ScheduledTaskCategory,
    SCHEDULED_TASK_CATEGORIES
} from "@/lib/scheduled-task-category-schema";

/**
 * Canonical admin + ops metadata per scheduled-task category (sync script, `/admin/tasks` templates).
 * Keep descriptions aligned with `task-runner.ts` executors and design-system scheduled-task docs.
 */
export type ScheduledTaskCategoryCatalogEntry = {
  /** Human-readable name (used by sync script `name` field and admin labels). */
  displayName: string;
  /** Default `name` on create (kebab-case, matches job module conventions where applicable). */
  defaultJobName: string;
  /** Shown in Admin → Schedule tasks template table and create form. */
  description: string;
};

export const SCHEDULED_TASK_CATEGORY_CATALOG: Record<
  ScheduledTaskCategory,
  ScheduledTaskCategoryCatalogEntry
> = {
  price_scanner: {
    displayName: "Price scanner (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "price-scanner-job",
    description:
      "Reads portfolios, holdings, and watchlists, fetches Yahoo quotes, updates tenant market calendar during the desk window, and drives portfolio price alerts."
  },
  options_scanner: {
    displayName: "Options strategy scanner (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "options-scanner-job",
    description:
      "Runs the unified options strategy scanner: strategy/prefs inventory, option positions and watchlist targets, Yahoo chain passes, portfolio_recommendations upserts, and SELL-signal alerts (Next.js executor; JVM tick is engine dry-run only when scheduled on Kotlin)."
  },
  user_access_requests: {
    displayName: "User access requests (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "user-access-request-job",
    description:
      "Monitors the access-request queue (actionable backlog and recent approvals) for admin operations."
  },
  "sync-broker": {
    displayName: "Broker sync (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "sync-broker-job",
    description:
      "Broker sync / holdings import. When appBrokerImportJobId is set (app user /import-activity), Next runs staged CSV from app_broker_import_jobs; otherwise a placeholder success summary until live connectors are wired."
  },
  rebalance: {
    displayName: "Rebalance (post US close, UTC weekdays)",
    defaultJobName: "rebalance-job",
    description:
      "Runs rebalance / allocation-drift analysis after US cash close (UTC-oriented cron); execution on Next.js task-runner."
  },
  compliance: {
    displayName: "Compliance (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "compliance-job",
    description:
      "Placeholder compliance scan; records a completed summary until compliance rules engine is integrated."
  },
  notifications: {
    displayName: "Notifications digest (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "notifications-job",
    description:
      "Placeholder notification digest task for scheduled summaries until notification dispatch is fully connected."
  },
  "user-history": {
    displayName: "User history agent (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "user-history-job",
    description:
      "Runs the user-history agent pass for xChat context hygiene (tenant-scoped; may execute on Kotlin worker when enabled)."
  },
  watchlist_price_scanner: {
    displayName: "Watchlist price scanner (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "watchlist-price-scanner-job",
    description:
      "Tenant-scoped sweep: every `portfolio_watchlists` row for the tenant (one canonical watchlist per user). Processes each user’s symbol list in order; duplicate tickers in the same list each get their own quote-backed row update. Yahoo batch quotes, `lastPrice` updates, optional **finance-advisor** xPersona Grok rationale per row (capped by `WATCHLIST_SCANNER_GROK_MAX_CALLS`), scanner audit line on `rationale`, `rowStatus` → `review`, and price-move alerts. Same US market desk window as `price_scanner` (skips with keyed `watchlist_price_scanner: skipped — …` when closed/holiday). Summaries include `persona_grok_calls`, `rows_marked_review`, `items_updated`, `symbols_quoted`, `duration_s`, …."
  },
  corporate_events_scanner: {
    displayName: "Corporate events (weekday 30m cadence, UTC)",
    defaultJobName: "corporate-events-scanner-job",
    description:
      "corporate-events scanner; full execution on Next.js task-runner (Kotlin tick is noop with routing message)."
  },
  income_cash_flow_projector: {
    displayName: "Income / cash-flow projector (post US close, UTC weekdays)",
    defaultJobName: "income-cash-flow-projector-job",
    description:
      "income and cash-flow projection pass after US close; runs on Next.js task-runner."
  },
  options_expiration_roll_manager: {
    displayName: "Options expiration / roll (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "options-expiration-roll-manager-job",
    description:
      "options expiration and roll manager; runs on Next.js task-runner."
  },
  risk_concentration_scanner: {
    displayName: "Risk concentration (daily weekday evening, UTC)",
    defaultJobName: "risk-concentration-scanner-job",
    description:
      "risk concentration scanner; runs on Next.js task-runner."
  },
  tax_loss_harvest_scanner: {
    displayName: "Tax-loss harvest (daily, UTC)",
    defaultJobName: "tax-loss-harvest-scanner-job",
    description:
      "tax-loss harvest scanner; runs on Next.js task-runner."
  },
  marketing_post: {
    displayName: "Marketing post scheduler (weekdays 13:00 UTC)",
    defaultJobName: "marketing-post-job",
    description:
      "Publishes templated or custom marketing posts with required disclaimer + UTM tagging to enabled social platforms."
  },
  user_alert_manager: {
    displayName: "User price alert manager (hourly Mon–Fri 14–21 UTC)",
    defaultJobName: "user-alert-manager-job",
    description:
      "Tenant-scoped NL price alerts (`portfolio_price_alerts`): batch Yahoo quotes for every distinct armed symbol, crossing evaluation, desk alerts + optional branded email, expiry sweep — complements watchlist_price_scanner for symbols off watchlists."
  },
  xchat_spend_alert: {
    displayName: "xChat vendor spend alert (weekdays 13:30 UTC)",
    defaultJobName: "xchat-spend-alert-job",
    description:
      "Tenant-only: sums rolling 24h `xchat_logs.xaiUsage.costUsdTicks` (xAI `usage.cost_in_usd_ticks`) and compares to `core_tenants.tenantPreferences.xchat_daily_spend_alert_usd_ticks`. Emits a breach line in task output / Slack when over threshold. **Not auto-seeded** — create manually per tenant."
  },
  tenant_export_worker: {
    displayName: "Tenant admin export worker (queue drain, every 15m UTC)",
    defaultJobName: "tenant-export-worker",
    description:
      "Processes **`tenant_admin_export_jobs`** queued by **Admin → Tenant register → Workspace limits → Export jobs** (`live_spec_yaml`, `bootstrap_audit_csv`). FIFO pending→running→completed. Create **one tenant-scoped** scheduled task row (category `tenant_export_worker`) or run manually from Admin → Tasks — **excluded from `ops:scheduled-tasks:sync` bulk upsert**."
  },
  investment_outlook_scanner: {
    displayName: "Investment outlook / wheel ideas (post US close, UTC weekdays)",
    defaultJobName: "investment-outlook-scanner-job",
    description:
      "Refreshes **`investment_outlooks`** pre-computed covered-call / CSP strike candidates per portfolio (Yahoo chains + Mongo cache). Runs on the **Next.js task-runner** via **`admin_scheduled_tasks`** — same JVM **ShedLock** poller as other scheduled categories (`AdminSchedulerPoller` → Mongo due tasks). **Not** the interactive Premium `POST /api/strategy-jobs` orchestrator (that path remains for xOptions slot jobs). Disable with env **`INVESTMENT_OUTLOOK_SCANNER_ENABLED=0`** on the worker or omit/disable the scheduled row."
  }
} satisfies Record<ScheduledTaskCategory, ScheduledTaskCategoryCatalogEntry>;

/** Display names only — shared with `scripts/ops/sync-scheduled-tasks-from-spec.ts`. */
export const SCHEDULED_TASK_CATEGORY_DISPLAY_NAME: Record<ScheduledTaskCategory, string> =
  Object.fromEntries(
    SCHEDULED_TASK_CATEGORIES.map((c) => [c, SCHEDULED_TASK_CATEGORY_CATALOG[c]!.displayName])
  ) as Record<ScheduledTaskCategory, string>;
