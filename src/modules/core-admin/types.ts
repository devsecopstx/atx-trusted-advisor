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
  requestedRole: "advisor" | "operator" | "viewer";
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
  name: string;
  category: "sync-broker" | "rebalance" | "compliance" | "notifications" | "user-history";
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
   * Primary broker / CSV format for this book (admin UI + holdings import defaults).
   * Aligns with {@link AccountType} (`merrill` | `fidelity` | `etrade`).
   */
  broker_type?: AccountType;
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

export type Position = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  accountId: ObjectId;
  symbol: string;
  qty: number;
  avgCost: number;
  createdAt: Date;
  updatedAt: Date;
};
