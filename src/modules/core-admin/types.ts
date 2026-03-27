import { ObjectId } from "mongodb";

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
  requestedPlan: "free" | "pro" | "enterprise";
  reason: string;
  status: AccessRequestStatus;
  requestedAt: Date;
  triagedAt?: Date;
  triagedBy?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  expiredAt?: Date;
  policyViolations?: AccessRequestPolicyViolation[];
};

export type AccessRequestUserSummary = {
  userId: string;
  email?: string;
  status?: "active" | "suspended";
  roles?: ("global_admin" | "advisor" | "operator" | "viewer")[];
  subscriptionPlan?: "free" | "pro" | "enterprise";
  xUserId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
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
  subscriptionPlan: "free" | "pro" | "enterprise";
  approvedAt?: Date;
};

export type ScheduledTask = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  /** When set, task is scoped to this portfolio (admin portfolio tasks console). */
  portfolioId?: ObjectId;
  name: string;
  category:
    | "sync-broker"
    | "rebalance"
    | "compliance"
    | "notifications"
    | "user-history"
    | "watchlist_price_scanner"
    | "daily_options_scanner";
  scheduleCron: string;
  enabled: boolean;
  runTimeoutSeconds?: number;
  maxRetries?: number;
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

export const accountTypeValues = ["merrill", "fidelity", "etrade"] as const;
export type AccountType = (typeof accountTypeValues)[number];

/** Account positioning outlook (admin pick list); user surfaces may concatenate with other context. */
export const accountOutlookValues = ["growth", "income", "balanced", "aggressive"] as const;
export type AccountOutlook = (typeof accountOutlookValues)[number];

export function parseAccountOutlook(raw: unknown): AccountOutlook | null {
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim().toLowerCase();
  return (accountOutlookValues as readonly string[]).includes(t) ? (t as AccountOutlook) : null;
}

/** Admin-managed broker definitions (slug + display); seeds Merrill / Fidelity / E*TRADE. */
export type BrokerCatalogEntry = {
  _id?: ObjectId;
  /** Lowercase slug used as portfolio `broker_type` (e.g. merrill). */
  type: string;
  name: string;
  description?: string;
  /** Optional icon URL for admin UI. */
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Admin-editable copy of options strategy docs (seeded from `atx-rag-collection/options-strategy/*`).
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
 * Seeded from `atx-rag-collection/options-strategy/*` like preferences, but includes free-form JSON filters.
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
   * Cohort / broker grouping key (e.g. linked integration). Defaults to `extBrokerName` until set.
   */
  ext_broker_ref?: string;
  /**
   * Broker catalog slug (see {@link BrokerCatalogEntry}); aligns with import {@link AccountType} for built-ins.
   */
  broker_type?: string;
  /**
   * Deployment org bucket (e.g. `org-atx-finance`): all app_user “client” portfolios for this instance.
   * See `getTenantPortfolioOrgKey()` / `TENANT_PORTFOLIO_ORG_KEY`.
   */
  tenantPortfolioOrgKey?: string;
  /** Book-level risk stance for desk context (optional). */
  riskProfile?: "conservative" | "balanced" | "growth";
  /** Free-text market / positioning outlook for this book (optional). */
  outlook?: string;
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
  createdAt: Date;
  updatedAt: Date;
};

export type WatchlistSymbol = {
  symbol: string;
  addedAt: Date;
  /** CSV / UI "Type" (e.g. Stock, Option). */
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
  /** Populated by WatchlistScannerService (`watchlist_price_scanner` ScheduledTask). */
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
};

export type Watchlist = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
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
  title: string;
  body?: string;
  severity: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "dismissed";
  symbol?: string;
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
