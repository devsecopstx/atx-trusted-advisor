import type { MarketingTaskConfig } from "@/modules/marketing/types";
import { ObjectId } from "mongodb";

import type { SubscriptionPlan } from "@/lib/subscription-plan";

import type { PortfolioAlertScannerMetadataV1 } from "@/lib/portfolio-alert-scan-metadata";
import type { PortfolioAlertUserPriceRuleMetadataV1 } from "@/lib/portfolio-alert-user-price-rule-metadata";

import type { PortfolioScoringFactor } from "./scoring-factors";

export const accessRequestStatusValues = [
  "new",
  "triaged",
  "pending",
  "approved",
  "rejected",
  "expired"
] as const;
export type AccessRequestStatus = (typeof accessRequestStatusValues)[number];

/** Request states an admin can still approve/reject or edit plan for */
export const ACTIONABLE_ACCESS_REQUEST_STATUSES: AccessRequestStatus[] = [
  "new",
  "triaged",
  "pending"
];

export const ACCESS_REQUEST_SLA_DAYS = 7;

export type AccessRequestPolicyViolation = {
  code: string;
  message: string;
};

export type AccessRequest = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  /** Optional real contact email; distinct from synthetic X identity login email. */
  contactEmail?: string;
  /** Product roles + `global_admin` (elevated; admin-created or seed paper trail — not self-service). */
  requestedRole: "global_admin" | "advisor" | "operator" | "viewer";
  requestedPlan: import("@/lib/subscription-plan").SubscriptionPlan;
  reason: string;
  status: AccessRequestStatus;
  requestedAt: Date;
  triagedAt?: Date;
  triagedBy?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  /** Optional admin note on approve/reject (audit / support trail). */
  reviewNote?: string;
  expiredAt?: Date;
  policyViolations?: AccessRequestPolicyViolation[];
};

export type AccessRequestUserSummary = {
  userId: string;
  email?: string;
  status?: "active" | "suspended";
  roles?: ("global_admin" | "advisor" | "operator" | "viewer")[];
  subscriptionPlan?: SubscriptionPlan;
  xUserId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  lastLoginCountry?: string;
  lastLoginUserAgent?: string;
};

export type AccessRequestListItem = AccessRequest & {
  user?: AccessRequestUserSummary;
  reviewedByUser?: AccessRequestUserSummary;
};

export type ApprovedUserListItem = {
  userId: string;
  name: string;
  email: string;
  role: "global_admin" | "advisor" | "operator" | "viewer" | "unknown";
  subscriptionPlan: SubscriptionPlan;
  approvedAt?: Date;
};

export type ScheduledTask = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  /** Legacy: portfolio-scoped tasks are removed from product UI/API; scheduler ignores `portfolioId`. */
  portfolioId?: ObjectId | null;
  /** Staged app-user broker import (`app_broker_import_jobs`) when `category` is `sync-broker`. */
  appBrokerImportJobId?: ObjectId;
  name: string;
  category:
    | "price_scanner"
    | "options_scanner"
    | "user_access_requests"
    | "sync-broker"
    | "rebalance"
    | "compliance"
    | "notifications"
    | "user-history"
    | "watchlist_price_scanner"
    | "corporate_events_scanner"
    | "income_cash_flow_projector"
    | "options_expiration_roll_manager"
    | "risk_concentration_scanner"
    | "tax_loss_harvest_scanner"
    | "marketing_post"
    | "user_alert_manager"
    | "xchat_spend_alert"
    | "tenant_export_worker";
  scheduleCron?: string;
  /** RRULE expression for rich recurrence; preferred over cron when present. */
  scheduleRRule?: string;
  /** Human-readable recurrence summary shown in admin scheduler UI. */
  scheduleDescription?: string;
  enabled: boolean;
  /** Optional `admin_delivery_channels` row for task output / notification routing. */
  deliveryChannelTarget?: ObjectId;
  runTimeoutSeconds?: number;
  maxRetries?: number;
  /** Category-specific typed config payload (e.g. `marketing_post`). */
  config?: MarketingTaskConfig;
  /**
   * App-user / tenant-operator automations (`/workspace/tasks`). When set, rows are CRUD-only via
   * `/api/tenant-tasks/*` (not Admin → Tasks). Execution uses the same poller + Next task-runner as tenant jobs.
   */
  ownerKind?: "tenant_user";
  /** Creating app user (`core_users._id`) — audit / attribution; operators may edit any tenant_user task. */
  ownerUserId?: ObjectId;
  lastRunAt?: Date;
  nextRunAt?: Date;
};

export type TaskRun = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  taskId: ObjectId;
  taskName: string;
  category: ScheduledTask["category"];
  triggeredBy: string;
  status: "running" | "success" | "failed";
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  output: string;
};

