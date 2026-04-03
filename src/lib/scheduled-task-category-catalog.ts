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
    displayName: "Price scanner (weekday desk window, UTC)",
    defaultJobName: "price-scanner-job",
    description:
      "Reads portfolios, holdings, and watchlists, fetches Yahoo quotes, updates tenant market calendar during the desk window, and drives portfolio price alerts."
  },
  options_scanner: {
    displayName: "Options strategy scanner (weekday desk window, UTC)",
    defaultJobName: "options-scanner-job",
    description:
      "Runs the unified options strategy scanner: strategy/prefs inventory, option positions and watchlist targets, Yahoo chain passes, portfolio_recommendations upserts, and SELL-signal alerts (Next.js executor; JVM tick is engine dry-run only when scheduled on Kotlin)."
  },
  user_access_requests: {
    displayName: "User access requests (weekday desk window, UTC)",
    defaultJobName: "user-access-request-job",
    description:
      "Monitors the access-request queue (actionable backlog and recent approvals) for admin operations."
  },
  "sync-broker": {
    displayName: "Broker sync (weekday desk window, UTC)",
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
    displayName: "Compliance (weekday desk window, UTC)",
    defaultJobName: "compliance-job",
    description:
      "Placeholder compliance scan; records a completed summary until compliance rules engine is integrated."
  },
  notifications: {
    displayName: "Notifications digest (weekday desk window, UTC)",
    defaultJobName: "notifications-job",
    description:
      "Placeholder notification digest task for scheduled summaries until notification dispatch is fully connected."
  },
  "user-history": {
    displayName: "User history agent (weekday desk window, UTC)",
    defaultJobName: "user-history-job",
    description:
      "Runs the user-history agent pass for xChat context hygiene (tenant-scoped; may execute on Kotlin worker when enabled)."
  },
  watchlist_price_scanner: {
    displayName: "Watchlist price scanner (weekday desk window, UTC)",
    defaultJobName: "watchlist-price-scanner-job",
    description:
      "Fetches Yahoo prices for symbols across all tenant watchlists (global watchlist sweep), updates quotes, and creates price alerts—distinct from portfolio-scoped price_scanner."
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
    displayName: "Options expiration / roll (weekday desk window, UTC)",
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
  }
} satisfies Record<ScheduledTaskCategory, ScheduledTaskCategoryCatalogEntry>;

/** Display names only — shared with `scripts/ops/sync-scheduled-tasks-from-spec.ts`. */
export const SCHEDULED_TASK_CATEGORY_DISPLAY_NAME: Record<ScheduledTaskCategory, string> =
  Object.fromEntries(
    SCHEDULED_TASK_CATEGORIES.map((c) => [c, SCHEDULED_TASK_CATEGORY_CATALOG[c]!.displayName])
  ) as Record<ScheduledTaskCategory, string>;
