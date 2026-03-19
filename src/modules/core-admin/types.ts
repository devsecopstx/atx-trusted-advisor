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
  category: "sync-broker" | "rebalance" | "compliance" | "notifications";
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

export type PortfolioSettings = {
  riskProfile: "conservative" | "balanced" | "growth";
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
  broker: BrokerBinding;
  portfolio: PortfolioSettings;
  account: AccountSettings;
  notificationDefaults: NotificationDefaults;
  updatedAt: Date;
};

export const accountTypeValues = ["merrill", "robinhood", "fidelity"] as const;
export type AccountType = (typeof accountTypeValues)[number];

export type Portfolio = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  name: string;
  isDefault: boolean;
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
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WatchlistSymbol = {
  symbol: string;
  addedAt: Date;
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