export type BrokerBinding = {
  provider: "alpaca" | "interactive-brokers" | "paper";
  accountRef: string;
  enabled: boolean;
};

export type InvestmentStrategy = "growth" | "income" | "balanced" | "aggressive";

export type PortfolioSettings = {
  riskProfile: "conservative" | "balanced" | "growth";
  /** Investor approach; legacy Mongo rows may omit — API normalizes to `balanced`. */
  investmentStrategy?: InvestmentStrategy;
  baseCurrency: "USD" | "EUR" | "GBP";
  rebalanceFrequencyDays: number;
};

export type AccountSettings = {
  accountStatus: "active" | "suspended";
  maxConcurrentSessions: number;
  timezone: string;
};

export type NotificationDefaults = {
  email: boolean;
  push: boolean;
  sms: boolean;
  digestHourUTC: number;
};

export type UserAdminSettings = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  /** Optional explicit xPersona assignment for ask routing. */
  assignedPersonaId?: string;
  /** Investor compliance placeholder for future FINRA evidence links. */
  finraLicenseUploadUrl?: string;
  broker: BrokerBinding;
  portfolio: PortfolioSettings;
  account: AccountSettings;
  notificationDefaults: NotificationDefaults;
  updatedAt: Date;
};

export type DeployNoteEnvironment = "staging" | "production";

export type DeployNoteConfig = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  name: string;
  environment: DeployNoteEnvironment;
  enabled: boolean;
  includeRunUrl: boolean;
  includeActor: boolean;
  defaultDeploymentNotes?: string;
  defaultHotfixNotes?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Platform-wide delivery channels (admin desk — ops / notifications). */
export type AdminDeliveryChannel = {
  _id?: ObjectId;
  name: string;
  deliveryTarget: "in_app" | "slack" | "email";
  /** Required when `deliveryTarget` is `slack` (HTTPS hooks.slack.com incoming webhook). */
  slackWebhookUrl?: string;
  /** Required when `deliveryTarget` is `email` (recipient for SMTP — same transport as portfolio desk email). */
  emailTo?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Custodian slug; `etrade` retained for legacy rows. */
export const accountTypeValues = ["fidelity", "merrill", "ibkr", "schwab", "other", "etrade"] as const;
export type AccountType = (typeof accountTypeValues)[number];

/** Broker dropdown order (Fidelity, Merrill, IBKR, Schwab, Other). Omits legacy `etrade`. */
export const accountTypePickerValues = ["fidelity", "merrill", "ibkr", "schwab", "other"] as const satisfies readonly AccountType[];

/** Account / book market outlook (desk pick list). */
export const accountOutlookValues = ["bullish", "neutral", "bearish"] as const;
export type AccountOutlook = (typeof accountOutlookValues)[number];

/** Tax posture for desk / guardrail hints (not tax advice). */
export type PortfolioAccountTaxTreatment = "taxable" | "tax_advantaged";

/** Margin envelope for this custody account (advisory desk note). */
export type PortfolioAccountMarginRule = "cash_only" | "limited_margin" | "full_margin";

/** Tax-lot disposal preference (desk note; product does not execute trades). */
export type PortfolioAccountTaxLotMatching =
  | "fifo"
  | "lifo"
  | "specific_identification"
  | "highest_cost";

/**
 * Optional HNWI-style guardrails on a custody account (stored on `portfolio_accounts`).
 * Advisory / risk framing only — not enforced as hard limits in execution paths yet.
 */
export type PortfolioAccountHnwiGuardrails = {
  taxTreatment?: PortfolioAccountTaxTreatment | null;
  /** Max single position as a fraction of account equity (e.g. 0.05–0.10). */
  maxPositionPctOfEquity?: number | null;
  marginRule?: PortfolioAccountMarginRule | null;
  taxLotMatching?: PortfolioAccountTaxLotMatching | null;
  /** Minimum cash / sweep as a fraction of total equity. */
  minLiquidityCashPctOfEquity?: number | null;
  /** Liquidity floor as months of expenses (desk note). */
  minLiquidityMonthsExpenses?: number | null;
};

/** UI / desk labels for canonical outlook slugs (stored values stay bullish | neutral | bearish). */
export const accountOutlookChoiceLabels: Record<AccountOutlook, string> = {
  bullish: "Bullish / Up",
  neutral: "Flat / Neutral",
  bearish: "Bearish / Down"
};

const LEGACY_ACCOUNT_OUTLOOK: Readonly<Record<string, AccountOutlook>> = {
  bullish: "bullish",
  neutral: "neutral",
  bearish: "bearish",
  growth: "bullish",
  aggressive: "bullish",
  balanced: "neutral",
  income: "bearish"
};

/** API / UI aliases → canonical slug (Mongo stores canonical only). */
const OUTLOOK_API_ALIASES: Readonly<Record<string, AccountOutlook>> = {
  ...LEGACY_ACCOUNT_OUTLOOK,
  up: "bullish",
  down: "bearish",
  flat: "neutral"
};

export function parseAccountOutlook(raw: unknown): AccountOutlook | null {
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim().toLowerCase();
  if ((accountOutlookValues as readonly string[]).includes(t)) {
    return t as AccountOutlook;
  }
  return OUTLOOK_API_ALIASES[t] ?? null;
}

/** Portfolio kind labels for workspace / account UI (canonical: real_estate | investments). */
export function portfolioKindChoiceLabel(kind: "real_estate" | "investments" | null | undefined): string {
  return kind === "real_estate" ? "Real Estate" : "Investments";
}

export function accountOutlookDisplayLabel(outlook: AccountOutlook | null | undefined): string {
  if (!outlook || !(accountOutlookValues as readonly string[]).includes(outlook)) {
    return "—";
  }
  return accountOutlookChoiceLabels[outlook];
}

/** Admin-managed broker definitions (slug + display); seeds Merrill / Fidelity / E*TRADE / IBKR. */
export type BrokerCatalogEntry = {
  _id?: ObjectId;
  /** Lowercase slug used as account custodian type (`Account.type`, e.g. merrill). */
  type: string;
  name: string;
  description?: string;
  /** Optional icon URL for admin UI. */
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Admin-editable copy of options strategy docs (seeded from `atx-docs/rag-collection/options-strategy/*`; legacy `atx-rag-collection/…` still supported).
 * `slug` matches the subdirectory name and stays stable; `name` defaults to the markdown filename stem.
 */
export type OptionsStrategyPreference = {
  _id?: ObjectId;
  slug: string;
  name: string;
  /** Full markdown text (RAG-aligned strategy body). */
  description: string;
  /** Repo-relative path last written by seed sync (e.g. `wheel/wheel.md`). */
  sourceRelPath?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OptionsStrategyPreferenceSummary = Pick<
  OptionsStrategyPreference,
  "slug" | "name" | "sourceRelPath" | "createdAt" | "updatedAt"
> & {
  _id: ObjectId;
};

/**
 * Canonical options strategy object.
 * Seeded from `atx-docs/rag-collection/options-strategy/*` like preferences (legacy path supported), but includes free-form JSON filters.
 */
export type OptionsStrategy = {
  _id?: ObjectId;
  slug: string;
  name: string;
  /** Full markdown text (RAG-aligned strategy body). */
  description: string;
  /** Free-form JSON for admin-defined filters (UI provides text area). */
  filters?: Record<string, unknown> | null;
  /** Repo-relative path last written by seed sync (e.g. `wheel/wheel.md`). */
  sourceRelPath?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OptionsStrategySummary = Pick<
  OptionsStrategy,
  "slug" | "name" | "sourceRelPath" | "createdAt" | "updatedAt"
> & { _id: ObjectId };

export type Portfolio = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  /** Hex string in new writes; legacy Mongo documents may still store BSON ObjectId — normalize at API boundaries. */
  userId: string | ObjectId;
  name: string;
  isDefault: boolean;
  /**
   * Deployment org bucket (e.g. `org-atx-finance`): all app_user “client” portfolios for this instance.
   * See `getTenantPortfolioOrgKey()` / `TENANT_PORTFOLIO_ORG_KEY`.
   */
  tenantPortfolioOrgKey?: string;
  /**
   * Workspace “Manage portfolios” bucket (optional; unset = show as investments in UI).
   */
  portfolioKind?: "real_estate" | "investments" | null;
  /**
   * Optional portfolio scoring factor weights for chain / recommendation ranking (defaults when absent).
   * Weights must sum to 1; defaults in `scoring-factors.ts`.
   */
  scoringFactors?: PortfolioScoringFactor[];
  /**
   * Bumped on workspace-affecting writes (positions, accounts, watchlist) for xChat snapshot cache keys.
   * Legacy documents omit — treat as 0.
   */
  workspaceContentRev?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Account = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  name: string;
  type: AccountType;
  extAccountId: string;
  cashBalance?: number;
  isDefault: boolean;
  /** Desk risk stance for this custodian account (optional). */
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  /** Positioning outlook slug for this account (optional); see {@link accountOutlookValues}. */
  outlook?: AccountOutlook | null;
  /**
   * When true, broker CSV import has applied to this book; app users cannot change `extAccountId` or `type`.
   */
  brokerImportLocked?: boolean;
  /**
   * When set, xOptions uses this for per-account options-trading eligibility UI.
   * When omitted, server env default applies for that account.
   */
  optionsTradingEnabled?: boolean | null;
  /** Optional HNWI desk guardrails (tax posture, sizing band, margin, lots, liquidity). */
  hnwiGuardrails?: PortfolioAccountHnwiGuardrails | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WatchlistRowStatus = "draft" | "active" | "review";

export type WatchlistSymbol = {
  symbol: string;
  addedAt: Date;
  /** CSV / UI "Type" (e.g. Stock, Option). */
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
  /** Short desk thesis; required before `rowStatus` can be `active`. */
  rationale?: string;
  /**
   * Watchlist workflow: `active` rows should have non-empty `rationale` (enforced in API + UI).
   * `review` is set by `watchlist_price_scanner` after a price refresh so the desk re-checks thesis.
   */
  rowStatus?: WatchlistRowStatus;
  /**
   * Minimum absolute % move vs prior `lastPrice` before firing a price alert for this row.
   * When unset, `PriceAlertService` uses the global default (see `DEFAULT_MIN_ABS_MOVE_PERCENT`).
   */
  priceAlertMinAbsMovePercent?: number;
  /** Populated by price scanners (`price_scanner` or legacy `watchlist_price_scanner`). */
  lastPrice?: number;
  lastUpdatedAt?: Date;
};

/** Payload for PATCH `addEntries` (merge into existing row or append). */
export type WatchlistSymbolImportEntry = {
  symbol: string;
  lineType?: string | null;
  strategy?: string | null;
  quantity?: number | null;
  entryPrice?: number | null;
  rationale?: string | null;
  rowStatus?: WatchlistRowStatus | null;
  priceAlertMinAbsMovePercent?: number | null;
};

export type Watchlist = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  /** @deprecated Legacy anchor; canonical watchlist is one per user — prefer {@link getUserWatchlist} / user-scoped APIs. */
  portfolioId?: ObjectId;
  name: string;
  symbols: WatchlistSymbol[];
  isDefault: boolean;
  /** Desk risk stance for this watchlist (optional); same values as {@link Account.riskProfile}. */
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  /** Positioning outlook slug (optional); see {@link accountOutlookValues}. */
  outlook?: AccountOutlook | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Recommendation = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  /** Optional linkage to an account; recommendations may be portfolio-level. */
  accountId?: ObjectId;
  /** Symbol or instrument identifier */
  symbol: string;
  /** Narrative or reasoning for the recommendation */
  note?: string;
  /** Action recommended */
  action: "buy" | "sell" | "hold" | "watch";
  /** Suggested units or amount (optional) */
  quantity?: number;
  /** Optional target price */
  targetPrice?: number;
  /** Status of recommendation lifecycle */
  status: "new" | "accepted" | "executed" | "dismissed";
  createdAt: Date;
  updatedAt: Date;
};

/** Desk / ops alerts scoped to a portfolio (admin-managed). */
export type PortfolioAlert = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  /** Snapshot of portfolio name at create time (user-facing tables). */
  portfolioName?: string;
  /** Custodian account when the alert ties to a holding row (e.g. options scanner). */
  accountId?: ObjectId;
  accountName?: string;
  title: string;
  body?: string;
  severity: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "dismissed";
  symbol?: string;
  /**
   * Structured provenance: options scanner v1 (`portfolio-alert-scan-metadata.ts`) or NL xChat user price rules
   * (`portfolio-alert-user-price-rule-metadata.ts`).
   */
  metadata?: PortfolioAlertScannerMetadataV1 | PortfolioAlertUserPriceRuleMetadataV1;
  createdAt: Date;
  updatedAt: Date;
};

/** Notification delivery endpoints scoped to a portfolio (admin-managed). */
export type PortfolioDeliveryChannel = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  kind: "email" | "slack_webhook" | "sms" | "push";
  label: string;
  destination: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Instrument line kind for `portfolio_positions` (admin holdings + app positions). */
export const positionTypeValues = ["stock", "option", "cash"] as const;
export type PositionType = (typeof positionTypeValues)[number];

export const positionOptionTypeValues = ["call", "put"] as const;
export type PositionOptionType = (typeof positionOptionTypeValues)[number];

export function normalizePositionType(raw: unknown): PositionType {
  if (raw === "cash" || raw === "option") {
    return raw;
  }
  return "stock";
}

/** Calendar expiration stored at UTC midnight (option positions). */
export function positionExpirationUtcFromIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const t = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(t) ? null : new Date(t);
}

export function formatPositionUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export type Position = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  accountId: ObjectId;
  /** Underlying ticker (stock/option) or cash bucket label (e.g. CASH, USD). */
  symbol: string;
  qty: number;
  avgCost: number;
  /** cash | stock | option — omitted on legacy rows → treat as {@link normalizePositionType}. */
  type?: PositionType;
  /** Yahoo / OCC-style instrument reference; unique per account when set. */
  yahooRef?: string | null;
  optionType?: PositionOptionType | null;
  strike?: number | null;
  expiration?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
