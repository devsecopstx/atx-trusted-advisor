import { type Filter, MongoServerError, ObjectId } from "mongodb";

import { FIDELITY_DEFAULT_PROVISION_ACCOUNT_REF } from "@/lib/account-xref-display";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    mongoPortfolioFamilyUserPortfolioScope,
    mongoPortfolioFamilyUserScope,
    mongoScheduledTaskTenantReadScope,
    mongoTenantExactScope,
    mongoUserIdQuery,
    parseTenantObjectId
} from "@/lib/mongo-tenant-scope";
import { getDb } from "@/lib/mongodb";
import { portfolioAlertScannerMetadataV1Schema } from "@/lib/portfolio-alert-scan-metadata";
import {
    computeNextRunAtFromSchedule,
    resolveScheduleDescription
} from "@/lib/scheduled-task-schedule";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";
import { getTenantPortfolioOrgKey } from "@/modules/core-admin/tenant-portfolio-org";
import {
    ACTIONABLE_ACCESS_REQUEST_STATUSES,
    type AccessRequest,
    type AccessRequestListItem,
    type AccessRequestStatus,
    type Account,
    type AccountOutlook,
    type AccountType,
    type AdminDeliveryChannel,
    type ApprovedUserListItem,
    type BrokerCatalogEntry,
    type DeployNoteConfig,
    type OptionsStrategy,
    type OptionsStrategyPreference,
    type OptionsStrategyPreferenceSummary,
    type OptionsStrategySummary,
    type Portfolio,
    type PortfolioAlert,
    type PortfolioDeliveryChannel,
    type Position,
    type PositionOptionType,
    type PositionType,
    type Recommendation,
    type ScheduledTask,
    type TaskRun,
    type UserAdminSettings,
    type Watchlist,
    type WatchlistRowStatus,
    type WatchlistSymbol,
    type WatchlistSymbolImportEntry,
    accountTypeValues,
    normalizePositionType,
    parseAccountOutlook
} from "@/modules/core-admin/types";
import type { CoreUser } from "@/modules/identity/types";
import { MAX_WATCHLIST_SYMBOLS } from "@/modules/watchlist/constants";
import { pickPreferredWatchlistDocument } from "@/modules/watchlist/watchlist-doc-preference";
import {
    mergeBaseFromRawWatchlistEntry,
    symbolFromRawWatchlistEntry
} from "@/modules/watchlist/watchlist-row-raw";

const collections = {
  accessRequests: "admin_access_requests",
  scheduledTasks: "admin_scheduled_tasks",
  taskRuns: "admin_task_runs",
  userSettings: "admin_user_settings",
  deployNoteConfigs: "admin_deploy_note_configs",
  adminDeliveryChannels: "admin_delivery_channels",
  portfolios: TENANT_PORTFOLIO_COLLECTION,
  accounts: "portfolio_accounts",
  watchlists: "portfolio_watchlists",
  positions: "portfolio_positions",
  recommendations: "portfolio_recommendations",
  portfolioAlerts: "portfolio_alerts",
  portfolioDeliveryChannels: "portfolio_delivery_channels",
  brokerCatalog: "admin_broker_catalog",
  optionsStrategyPreferences: "options_strategy_preferences",
  optionsStrategy: "options_strategy"
} as const;

let ensurePortfolioIndexesPromise: Promise<void> | null = null;
let ensureBrokerCatalogIndexesPromise: Promise<void> | null = null;
let ensureOptionsStrategyPreferenceIndexesPromise: Promise<void> | null = null;
let ensureOptionsStrategyIndexesPromise: Promise<void> | null = null;
let ensureAccessRequestIndexesPromise: Promise<void> | null = null;

const ACCESS_REQUEST_ACTIONABLE_USER_ROLE_UNIQ =
  "uniq_admin_access_requests_user_requestedRole_actionable";

/** Thrown when Mongo unique index blocks a second actionable row for the same userId + requestedRole. */
export class AccessRequestDuplicatePendingError extends Error {
  constructor() {
    super("A pending access request already exists for this user and role.");
    this.name = "AccessRequestDuplicatePendingError";
  }
}

const BROKER_CATALOG_TYPE_RE = /^[a-z][a-z0-9_]{0,31}$/;

const OPTIONS_STRATEGY_DESCRIPTION_MAX_LEN = 512_000;

const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_ACCOUNT_NAME = "defaultaccount";
const DEFAULT_ACCOUNT_REF = FIDELITY_DEFAULT_PROVISION_ACCOUNT_REF;
/** Default paper cash for provision + read-time coalesce when Mongo field is missing. */
export const DEFAULT_ACCOUNT_CASH_BALANCE = 25_000;
const DEFAULT_WATCHLIST_NAME = "DefaultWatchlist";
/** Ensured on every default watchlist read/provision (xChat + portfolio UX). */
const DEFAULT_WATCHLIST_SYMBOL = "TSLA";

/** Default custodian desk fields when provisioning the default account (OAuth / first book). */
const DEFAULT_PROVISION_ACCOUNT_RISK_PROFILE = "balanced" as const;
const DEFAULT_PROVISION_ACCOUNT_OUTLOOK: AccountOutlook = "neutral";

function parseOptionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replaceAll(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceWatchlistSymbolEntry(
  item: unknown,
  fallbackAddedAt: Date
): WatchlistSymbol | null {
  if (typeof item === "string") {
    const symbol = item.trim().toUpperCase();
    return symbol ? { symbol, addedAt: fallbackAddedAt } : null;
  }
  if (item && typeof item === "object" && "symbol" in item) {
    const o = item as Record<string, unknown>;
    const symbol = String(o.symbol).trim().toUpperCase();
    if (!symbol) {
      return null;
    }
    const rawAdded = o.addedAt;
    let addedAt = fallbackAddedAt;
    if (rawAdded instanceof Date && !Number.isNaN(rawAdded.getTime())) {
      addedAt = rawAdded;
    } else if (typeof rawAdded === "string") {
      const parsed = new Date(rawAdded);
      if (!Number.isNaN(parsed.getTime())) {
        addedAt = parsed;
      }
    }
    const lineType =
      typeof o.lineType === "string" ? o.lineType.trim().slice(0, 128) : undefined;
    const strategy =
      typeof o.strategy === "string" ? o.strategy.trim().slice(0, 512) : undefined;
    const quantity = parseOptionalFiniteNumber(o.quantity);
    const entryPrice = parseOptionalFiniteNumber(o.entryPrice);
    const lastPrice = parseOptionalFiniteNumber(o.lastPrice);
    let lastUpdatedAt: Date | undefined;
    const rawLu = o.lastUpdatedAt;
    if (rawLu instanceof Date && !Number.isNaN(rawLu.getTime())) {
      lastUpdatedAt = rawLu;
    } else if (typeof rawLu === "string") {
      const parsedLu = new Date(rawLu);
      if (!Number.isNaN(parsedLu.getTime())) {
        lastUpdatedAt = parsedLu;
      }
    }
    const rationale =
      typeof o.rationale === "string" ? o.rationale.trim().slice(0, 4000) : undefined;
    const rs = o.rowStatus;
    const rowStatus =
      rs === "draft" || rs === "active" || rs === "review" ? rs : undefined;
    return {
      symbol,
      addedAt,
      ...(lineType ? { lineType } : {}),
      ...(strategy ? { strategy } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(entryPrice !== undefined ? { entryPrice } : {}),
      ...(rationale ? { rationale } : {}),
      ...(rowStatus ? { rowStatus } : {}),
      ...(lastPrice !== undefined ? { lastPrice } : {}),
      ...(lastUpdatedAt ? { lastUpdatedAt } : {})
    };
  }
  return null;
}

/**
 * Coerces legacy `string[]` / loose object rows and preserves **array order** and **duplicate tickers**
 * (independent desk lines). Appends any `ensureSymbols` not already present on **at least one** row.
 */
export function normalizeWatchlistDocumentSymbols(
  raw: unknown,
  ensureSymbols: string[]
): WatchlistSymbol[] {
  const now = new Date();
  const arr = Array.isArray(raw) ? raw : [];
  const out: WatchlistSymbol[] = [];
  for (const item of arr) {
    const coerced = coerceWatchlistSymbolEntry(item, now);
    if (coerced) {
      out.push(coerced);
    }
  }
  const present = new Set(out.map((s) => s.symbol));
  const ensureUnique = Array.from(
    new Set(
      ensureSymbols
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is string => Boolean(s))
    )
  );
  for (const symbol of ensureUnique) {
    if (!present.has(symbol)) {
      out.push({ symbol, addedAt: now });
      present.add(symbol);
    }
  }
  return out;
}

type TenantScopedOptions = {
  tenantId?: string;
};

const toTenantObjectId = parseTenantObjectId;

/** @deprecated use mongoUserIdQuery — local alias for this module’s large call surface */
const userIdQuery = mongoUserIdQuery;

/**
 * Exact `tenantId` on documents (settings, delivery channels, positions, …).
 * Default: invalid/missing tenant hex → fail closed. Use `allowMissingTenantKey` only for upserts that
 * intentionally match legacy `{ userId }`-only rows (see `upsertUserAdminSettings`).
 */
function withTenantScope(
  query: Record<string, unknown>,
  tenantId?: string,
  whenTenantMissing: "deny" | "allowMissingTenantKey" = "deny"
): Record<string, unknown> {
  return mongoTenantExactScope(
    query,
    tenantId,
    whenTenantMissing === "allowMissingTenantKey" ? "allowMissingTenantKey" : "deny"
  );
}

/**
 * `admin_access_requests` reads: global admin + public duplicate-check pass **no** tenant hex so we must not
 * use `withTenantScope` (that fail-closes when tenant is missing). Scoped reads pass a concrete tenant id.
 */
function accessRequestReadFilter(base: Record<string, unknown>, tenantHex?: string): Record<string, unknown> {
  const t = typeof tenantHex === "string" ? tenantHex.trim() : "";
  if (t) {
    return withTenantScope(base, t);
  }
  return mongoTenantExactScope(base, undefined, "allowMissingTenantKey");
}

/**
 * `admin_scheduled_tasks` reads (and id-scoped writes): match the session tenant **or** legacy rows with no
 * `tenantId` (created before tenant was always persisted). Invalid session tenant → no matches.
 */
function scheduledTaskTenantReadScope(
  base: Record<string, unknown>,
  tenantId?: string
): Record<string, unknown> {
  return mongoScheduledTaskTenantReadScope(base, tenantId, "denyIfTenantMissing");
}

/**
 * `updateOne` upserts must not use `withTenantScope`'s `$or` — MongoDB upsert + `$or` can fail or
 * skip matches, which breaks OAuth bootstrap (`provisionDefaultPortfolioForUser`).
 */
function strictWriteTenantFilter(
  base: Record<string, unknown>,
  tenantId?: string
): Record<string, unknown> {
  const tenantObjectId = toTenantObjectId(tenantId);
  if (!tenantObjectId) {
    return base;
  }
  return { ...base, tenantId: tenantObjectId };
}

export type ProvisionDefaultPortfolioInput = {
  userId: string;
  tenantId?: string;
  portfolioName?: string;
  accountName?: string;
  watchlistName?: string;
  accountType?: AccountType;
  watchlistSymbols?: string[];
};

export type ProvisionDefaultPortfolioResult = {
  portfolio: Portfolio;
  account: Account;
  watchlist: Watchlist;
};

export type UpsertPositionInput = {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  accountId: string;
  symbol: string;
  qty: number;
  avgCost: number;
  /** Defaults to **stock** when omitted. */
  type?: PositionType;
  yahooRef?: string;
  optionType?: PositionOptionType;
  strike?: number;
  expiration?: Date;
};

/** Admin / BFF: same as {@link UpsertPositionInput} without session owner (resolved from portfolio). */
export type AdminUpsertPositionInput = Omit<UpsertPositionInput, "userId" | "tenantId">;

export class PositionValidationError extends Error {
  readonly code:
    | "INVALID_IDS"
    | "ACCOUNT_NOT_FOUND"
    | "ACCOUNT_PORTFOLIO_MISMATCH"
    | "ACCOUNT_MISSING_EXT_ACCOUNT_ID"
    | "POSITION_FIELDS_INCOMPLETE"
    | "INVALID_OPTION_EXPIRATION";

  constructor(code: PositionValidationError["code"], message: string) {
    super(message);
    this.name = "PositionValidationError";
    this.code = code;
  }
}

async function dropLegacyWatchlistIndexesIfPresent(): Promise<void> {
  const db = await getDb();
  const wl = db.collection(collections.watchlists);
  for (const name of ["uniq_watchlist_per_portfolio", "idx_watchlists_snapshot_portfolio_user"] as const) {
    try {
      await wl.dropIndex(name);
    } catch {
      // Index missing or already dropped
    }
  }
}

async function createPortfolioIndexes(): Promise<void> {
  const db = await getDb();
  await dropLegacyWatchlistIndexesIfPresent();
  const indexes: Promise<string>[] = [
    db.collection<Portfolio>(collections.portfolios).createIndex(
      { tenantId: 1, userId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_portfolio_per_user"
      }
    ),
    db.collection<Portfolio>(collections.portfolios).createIndex(
      { tenantId: 1, userId: 1, name: 1 },
      {
        unique: true,
        name: "uniq_portfolio_name_per_user"
      }
    ),
    db.collection<Portfolio>(collections.portfolios).createIndex(
      { tenantPortfolioOrgKey: 1, tenantId: 1 },
      { name: "idx_tenant_portfolio_org_tenant" }
    ),
    db.collection<Account>(collections.accounts).createIndex(
      { tenantId: 1, portfolioId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_account_per_portfolio"
      }
    ),
    /** Workspace snapshot: {@link listPortfolioAccounts} sort `isDefault` desc, `createdAt` asc. */
    db.collection<Account>(collections.accounts).createIndex(
      { portfolioId: 1, userId: 1, isDefault: -1, createdAt: 1 },
      { name: "idx_accounts_snapshot_portfolio_user_default_created" }
    ),
    /** One watchlist per user per tenant (legacy rows may omit `tenantId`). */
    db.collection<Watchlist>(collections.watchlists).createIndex(
      { tenantId: 1, userId: 1 },
      {
        unique: true,
        name: "uniq_watchlist_per_user"
      }
    ),
    db.collection<Watchlist>(collections.watchlists).createIndex(
      { userId: 1, tenantId: 1 },
      { name: "idx_watchlists_user_tenant" }
    ),
    db.collection<Position>(collections.positions).createIndex(
      { tenantId: 1, portfolioId: 1, accountId: 1, symbol: 1 },
      {
        name: "idx_positions_tenant_portfolio_account_symbol"
      }
    ),
    /** xChat / atx_function workspace snapshot: {@link listPortfolioPositionsByAccount} (sort `createdAt`). */
    db.collection<Position>(collections.positions).createIndex(
      { portfolioId: 1, accountId: 1, userId: 1, tenantId: 1, createdAt: 1 },
      { name: "idx_positions_snapshot_portfolio_account_user_tenant_created" }
    ),
    db.collection<Position>(collections.positions).createIndex(
      { tenantId: 1, portfolioId: 1, accountId: 1, yahooRef: 1 },
      {
        unique: true,
        partialFilterExpression: {
          yahooRef: { $exists: true, $type: "string", $gt: "" }
        },
        name: "uniq_positions_account_yahoo_ref"
      }
    ),
    db.collection<Recommendation>(collections.recommendations).createIndex(
      { tenantId: 1, portfolioId: 1, createdAt: 1 },
      { name: "idx_recommendations_tenant_portfolio_createdAt" }
    ),
    db.collection<PortfolioAlert>(collections.portfolioAlerts).createIndex(
      { tenantId: 1, portfolioId: 1, createdAt: -1 },
      { name: "idx_portfolio_alerts_tenant_portfolio_createdAt" }
    ),
    db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).createIndex(
      { tenantId: 1, portfolioId: 1, label: 1 },
      { name: "idx_portfolio_delivery_channels_tenant_portfolio_label" }
    )
  ];
  await Promise.all(indexes);
}

export async function ensurePortfolioIndexes(): Promise<void> {
  if (!ensurePortfolioIndexesPromise) {
    ensurePortfolioIndexesPromise = createPortfolioIndexes().catch((err: unknown) => {
      ensurePortfolioIndexesPromise = null;
      throw err;
    });
  }
  await ensurePortfolioIndexesPromise;
}

async function createAccessRequestIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection<AccessRequest>(collections.accessRequests).createIndex(
    { userId: 1, requestedRole: 1 },
    {
      unique: true,
      name: ACCESS_REQUEST_ACTIONABLE_USER_ROLE_UNIQ,
      partialFilterExpression: {
        status: { $in: [...ACTIONABLE_ACCESS_REQUEST_STATUSES] }
      }
    }
  );
}

export async function ensureAccessRequestIndexes(): Promise<void> {
  if (!ensureAccessRequestIndexesPromise) {
    ensureAccessRequestIndexesPromise = createAccessRequestIndexes().catch((err: unknown) => {
      ensureAccessRequestIndexesPromise = null;
      throw err;
    });
  }
  await ensureAccessRequestIndexesPromise;
}

export async function listAccessRequests(options?: {
  limit?: number;
  status?: AccessRequestStatus;
  statuses?: AccessRequestStatus[];
  tenantId?: string;
}): Promise<AccessRequestListItem[]> {
  const limit = options?.limit ?? 200;
  const db = await getDb();

  let statusQuery: Record<string, unknown> = {};
  if (options?.statuses && options.statuses.length > 0) {
    statusQuery = { status: { $in: options.statuses } };
  } else if (options?.status) {
    statusQuery = { status: options.status };
  }

  const requests = await db
    .collection<AccessRequest>(collections.accessRequests)
    .find(accessRequestReadFilter(statusQuery, options?.tenantId))
    .sort({ requestedAt: -1 })
    .limit(limit)
    .toArray();

  if (requests.length === 0) {
    return [];
  }

  const uniqueUserIds = Array.from(
    new Set(
      requests
        .flatMap((request) => [request.userId.trim(), request.reviewedBy?.trim() ?? ""])
        .filter(Boolean)
    )
  );

  const users = await db
    .collection<CoreUser>("core_users")
    .find({ _id: { $in: uniqueUserIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } })
    .project({
      email: 1,
      status: 1,
      roles: 1,
      subscriptionPlan: 1,
      "xAccount.xUserId": 1,
      "xAccount.username": 1,
      "xAccount.displayName": 1,
      "xAccount.avatarUrl": 1,
      lastLoginAt: 1,
      lastLoginIp: 1,
      lastLoginCountry: 1,
      lastLoginUserAgent: 1
    })
    .toArray();

  const usersById = new Map(
    users
      .filter((user) => user._id)
      .map((user) => [
        user._id!.toHexString(),
        {
          userId: user._id!.toHexString(),
          email: user.email,
          status: user.status,
          roles: user.roles,
          subscriptionPlan: user.subscriptionPlan,
          xUserId: user.xAccount?.xUserId,
          username: user.xAccount?.username,
          displayName: user.xAccount?.displayName,
          avatarUrl: user.xAccount?.avatarUrl,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: user.lastLoginIp,
          lastLoginCountry: user.lastLoginCountry,
          lastLoginUserAgent: user.lastLoginUserAgent
        }
      ])
  );

  return requests.map((request) => ({
    ...request,
    user: usersById.get(request.userId),
    reviewedByUser: request.reviewedBy ? usersById.get(request.reviewedBy) : undefined
  }));
}

export async function createAccessRequest(
  payload: Omit<
    AccessRequest,
    "_id" | "tenantId" | "requestedAt" | "status" | "requestedPlan"
  > & {
    requestedPlan?: AccessRequest["requestedPlan"];
    status?: AccessRequest["status"];
    requestedAt?: Date;
    tenantId?: string;
  }
): Promise<AccessRequest> {
  await ensureAccessRequestIndexes();
  const db = await getDb();

  const document: AccessRequest = {
    ...payload,
    tenantId: toTenantObjectId(payload.tenantId),
    requestedPlan: payload.requestedPlan ?? "basic",
    status: payload.status ?? "pending",
    requestedAt: payload.requestedAt ?? new Date()
  };

  try {
    const result = await db
      .collection<AccessRequest>(collections.accessRequests)
      .insertOne(document);

    return { ...document, _id: result.insertedId };
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) {
      throw new AccessRequestDuplicatePendingError();
    }
    throw e;
  }
}

export async function getPendingAccessRequestByUserAndRole(input: {
  userId: string;
  requestedRole: AccessRequest["requestedRole"];
  tenantId?: string;
}): Promise<AccessRequest | null> {
  const db = await getDb();
  const base: Record<string, unknown> = {
    ...mongoUserIdQuery(input.userId),
    requestedRole: input.requestedRole,
    status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES }
  };
  return db.collection<AccessRequest>(collections.accessRequests).findOne(accessRequestReadFilter(base, input.tenantId));
}

export async function getAccessRequestById(
  id: string,
  options?: TenantScopedOptions
): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(accessRequestReadFilter({ _id: new ObjectId(id) }, options?.tenantId));
}

export async function reviewAccessRequestById(input: {
  requestId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  tenantId?: string;
  reviewNote?: string;
}): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(input.requestId)) {
    return null;
  }
  const db = await getDb();
  const reviewedAt = new Date();
  const _id = new ObjectId(input.requestId);
  const $set: Record<string, unknown> = {
    status: input.status,
    reviewedBy: input.reviewedBy,
    reviewedAt
  };
  if (input.reviewNote !== undefined) {
    $set.reviewNote = input.reviewNote.trim() || "";
  }
  await db.collection<AccessRequest>(collections.accessRequests).updateOne(
    strictWriteTenantFilter({ _id }, input.tenantId),
    {
      $set
    }
  );

  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(accessRequestReadFilter({ _id }, input.tenantId));
}

export async function updateAccessRequestPlanById(input: {
  requestId: string;
  requestedPlan: AccessRequest["requestedPlan"];
  tenantId?: string;
}): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(input.requestId)) {
    return null;
  }

  const db = await getDb();
  const _id = new ObjectId(input.requestId);
  await db.collection<AccessRequest>(collections.accessRequests).updateOne(
    strictWriteTenantFilter({ _id, status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES } }, input.tenantId),
    {
      $set: {
        requestedPlan: input.requestedPlan
      }
    }
  );

  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(accessRequestReadFilter({ _id }, input.tenantId));
}

export async function updateAccessRequestTenantById(input: {
  requestId: string;
  /** Set to a 24-char tenant hex, or `null` to clear (platform default on approve). */
  tenantIdHex: string | null;
  tenantId?: string;
}): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(input.requestId)) {
    return null;
  }
  const db = await getDb();
  const _id = new ObjectId(input.requestId);
  const filter = strictWriteTenantFilter(
    { _id, status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES } },
    input.tenantId
  );
  if (input.tenantIdHex === null) {
    await db.collection<AccessRequest>(collections.accessRequests).updateOne(filter, {
      $unset: { tenantId: "" }
    });
  } else {
    const oid = parseTenantObjectId(input.tenantIdHex);
    if (!oid) {
      return null;
    }
    await db.collection<AccessRequest>(collections.accessRequests).updateOne(filter, {
      $set: { tenantId: oid }
    });
  }

  return db.collection<AccessRequest>(collections.accessRequests).findOne(accessRequestReadFilter({ _id }, input.tenantId));
}

export async function updateAccessRequestRoleById(input: {
  requestId: string;
  requestedRole: AccessRequest["requestedRole"];
  tenantId?: string;
}): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(input.requestId)) {
    return null;
  }

  const db = await getDb();
  const _id = new ObjectId(input.requestId);
  await db.collection<AccessRequest>(collections.accessRequests).updateOne(
    strictWriteTenantFilter({ _id, status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES } }, input.tenantId),
    {
      $set: {
        requestedRole: input.requestedRole
      }
    }
  );

  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(accessRequestReadFilter({ _id }, input.tenantId));
}

export async function listApprovedUsers(
  limit = 100,
  options?: TenantScopedOptions
): Promise<ApprovedUserListItem[]> {
  const db = await getDb();
  const tenantObjectId = toTenantObjectId(options?.tenantId);
  const approvedRequests = await listAccessRequests({
    status: "approved",
    limit: Math.max(limit * 3, limit),
    tenantId: options?.tenantId
  });

  const approvedByUserId = new Map<string, ApprovedUserListItem>();
  for (const request of approvedRequests) {
    if (approvedByUserId.has(request.userId)) {
      continue;
    }
    const roles = request.user?.roles ?? [];
    const role = roles.find((value) => value !== "global_admin") ?? roles[0] ?? "unknown";
    const name =
      request.user?.displayName ??
      request.user?.username ??
      request.user?.email ??
      request.userId;

    approvedByUserId.set(request.userId, {
      userId: request.userId,
      name,
      email: request.user?.email ?? "",
      role,
      subscriptionPlan: normalizeSubscriptionPlan(request.user?.subscriptionPlan ?? "basic"),
      approvedAt: request.reviewedAt
    });
  }

  // Ensure seeded/global admins show up even without approved access requests.
  const adminMemberships = tenantObjectId
    ? await db.collection<{ userId: ObjectId }>("core_tenant_memberships").find({
        tenantId: tenantObjectId
      }).toArray()
    : [];

  const adminUserIds = Array.from(
    new Set(
      adminMemberships
        .map((membership) => membership.userId?.toHexString())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (adminUserIds.length > 0) {
    const adminUsers = await db
      .collection<CoreUser>("core_users")
      .find({
        _id: {
          $in: adminUserIds.filter(ObjectId.isValid).map((id) => new ObjectId(id))
        },
        roles: "global_admin"
      })
      .project({
        email: 1,
        roles: 1,
        subscriptionPlan: 1,
        "xAccount.username": 1,
        "xAccount.displayName": 1
      })
      .toArray();

    for (const user of adminUsers) {
      if (!user._id) {
        continue;
      }
      const userId = user._id.toHexString();
      if (approvedByUserId.has(userId)) {
        continue;
      }
      approvedByUserId.set(userId, {
        userId,
        name: user.xAccount?.displayName ?? user.xAccount?.username ?? user.email,
        email: user.email,
        role: "global_admin",
        subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan ?? "basic")
      });
    }
  }

  return Array.from(approvedByUserId.values()).slice(0, limit);
}

export async function listScheduledTasks(options?: {
  limit?: number;
  tenantId?: string;
  /** When set, returns only tasks bound to this portfolio. */
  portfolioId?: string;
  /**
   * When true (Admin → Tasks default): only jobs with no `tenantId` — executed once per `core_tenants` on
   * run/tick (`executeSystemWideScheduledTask`). Excludes per-tenant duplicates and portfolio-bound rows.
   */
  systemWideOnly?: boolean;
}): Promise<ScheduledTask[]> {
  const limit = options?.limit ?? 50;
  const db = await getDb();
  const portfolioFilter =
    options?.portfolioId && ObjectId.isValid(options.portfolioId)
      ? { portfolioId: new ObjectId(options.portfolioId) }
      : {
          $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
        };
  const query: Filter<ScheduledTask> =
    options?.systemWideOnly === true
      ? ({
          $and: [
            portfolioFilter,
            { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] }
          ]
        } as Filter<ScheduledTask>)
      : (scheduledTaskTenantReadScope(portfolioFilter, options?.tenantId) as Filter<ScheduledTask>);
  return db.collection<ScheduledTask>(collections.scheduledTasks).find(query).sort({ name: 1 }).limit(limit).toArray();
}

export async function createScheduledTask(
  payload: Omit<ScheduledTask, "_id" | "tenantId" | "portfolioId" | "appBrokerImportJobId"> & {
    tenantId?: string;
    portfolioId?: string;
    appBrokerImportJobId?: string;
  }
): Promise<ScheduledTask> {
  const db = await getDb();
  const now = new Date();
  const portfolioOid =
    payload.portfolioId && ObjectId.isValid(payload.portfolioId)
      ? new ObjectId(payload.portfolioId)
      : undefined;
  const appBrokerImportJobOid =
    payload.appBrokerImportJobId && ObjectId.isValid(payload.appBrokerImportJobId)
      ? new ObjectId(payload.appBrokerImportJobId)
      : undefined;
  const scheduleDescription = resolveScheduleDescription({
    scheduleCron: payload.scheduleCron,
    scheduleRRule: payload.scheduleRRule,
    scheduleDescription: payload.scheduleDescription
  });
  const resolvedNextRunAt =
    payload.nextRunAt ??
    computeNextRunAtFromSchedule(
      { scheduleCron: payload.scheduleCron, scheduleRRule: payload.scheduleRRule },
      now
    ) ??
    new Date(now.getTime() + 5 * 60 * 1000);
  const tenantOid = toTenantObjectId(payload.tenantId);
  const document: ScheduledTask = {
    name: payload.name,
    category: payload.category,
    scheduleCron: payload.scheduleCron,
    scheduleRRule: payload.scheduleRRule,
    scheduleDescription,
    enabled: payload.enabled,
    runTimeoutSeconds: payload.runTimeoutSeconds,
    maxRetries: payload.maxRetries,
    lastRunAt: payload.lastRunAt,
    nextRunAt: resolvedNextRunAt,
    ...(tenantOid ? { tenantId: tenantOid } : {}),
    ...(portfolioOid ? { portfolioId: portfolioOid } : {}),
    ...(appBrokerImportJobOid ? { appBrokerImportJobId: appBrokerImportJobOid } : {}),
    ...(payload.deliveryChannelTarget ? { deliveryChannelTarget: payload.deliveryChannelTarget } : {})
  };
  const result = await db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function updateScheduledTask(input: {
  taskId: string;
  tenantId?: string;
  expectedPortfolioId?: string;
  name?: string;
  category?: ScheduledTask["category"];
  scheduleCron?: string;
  scheduleRRule?: string | null;
  scheduleDescription?: string;
  enabled?: boolean;
  nextRunAt?: Date | null;
  deliveryChannelTarget?: ObjectId | null;
}): Promise<ScheduledTask | null> {
  const existing = await getScheduledTaskById(input.taskId, { tenantId: input.tenantId });
  if (!existing?._id) {
    return null;
  }
  if (input.expectedPortfolioId !== undefined) {
    const want = input.expectedPortfolioId;
    const got = existing.portfolioId?.toHexString();
    if (got !== want) {
      return null;
    }
  }
  const db = await getDb();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, unknown> = {};
  const nextScheduleCron =
    input.scheduleCron !== undefined ? input.scheduleCron.trim() : existing.scheduleCron;
  const nextScheduleRRule =
    input.scheduleRRule !== undefined
      ? input.scheduleRRule === null
        ? undefined
        : input.scheduleRRule.trim()
      : existing.scheduleRRule;
  if (input.name !== undefined) {
    $set.name = input.name.trim().slice(0, 200);
  }
  if (input.category !== undefined) {
    $set.category = input.category;
  }
  if (input.scheduleCron !== undefined) {
    $set.scheduleCron = nextScheduleCron;
  }
  if (input.scheduleRRule !== undefined) {
    if (input.scheduleRRule === null) {
      $unset.scheduleRRule = "";
    } else {
      $set.scheduleRRule = nextScheduleRRule;
    }
  }
  if (input.scheduleDescription !== undefined) {
    $set.scheduleDescription = input.scheduleDescription.trim().slice(0, 280);
  } else if (input.scheduleCron !== undefined || input.scheduleRRule !== undefined) {
    $set.scheduleDescription = resolveScheduleDescription({
      scheduleCron: nextScheduleCron,
      scheduleRRule: nextScheduleRRule
    });
  }
  if (input.enabled !== undefined) {
    $set.enabled = input.enabled;
  }
  if (input.nextRunAt !== undefined) {
    $set.nextRunAt = input.nextRunAt;
  }
  if (input.deliveryChannelTarget !== undefined) {
    if (input.deliveryChannelTarget === null) {
      $unset.deliveryChannelTarget = "";
    } else {
      $set.deliveryChannelTarget = input.deliveryChannelTarget;
    }
  }
  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return existing;
  }
  const updateDoc: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) {
    updateDoc.$set = $set;
  }
  if (Object.keys($unset).length > 0) {
    updateDoc.$unset = $unset;
  }
  await db.collection<ScheduledTask>(collections.scheduledTasks).updateOne(
    scheduledTaskTenantReadScope({ _id: existing._id }, input.tenantId),
    updateDoc
  );
  return getScheduledTaskById(input.taskId, { tenantId: input.tenantId });
}

export async function deleteScheduledTask(input: {
  taskId: string;
  tenantId?: string;
  expectedPortfolioId?: string;
}): Promise<boolean> {
  const existing = await getScheduledTaskById(input.taskId, { tenantId: input.tenantId });
  if (!existing?._id) {
    return false;
  }
  if (input.expectedPortfolioId !== undefined) {
    const got = existing.portfolioId?.toHexString();
    if (got !== input.expectedPortfolioId) {
      return false;
    }
  }
  const db = await getDb();
  const res = await db.collection<ScheduledTask>(collections.scheduledTasks).deleteOne(
    scheduledTaskTenantReadScope({ _id: existing._id }, input.tenantId)
  );
  return (res.deletedCount ?? 0) === 1;
}

export async function getScheduledTaskById(
  id: string,
  options?: TenantScopedOptions
): Promise<ScheduledTask | null> {
  const db = await getDb();
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .findOne(scheduledTaskTenantReadScope({ _id: new ObjectId(id) }, options?.tenantId));
}

export async function listDueScheduledTasks(
  now: Date,
  options?: TenantScopedOptions
): Promise<ScheduledTask[]> {
  const db = await getDb();
  return db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .find(
      scheduledTaskTenantReadScope(
        {
          enabled: true,
          nextRunAt: { $lte: now },
          $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
        },
        options?.tenantId
      )
    )
    .sort({ nextRunAt: 1 })
    .limit(80)
    .toArray();
}

const CORE_TENANTS_COLLECTION = "core_tenants";

/** Sorted `core_tenants._id` values — used when `admin_scheduled_tasks` rows omit `tenantId` (system-wide jobs). */
export async function listCoreTenantObjectIds(): Promise<ObjectId[]> {
  const db = await getDb();
  const rows = await db
    .collection<{ _id: ObjectId }>(CORE_TENANTS_COLLECTION)
    .find({})
    .project({ _id: 1 })
    .sort({ _id: 1 })
    .toArray();
  return rows.map((r) => r._id);
}

export async function markTaskRunWindow(
  taskId: ObjectId,
  startedAt: Date,
  schedule: { scheduleCron?: string | null; scheduleRRule?: string | null }
): Promise<void> {
  const db = await getDb();
  const nextRunAt =
    computeNextRunAtFromSchedule(schedule, startedAt) ??
    new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);
  await db.collection<ScheduledTask>(collections.scheduledTasks).updateOne(
    { _id: taskId },
    {
      $set: {
        lastRunAt: startedAt,
        nextRunAt
      }
    }
  );
}

export async function createTaskRun(
  payload: Omit<TaskRun, "_id" | "startedAt" | "status">
): Promise<TaskRun> {
  const db = await getDb();
  const document: TaskRun = {
    ...payload,
    status: "running",
    startedAt: new Date()
  };
  const result = await db.collection<TaskRun>(collections.taskRuns).insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function finalizeTaskRun(
  runId: ObjectId,
  payload: Pick<TaskRun, "status" | "output" | "durationMs" | "completedAt">
): Promise<void> {
  const db = await getDb();
  await db.collection<TaskRun>(collections.taskRuns).updateOne(
    { _id: runId },
    {
      $set: payload
    }
  );
}

export async function listTaskRuns(options?: {
  limit?: number;
  tenantId?: string;
  /** When true (Admin → Task runs), list runs for all tenants — matches system-wide job fan-out. */
  allTenants?: boolean;
  /** Inclusive lower bound on `startedAt`. */
  startedAtMin?: Date;
  /** Exclusive upper bound on `startedAt` (Mongo `$lt`). */
  startedAtMaxExclusive?: Date;
}): Promise<TaskRun[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 500);
  const db = await getDb();
  const time: { $gte?: Date; $lt?: Date } = {};
  if (options?.startedAtMin) {
    time.$gte = options.startedAtMin;
  }
  if (options?.startedAtMaxExclusive) {
    time.$lt = options.startedAtMaxExclusive;
  }
  const base: Filter<TaskRun> = Object.keys(time).length > 0 ? { startedAt: time } : {};
  const filter: Filter<TaskRun> =
    options?.allTenants === true ? base : withTenantScope(base, options?.tenantId);
  return db
    .collection<TaskRun>(collections.taskRuns)
    .find(filter)
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getUserAdminSettings(
  userId: string,
  options?: TenantScopedOptions
): Promise<UserAdminSettings | null> {
  const db = await getDb();
  return db
    .collection<UserAdminSettings>(collections.userSettings)
    .findOne(withTenantScope({ userId }, options?.tenantId));
}

export async function upsertUserAdminSettings(
  userId: string,
  payload: Omit<UserAdminSettings, "_id" | "tenantId" | "userId" | "updatedAt">,
  options?: TenantScopedOptions
): Promise<UserAdminSettings> {
  const db = await getDb();
  const updatedAt = new Date();

  const tenantId = toTenantObjectId(options?.tenantId);
  await db.collection<UserAdminSettings>(collections.userSettings).updateOne(
    withTenantScope({ userId }, options?.tenantId, "allowMissingTenantKey"),
    {
      $set: {
        tenantId,
        userId,
        ...payload,
        updatedAt
      }
    },
    { upsert: true }
  );

  const document = await getUserAdminSettings(userId, options);
  if (!document) {
    throw new Error("Failed to upsert admin settings");
  }
  return document;
}

export async function listDeployNoteConfigs(options?: {
  limit?: number;
  environment?: DeployNoteConfig["environment"];
  tenantId?: string;
}): Promise<DeployNoteConfig[]> {
  const db = await getDb();
  const limit = options?.limit ?? 100;
  const filter: Record<string, unknown> = {};
  if (options?.environment) {
    filter.environment = options.environment;
  }
  return db
    .collection<DeployNoteConfig>(collections.deployNoteConfigs)
    .find(withTenantScope(filter, options?.tenantId))
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function createDeployNoteConfig(
  payload: Omit<DeployNoteConfig, "_id" | "tenantId" | "createdAt" | "updatedAt"> & {
    tenantId?: string;
  }
): Promise<DeployNoteConfig> {
  const db = await getDb();
  const now = new Date();
  const document: DeployNoteConfig = {
    tenantId: toTenantObjectId(payload.tenantId),
    name: payload.name,
    environment: payload.environment,
    enabled: payload.enabled,
    includeRunUrl: payload.includeRunUrl,
    includeActor: payload.includeActor,
    defaultDeploymentNotes: payload.defaultDeploymentNotes,
    defaultHotfixNotes: payload.defaultHotfixNotes,
    createdAt: now,
    updatedAt: now
  };
  const result = await db
    .collection<DeployNoteConfig>(collections.deployNoteConfigs)
    .insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function getDeployNoteConfigById(
  id: string,
  options?: TenantScopedOptions
): Promise<DeployNoteConfig | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<DeployNoteConfig>(collections.deployNoteConfigs)
    .findOne(withTenantScope({ _id: new ObjectId(id) }, options?.tenantId));
}

export async function updateDeployNoteConfigById(input: {
  configId: string;
  patch: Partial<
    Omit<DeployNoteConfig, "_id" | "tenantId" | "createdAt" | "updatedAt">
  >;
  tenantId?: string;
}): Promise<DeployNoteConfig | null> {
  if (!ObjectId.isValid(input.configId)) {
    return null;
  }
  const db = await getDb();
  const _id = new ObjectId(input.configId);
  await db.collection<DeployNoteConfig>(collections.deployNoteConfigs).updateOne(
    withTenantScope({ _id }, input.tenantId),
    {
      $set: {
        ...input.patch,
        updatedAt: new Date()
      }
    }
  );
  return db
    .collection<DeployNoteConfig>(collections.deployNoteConfigs)
    .findOne(withTenantScope({ _id }, input.tenantId));
}

export async function deleteDeployNoteConfigById(
  configId: string,
  options?: TenantScopedOptions
): Promise<boolean> {
  if (!ObjectId.isValid(configId)) {
    return false;
  }
  const db = await getDb();
  const result = await db
    .collection<DeployNoteConfig>(collections.deployNoteConfigs)
    .deleteOne(withTenantScope({ _id: new ObjectId(configId) }, options?.tenantId));
  return result.deletedCount === 1;
}

export async function listAdminDeliveryChannels(
  _options?: TenantScopedOptions
): Promise<AdminDeliveryChannel[]> {
  // Reference _options to satisfy eslint no-unused-vars when callers pass it for type compatibility.
  void _options;
  const db = await getDb();
  return db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();
}

export async function createAdminDeliveryChannel(
  payload: Omit<AdminDeliveryChannel, "_id" | "tenantId" | "createdAt" | "updatedAt">
): Promise<AdminDeliveryChannel> {
  const db = await getDb();
  const now = new Date();
  const document: AdminDeliveryChannel = {
    // System-wide: do not persist tenantId
    name: payload.name.trim(),
    deliveryTarget: payload.deliveryTarget,
    slackWebhookUrl:
      payload.deliveryTarget === "slack" ? payload.slackWebhookUrl?.trim() : undefined,
    emailTo: payload.deliveryTarget === "email" ? payload.emailTo?.trim() : undefined,
    createdAt: now,
    updatedAt: now
  };
  const result = await db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function getAdminDeliveryChannelById(
  id: string,
  _options?: TenantScopedOptions
): Promise<AdminDeliveryChannel | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  // Reference _options to satisfy eslint no-unused-vars when callers pass it for type compatibility.
  void _options;
  const db = await getDb();
  return db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .findOne({ _id: new ObjectId(id) });
}

/**
 * Lookup by `_id` only — for system-wide scheduled tasks (`task.tenantId` unset) where Slack/email notify
 * must resolve a delivery channel stored under a concrete tenant. Call only from trusted task-runner paths.
 */
export async function getAdminDeliveryChannelByIdUnscoped(id: string): Promise<AdminDeliveryChannel | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .findOne({ _id: new ObjectId(id) });
}

export async function updateAdminDeliveryChannelById(input: {
  channelId: string;
  patch: Partial<Pick<AdminDeliveryChannel, "name" | "deliveryTarget" | "slackWebhookUrl" | "emailTo">>;
  /** Optional tenant scope from callers; channels are system-wide, so this is currently ignored. */
  tenantId?: string;
}): Promise<AdminDeliveryChannel | null> {
  if (!ObjectId.isValid(input.channelId)) {
    return null;
  }
  const db = await getDb();
  const _id = new ObjectId(input.channelId);
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  const $unset: Record<string, string> = {};
  const p = input.patch;
  if (p.name !== undefined) {
    $set.name = p.name.trim();
  }
  if (p.deliveryTarget !== undefined) {
    $set.deliveryTarget = p.deliveryTarget;
    if (p.deliveryTarget === "in_app") {
      $unset.slackWebhookUrl = "";
      $unset.emailTo = "";
    } else if (p.deliveryTarget === "slack") {
      $unset.emailTo = "";
    } else if (p.deliveryTarget === "email") {
      $unset.slackWebhookUrl = "";
    }
  }
  if (p.slackWebhookUrl !== undefined) {
    const t = p.slackWebhookUrl?.trim();
    if (t) {
      $set.slackWebhookUrl = t;
    } else {
      $unset.slackWebhookUrl = "";
    }
  }
  if (p.emailTo !== undefined) {
    const t = p.emailTo?.trim();
    if (t) {
      $set.emailTo = t;
    } else {
      $unset.emailTo = "";
    }
  }
  const updateDoc: Record<string, unknown> = { $set };
  if (Object.keys($unset).length > 0) {
    updateDoc.$unset = $unset;
  }
  await db.collection<AdminDeliveryChannel>(collections.adminDeliveryChannels).updateOne(
    { _id },
    updateDoc
  );
  return db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .findOne({ _id });
}

export async function deleteAdminDeliveryChannelById(
  channelId: string,
  options?: TenantScopedOptions
): Promise<boolean> {
  if (!ObjectId.isValid(channelId)) {
    return false;
  }
  const db = await getDb();
  const result = await db
    .collection<AdminDeliveryChannel>(collections.adminDeliveryChannels)
    .deleteOne(withTenantScope({ _id: new ObjectId(channelId) }, options?.tenantId));
  return result.deletedCount === 1;
}

/**
 * Session-scoped portfolios for a user (includes legacy rows with null / missing tenantId when a tenant is in session).
 * `allowLegacyUserScope`: OAuth/bootstrap + admin ops when portfolio has no tenant id.
 */
function userPortfoliosInSessionScopeFilter(
  userId: string,
  tenantId?: string,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  return mongoPortfolioFamilyUserScope(userId, tenantId, whenTenantMissing);
}

function userAccountsForPortfolioSessionScopeFilter(
  userId: string,
  portfolioId: string,
  tenantId?: string,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  return mongoPortfolioFamilyUserPortfolioScope(userId, portfolioId, tenantId, whenTenantMissing);
}

function userAccountsInSessionScopeFilter(
  userId: string,
  tenantId?: string,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  return mongoPortfolioFamilyUserScope(userId, tenantId, whenTenantMissing);
}

function userWatchlistSessionScopeFilter(
  userId: string,
  tenantId?: string,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  return userAccountsInSessionScopeFilter(userId, tenantId, whenTenantMissing);
}

/**
 * Multiple `portfolio_watchlists` rows can match one user (legacy `portfolioId` vs tenant-global, or duplicate
 * stubs). Prefer the desk users expect: most symbols, then user-global (no `portfolioId`), then recency.
 */
async function findLatestWatchlistMatchingFilter(
  db: import("mongodb").Db,
  filter: Record<string, unknown>
): Promise<Watchlist | null> {
  const rows = await db
    .collection<Watchlist>(collections.watchlists)
    .find(filter as Filter<Watchlist>)
    .toArray();
  return pickPreferredWatchlistDocument(rows);
}

function defaultPortfolioMarkerFilter(
  userId: string,
  tenantId?: string,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  return {
    ...userPortfoliosInSessionScopeFilter(userId, tenantId, whenTenantMissing),
    isDefault: true
  };
}

function comparePortfolioAge(a: Portfolio, b: Portfolio): number {
  const ta =
    a.createdAt instanceof Date && !Number.isNaN(a.createdAt.getTime())
      ? a.createdAt.getTime()
      : 0;
  const tb =
    b.createdAt instanceof Date && !Number.isNaN(b.createdAt.getTime())
      ? b.createdAt.getTime()
      : 0;
  if (ta !== tb) {
    return ta - tb;
  }
  const ha = a._id?.toHexString() ?? "";
  const hb = b._id?.toHexString() ?? "";
  return ha.localeCompare(hb);
}

/**
 * Enforces exactly one default portfolio per user in the session scope (tenant + legacy null tenant rows).
 * - Multiple `isDefault: true`: keep the oldest by `createdAt` / `_id`, clear the rest (aligns with partial unique index intent).
 * - None default but portfolios exist: promote the oldest portfolio; admin can still move default via `adminUpdatePortfolio`.
 */
export async function ensureDefaultPortfolioInvariantForUser(
  userId: string,
  options?: TenantScopedOptions
): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const coll = db.collection<Portfolio>(collections.portfolios);
  const markerFilter = defaultPortfolioMarkerFilter(
    userId,
    options?.tenantId,
    "allowLegacyUserScope"
  );
  const scopeFilter = userPortfoliosInSessionScopeFilter(
    userId,
    options?.tenantId,
    "allowLegacyUserScope"
  );

  const defaultCount = await coll.countDocuments(markerFilter);
  if (defaultCount === 1) {
    return coll.findOne(markerFilter);
  }

  const now = new Date();

  if (defaultCount > 1) {
    const marked = await coll
      .find(markerFilter)
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    marked.sort(comparePortfolioAge);
    const keeper = marked[0];
    if (!keeper?._id) {
      return null;
    }
    const otherIds = marked.slice(1).map((p) => p._id).filter(Boolean) as ObjectId[];
    if (otherIds.length > 0) {
      await coll.updateMany(
        { _id: { $in: otherIds } },
        { $set: { isDefault: false, updatedAt: now } }
      );
    }
    await coll.updateOne(
      { _id: keeper._id },
      { $set: { isDefault: true, updatedAt: now } }
    );
    console.warn("[portfolio/invariant] repaired_multiple_default_flags", {
      userIdPrefix: `${userId.slice(0, 8)}…`,
      tenantScoped: Boolean(options?.tenantId),
      clearedCount: otherIds.length
    });
    return coll.findOne({ _id: keeper._id });
  }

  const total = await coll.countDocuments(scopeFilter);
  if (total === 0) {
    return null;
  }

  const all = await coll
    .find(scopeFilter)
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  all.sort(comparePortfolioAge);
  const keeper = all[0];
  if (!keeper?._id) {
    return null;
  }
  const otherIds = all.slice(1).map((p) => p._id).filter(Boolean) as ObjectId[];
  if (otherIds.length > 0) {
    await coll.updateMany(
      { _id: { $in: otherIds } },
      { $set: { isDefault: false, updatedAt: now } }
    );
  }
  await coll.updateOne(
    { _id: keeper._id },
    { $set: { isDefault: true, updatedAt: now } }
  );
  console.warn("[portfolio/invariant] promoted_oldest_portfolio_to_default", {
    userIdPrefix: `${userId.slice(0, 8)}…`,
    tenantScoped: Boolean(options?.tenantId),
    peerCount: otherIds.length
  });
  return coll.findOne({ _id: keeper._id });
}

export async function getDefaultPortfolio(
  userId: string,
  options?: TenantScopedOptions
): Promise<Portfolio | null> {
  return ensureDefaultPortfolioInvariantForUser(userId, options);
}

/**
 * Bumps `workspaceContentRev` on an owned portfolio so xChat workspace snapshot cache keys miss
 * after positions, accounts, watchlist, or portfolio metadata changes.
 */
export async function bumpPortfolioWorkspaceContentRev(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<void> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return;
  }
  const db = await getDb();
  const pid = new ObjectId(input.portfolioId);
  await db.collection<Portfolio>(collections.portfolios).updateOne(
    withTenantScope(
      {
        _id: pid,
        ...userIdQuery(input.userId.trim())
      },
      input.tenantId
    ),
    {
      $inc: { workspaceContentRev: 1 },
      $set: { updatedAt: new Date() }
    }
  );
}

/** Bumps workspace rev on every owned portfolio so xChat cache misses after user-global watchlist edits. */
export async function bumpWorkspaceContentRevForAllUserPortfolios(input: {
  userId: string;
  tenantId?: string;
}): Promise<void> {
  const rows = await listPortfoliosForSessionUser(input);
  await Promise.all(
    rows.map((p) =>
      p._id
        ? bumpPortfolioWorkspaceContentRev({
            userId: input.userId,
            portfolioId: p._id.toHexString(),
            tenantId: input.tenantId
          })
        : Promise.resolve()
    )
  );
}

/** Portfolio must belong to the session user (tenant-scoped). */
export async function getPortfolioByIdForSessionUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
}): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  const db = await getDb();
  return db.collection<Portfolio>(collections.portfolios).findOne({
    _id: new ObjectId(input.portfolioId),
    ...userPortfoliosInSessionScopeFilter(input.userId, input.tenantId)
  });
}

/** All portfolios for the session user (tenant-scoped), oldest first. */
export async function listPortfoliosForSessionUser(input: {
  userId: string;
  tenantId?: string;
}): Promise<Portfolio[]> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const filter = userPortfoliosInSessionScopeFilter(input.userId, input.tenantId);
  return db
    .collection<Portfolio>(collections.portfolios)
    .find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
}

/** Removes all position lots for an account (replace-before-import). Returns deleted count. */
export async function deletePositionsForPortfolioAccount(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  accountId: string;
}): Promise<number> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.accountId)) {
    return 0;
  }
  const db = await getDb();
  const result = await db.collection<Position>(collections.positions).deleteMany(
    withTenantScope(
      {
        ...userIdQuery(input.userId),
        portfolioId: new ObjectId(input.portfolioId),
        accountId: new ObjectId(input.accountId)
      },
      input.tenantId
    )
  );
  const n = result.deletedCount ?? 0;
  if (n > 0) {
    await bumpPortfolioWorkspaceContentRev({
      userId: input.userId,
      portfolioId: input.portfolioId,
      tenantId: input.tenantId
    });
  }
  return n;
}

/** Removes every position lot for the portfolio (all accounts). Returns deleted count. */
export async function deleteAllPositionsForPortfolio(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
}): Promise<number> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return 0;
  }
  const db = await getDb();
  const result = await db.collection<Position>(collections.positions).deleteMany(
    withTenantScope(
      {
        ...userIdQuery(input.userId),
        portfolioId: new ObjectId(input.portfolioId)
      },
      input.tenantId
    )
  );
  const n = result.deletedCount ?? 0;
  if (n > 0) {
    await bumpPortfolioWorkspaceContentRev({
      userId: input.userId,
      portfolioId: input.portfolioId,
      tenantId: input.tenantId
    });
  }
  return n;
}

/**
 * Deletes scheduled tasks bound to a portfolio and category (e.g. stuck `sync-broker` import tasks).
 * Tenant scope matches list/read helpers.
 */
export async function deleteScheduledTasksForPortfolioCategory(input: {
  portfolioId: string;
  category: ScheduledTask["category"];
  tenantId?: string;
}): Promise<number> {
  if (!ObjectId.isValid(input.portfolioId)) {
    return 0;
  }
  const db = await getDb();
  const filter = scheduledTaskTenantReadScope(
    {
      portfolioId: new ObjectId(input.portfolioId),
      category: input.category
    },
    input.tenantId
  );
  const res = await db.collection<ScheduledTask>(collections.scheduledTasks).deleteMany(filter);
  return res.deletedCount ?? 0;
}

export async function listPortfolioAccounts(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<Account[]> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return [];
  }
  const db = await getDb();
  return db
    .collection<Account>(collections.accounts)
    .find(userAccountsForPortfolioSessionScopeFilter(input.userId, input.portfolioId, input.tenantId))
    .sort({ isDefault: -1, createdAt: 1 })
    .toArray();
}

/**
 * Loads a custodian account by id when it belongs to the session user (any portfolio).
 * Use when the active workspace portfolio may differ from the portfolio that owns the account (e.g. `/portfolios` focus vs cookie).
 */
export async function getPortfolioAccountByIdForSessionUser(input: {
  userId: string;
  tenantId?: string;
  accountId: string;
}): Promise<Account | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.accountId)) {
    return null;
  }
  const db = await getDb();
  const filter = {
    _id: new ObjectId(input.accountId),
    ...userAccountsInSessionScopeFilter(input.userId, input.tenantId)
  };
  return db.collection<Account>(collections.accounts).findOne(filter);
}

export async function countPortfolioAccountsForUser(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<number> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return 0;
  }
  const db = await getDb();
  return db.collection<Account>(collections.accounts).countDocuments(
    userAccountsForPortfolioSessionScopeFilter(input.userId, input.portfolioId, input.tenantId)
  );
}

export async function countPortfoliosForUserInTenant(input: {
  userId: string;
  tenantId?: string;
}): Promise<number> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  return db
    .collection<Portfolio>(collections.portfolios)
    .countDocuments(userPortfoliosInSessionScopeFilter(input.userId.trim(), input.tenantId));
}

export async function listPortfolioPositionsByAccount(input: {
  userId: string;
  portfolioId: string;
  accountIds: ObjectId[];
  tenantId?: string;
}): Promise<Position[]> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || input.accountIds.length === 0) {
    return [];
  }

  const db = await getDb();
  return db
    .collection<Position>(collections.positions)
    .find(
      withTenantScope(
        {
          ...userIdQuery(input.userId),
          portfolioId: new ObjectId(input.portfolioId),
          accountId: { $in: input.accountIds }
        },
        input.tenantId
      )
    )
    .sort({ createdAt: 1 })
    .toArray();
}

// Recommendations
export async function listRecommendations(input: { userId: string; tenantId?: string; portfolioId: string; }): Promise<Recommendation[]> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) return [];
  const db = await getDb();
  return db
    .collection<Recommendation>(collections.recommendations)
    .find(
      withTenantScope(
        { ...userIdQuery(input.userId), portfolioId: new ObjectId(input.portfolioId) },
        input.tenantId
      )
    )
    .sort({ createdAt: -1 })
    .toArray();
}

export async function createRecommendation(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  symbol: string;
  action: "buy" | "sell" | "hold" | "watch";
  note?: string;
  accountId?: string;
  quantity?: number;
  targetPrice?: number;
}): Promise<Recommendation | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) return null;
  const portfolio = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  if (!portfolio?._id) return null;
  const now = new Date();
  const doc: Recommendation = {
    tenantId: toTenantObjectId(input.tenantId),
    userId: input.userId,
    portfolioId: portfolio._id,
    accountId: input.accountId && ObjectId.isValid(input.accountId) ? new ObjectId(input.accountId) : undefined,
    symbol: input.symbol.trim().toUpperCase(),
    action: input.action,
    note: input.note?.trim() || undefined,
    quantity: typeof input.quantity === "number" && Number.isFinite(input.quantity) ? input.quantity : undefined,
    targetPrice: typeof input.targetPrice === "number" && Number.isFinite(input.targetPrice) ? input.targetPrice : undefined,
    status: "new",
    createdAt: now,
    updatedAt: now
  };
  const db = await getDb();
  const res = await db.collection<Recommendation>(collections.recommendations).insertOne(doc);
  const created = await db.collection<Recommendation>(collections.recommendations).findOne({ _id: res.insertedId });
  return created;
}

export async function getRecommendationById(input: { userId: string; tenantId?: string; portfolioId: string; id: string; }): Promise<Recommendation | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.id)) return null;
  const db = await getDb();
  return db.collection<Recommendation>(collections.recommendations).findOne(
    withTenantScope(
      { _id: new ObjectId(input.id), ...userIdQuery(input.userId), portfolioId: new ObjectId(input.portfolioId) },
      input.tenantId
    )
  );
}

export async function updateRecommendationById(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  id: string;
  patch: Partial<Pick<Recommendation, "action" | "note" | "quantity" | "targetPrice" | "status" | "symbol">>;
}): Promise<Recommendation | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.id)) return null;
  const now = new Date();
  const db = await getDb();
  const filter = strictWriteTenantFilter(
    { _id: new ObjectId(input.id), ...userIdQuery(input.userId), portfolioId: new ObjectId(input.portfolioId) },
    input.tenantId
  );
  const set: Partial<Recommendation> = { updatedAt: now };
  if (input.patch.action) set.action = input.patch.action;
  if (input.patch.note !== undefined) set.note = input.patch.note?.trim() || undefined;
  if (input.patch.quantity !== undefined) set.quantity = Number.isFinite(input.patch.quantity as number) ? (input.patch.quantity as number) : undefined;
  if (input.patch.targetPrice !== undefined) set.targetPrice = Number.isFinite(input.patch.targetPrice as number) ? (input.patch.targetPrice as number) : undefined;
  if (input.patch.status) set.status = input.patch.status;
  if (input.patch.symbol !== undefined) {
    const sym = input.patch.symbol.trim().toUpperCase();
    if (sym.length > 0) {
      set.symbol = sym.slice(0, 32);
    }
  }
  await db.collection<Recommendation>(collections.recommendations).updateOne(filter, { $set: set });
  return getRecommendationById({ userId: input.userId, tenantId: input.tenantId, portfolioId: input.portfolioId, id: input.id });
}

export async function deleteRecommendationById(input: { userId: string; tenantId?: string; portfolioId: string; id: string; }): Promise<boolean> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.id)) return false;
  const db = await getDb();
  const res = await db.collection<Recommendation>(collections.recommendations).deleteOne(
    strictWriteTenantFilter(
      { _id: new ObjectId(input.id), ...userIdQuery(input.userId), portfolioId: new ObjectId(input.portfolioId) },
      input.tenantId
    )
  );
  return (res.deletedCount ?? 0) > 0;
}

export async function adminListRecommendationsForPortfolio(portfolioId: string): Promise<Recommendation[]> {
  const p = await adminGetPortfolioById(portfolioId);
  if (!p?._id) {
    return [];
  }
  return listRecommendations({
    userId: portfolioOwnerUserIdString(p.userId),
    tenantId: portfolioTenantIdString(p),
    portfolioId
  });
}

export async function adminCreateRecommendationForPortfolio(input: {
  portfolioId: string;
  symbol: string;
  action: Recommendation["action"];
  note?: string;
  accountId?: string;
  quantity?: number;
  targetPrice?: number;
  /**
   * When set (e.g. `options_scanner` scheduled task), refuse writes unless the portfolio belongs
   * to this tenant — prevents cross-tenant recommendation rows.
   */
  jobTenantId?: ObjectId;
}): Promise<Recommendation | null> {
  await ensurePortfolioIndexes();
  const portfolio = await adminGetPortfolioById(input.portfolioId);
  if (!portfolio?._id || !ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  if (input.jobTenantId) {
    if (!portfolio.tenantId || !portfolio.tenantId.equals(input.jobTenantId)) {
      return null;
    }
  }
  const userId = portfolioOwnerUserIdString(portfolio.userId);
  const tenantId = portfolioTenantIdString(portfolio);
  const now = new Date();
  const doc: Recommendation = {
    tenantId: toTenantObjectId(tenantId),
    userId,
    portfolioId: portfolio._id,
    accountId: input.accountId && ObjectId.isValid(input.accountId) ? new ObjectId(input.accountId) : undefined,
    symbol: input.symbol.trim().toUpperCase().slice(0, 32),
    action: input.action,
    note: input.note?.trim() || undefined,
    quantity: typeof input.quantity === "number" && Number.isFinite(input.quantity) ? input.quantity : undefined,
    targetPrice: typeof input.targetPrice === "number" && Number.isFinite(input.targetPrice) ? input.targetPrice : undefined,
    status: "new",
    createdAt: now,
    updatedAt: now
  };
  const db = await getDb();
  const res = await db.collection<Recommendation>(collections.recommendations).insertOne(doc);
  return db.collection<Recommendation>(collections.recommendations).findOne({ _id: res.insertedId });
}

export async function adminUpdateRecommendationForPortfolio(input: {
  portfolioId: string;
  id: string;
  patch: Partial<Pick<Recommendation, "action" | "note" | "quantity" | "targetPrice" | "status" | "symbol">>;
  /** Same contract as {@link adminCreateRecommendationForPortfolio}'s `jobTenantId`. */
  jobTenantId?: ObjectId;
}): Promise<Recommendation | null> {
  const p = await adminGetPortfolioById(input.portfolioId);
  if (!p?._id) {
    return null;
  }
  if (input.jobTenantId) {
    if (!p.tenantId || !p.tenantId.equals(input.jobTenantId)) {
      return null;
    }
  }
  return updateRecommendationById({
    userId: portfolioOwnerUserIdString(p.userId),
    tenantId: portfolioTenantIdString(p),
    portfolioId: input.portfolioId,
    id: input.id,
    patch: input.patch
  });
}

export async function adminDeleteRecommendationForPortfolio(portfolioId: string, id: string): Promise<boolean> {
  const p = await adminGetPortfolioById(portfolioId);
  if (!p?._id) {
    return false;
  }
  return deleteRecommendationById({
    userId: portfolioOwnerUserIdString(p.userId),
    tenantId: portfolioTenantIdString(p),
    portfolioId,
    id
  });
}

type PortfolioScopedWriteContext = {
  userId: string;
  tenantId?: string;
  portfolioOid: ObjectId;
  portfolioName?: string;
};

async function portfolioScopedWriteContext(portfolioId: string): Promise<PortfolioScopedWriteContext | null> {
  const p = await adminGetPortfolioById(portfolioId);
  if (!p?._id) {
    return null;
  }
  const name = p.name?.trim();
  return {
    userId: portfolioOwnerUserIdString(p.userId),
    tenantId: portfolioTenantIdString(p),
    portfolioOid: p._id,
    portfolioName: name ? name.slice(0, 120) : undefined
  };
}

export async function adminListPortfolioAlerts(portfolioId: string): Promise<PortfolioAlert[]> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return [];
  }
  const db = await getDb();
  return db
    .collection<PortfolioAlert>(collections.portfolioAlerts)
    .find(
      withTenantScope(
        { ...userIdQuery(ctx.userId), portfolioId: ctx.portfolioOid },
        ctx.tenantId
      )
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
}

export async function adminCreatePortfolioAlert(input: {
  portfolioId: string;
  title: string;
  body?: string;
  severity: PortfolioAlert["severity"];
  status?: PortfolioAlert["status"];
  symbol?: string;
  /** Hex; must belong to this portfolio. Resolved to `accountName` snapshot. */
  accountId?: string;
  /**
   * When there is no custodian account (e.g. watchlist-only scan row), UI can show this label.
   * Options scanner passes `watchlist` | `position`.
   */
  accountContext?: "watchlist" | "position";
  /** Validated v1 scanner payload; invalid shapes are dropped. */
  metadata?: PortfolioAlert["metadata"];
}): Promise<PortfolioAlert | null> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(input.portfolioId);
  if (!ctx) {
    return null;
  }
  let accountOid: ObjectId | undefined;
  let accountName: string | undefined;
  const accHex = input.accountId?.trim();
  if (accHex && ObjectId.isValid(accHex)) {
    const acct = await getPortfolioAccountByIdForSessionUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      accountId: accHex
    });
    if (acct?._id && acct.portfolioId.equals(ctx.portfolioOid)) {
      accountOid = acct._id;
      const n = acct.name?.trim();
      accountName = n ? n.slice(0, 120) : undefined;
    }
  } else if (input.accountContext === "watchlist") {
    accountName = "Watchlist";
  }

  const now = new Date();
  const doc: PortfolioAlert = {
    tenantId: toTenantObjectId(ctx.tenantId),
    userId: ctx.userId,
    portfolioId: ctx.portfolioOid,
    portfolioName: ctx.portfolioName,
    accountId: accountOid,
    accountName,
    title: input.title.trim().slice(0, 200),
    body: input.body?.trim() ? input.body.trim().slice(0, 4000) : undefined,
    severity: input.severity,
    status: input.status ?? "active",
    symbol: input.symbol?.trim()
      ? input.symbol.trim().toUpperCase().slice(0, 32)
      : undefined,
    createdAt: now,
    updatedAt: now
  };
  if (input.metadata !== undefined) {
    const parsed = portfolioAlertScannerMetadataV1Schema.safeParse(input.metadata);
    if (parsed.success) {
      doc.metadata = parsed.data;
    }
  }
  const db = await getDb();
  const res = await db.collection<PortfolioAlert>(collections.portfolioAlerts).insertOne(doc);
  return db.collection<PortfolioAlert>(collections.portfolioAlerts).findOne({ _id: res.insertedId });
}

/**
 * Returns true if an alert already exists for this portfolio + symbol at or after `since`.
 * Used by price-alert cooldown dedupe (`watchlist_price_scanner`).
 */
export async function adminHasRecentPriceAlertForSymbol(
  portfolioId: string,
  symbol: string,
  since: Date
): Promise<boolean> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return false;
  }
  const sym = symbol.trim().toUpperCase().slice(0, 32);
  if (!sym) {
    return false;
  }
  const db = await getDb();
  const row = await db.collection<PortfolioAlert>(collections.portfolioAlerts).findOne(
    withTenantScope(
      {
        ...userIdQuery(ctx.userId),
        portfolioId: ctx.portfolioOid,
        symbol: sym,
        createdAt: { $gte: since }
      },
      ctx.tenantId
    ),
    { projection: { _id: 1 } }
  );
  return row !== null;
}

export async function adminUpdatePortfolioAlert(input: {
  portfolioId: string;
  alertId: string;
  patch: Partial<Pick<PortfolioAlert, "title" | "body" | "severity" | "status" | "symbol">>;
}): Promise<PortfolioAlert | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.alertId)) {
    return null;
  }
  const ctx = await portfolioScopedWriteContext(input.portfolioId);
  if (!ctx) {
    return null;
  }
  const db = await getDb();
  const filter = strictWriteTenantFilter(
    {
      _id: new ObjectId(input.alertId),
      ...userIdQuery(ctx.userId),
      portfolioId: ctx.portfolioOid
    },
    ctx.tenantId
  );
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  const $unset: Record<string, string> = {};
  if (input.patch.title !== undefined) {
    $set.title = input.patch.title.trim().slice(0, 200);
  }
  if (input.patch.body !== undefined) {
    $set.body = input.patch.body?.trim() ? input.patch.body.trim().slice(0, 4000) : undefined;
  }
  if (input.patch.severity !== undefined) {
    $set.severity = input.patch.severity;
  }
  if (input.patch.status !== undefined) {
    $set.status = input.patch.status;
  }
  if (input.patch.symbol !== undefined) {
    const s = input.patch.symbol.trim();
    if (s.length > 0) {
      $set.symbol = s.toUpperCase().slice(0, 32);
    } else {
      $unset.symbol = "";
    }
  }
  const update: Record<string, unknown> = { $set };
  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }
  await db.collection<PortfolioAlert>(collections.portfolioAlerts).updateOne(filter, update);
  const row = await db.collection<PortfolioAlert>(collections.portfolioAlerts).findOne(
    withTenantScope(
      { _id: new ObjectId(input.alertId), ...userIdQuery(ctx.userId), portfolioId: ctx.portfolioOid },
      ctx.tenantId
    )
  );
  return row;
}

export async function adminDeletePortfolioAlert(portfolioId: string, alertId: string): Promise<boolean> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(alertId)) {
    return false;
  }
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection<PortfolioAlert>(collections.portfolioAlerts).deleteOne(
    strictWriteTenantFilter(
      {
        _id: new ObjectId(alertId),
        ...userIdQuery(ctx.userId),
        portfolioId: ctx.portfolioOid
      },
      ctx.tenantId
    )
  );
  return (res.deletedCount ?? 0) > 0;
}

/** App-user / admin: remove every alert for the portfolio owner row (tenant + user scoped). */
export async function deleteAllPortfolioAlertsForPortfolio(portfolioId: string): Promise<number> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return 0;
  }
  const db = await getDb();
  const res = await db.collection<PortfolioAlert>(collections.portfolioAlerts).deleteMany(
    strictWriteTenantFilter(
      {
        ...userIdQuery(ctx.userId),
        portfolioId: ctx.portfolioOid
      },
      ctx.tenantId
    )
  );
  return res.deletedCount ?? 0;
}

export async function adminListPortfolioDeliveryChannels(portfolioId: string): Promise<PortfolioDeliveryChannel[]> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return [];
  }
  const db = await getDb();
  return db
    .collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels)
    .find(
      withTenantScope(
        { ...userIdQuery(ctx.userId), portfolioId: ctx.portfolioOid },
        ctx.tenantId
      )
    )
    .sort({ label: 1 })
    .limit(100)
    .toArray();
}

export async function adminCreatePortfolioDeliveryChannel(input: {
  portfolioId: string;
  kind: PortfolioDeliveryChannel["kind"];
  label: string;
  destination: string;
  enabled?: boolean;
}): Promise<PortfolioDeliveryChannel | null> {
  await ensurePortfolioIndexes();
  const ctx = await portfolioScopedWriteContext(input.portfolioId);
  if (!ctx) {
    return null;
  }
  const now = new Date();
  const doc: PortfolioDeliveryChannel = {
    tenantId: toTenantObjectId(ctx.tenantId),
    userId: ctx.userId,
    portfolioId: ctx.portfolioOid,
    kind: input.kind,
    label: input.label.trim().slice(0, 128),
    destination: input.destination.trim().slice(0, 2048),
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now
  };
  if (!doc.label || !doc.destination) {
    return null;
  }
  const db = await getDb();
  const res = await db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).insertOne(doc);
  return db
    .collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels)
    .findOne({ _id: res.insertedId });
}

export async function adminUpdatePortfolioDeliveryChannel(input: {
  portfolioId: string;
  channelId: string;
  patch: Partial<Pick<PortfolioDeliveryChannel, "kind" | "label" | "destination" | "enabled">>;
}): Promise<PortfolioDeliveryChannel | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.channelId)) {
    return null;
  }
  const ctx = await portfolioScopedWriteContext(input.portfolioId);
  if (!ctx) {
    return null;
  }
  const db = await getDb();
  const filter = strictWriteTenantFilter(
    {
      _id: new ObjectId(input.channelId),
      ...userIdQuery(ctx.userId),
      portfolioId: ctx.portfolioOid
    },
    ctx.tenantId
  );
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (input.patch.kind !== undefined) {
    $set.kind = input.patch.kind;
  }
  if (input.patch.label !== undefined) {
    $set.label = input.patch.label.trim().slice(0, 128);
  }
  if (input.patch.destination !== undefined) {
    $set.destination = input.patch.destination.trim().slice(0, 2048);
  }
  if (input.patch.enabled !== undefined) {
    $set.enabled = input.patch.enabled;
  }
  await db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).updateOne(filter, { $set });
  return db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).findOne(
    withTenantScope(
      {
        _id: new ObjectId(input.channelId),
        ...userIdQuery(ctx.userId),
        portfolioId: ctx.portfolioOid
      },
      ctx.tenantId
    )
  );
}

export async function adminDeletePortfolioDeliveryChannel(portfolioId: string, channelId: string): Promise<boolean> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(channelId)) {
    return false;
  }
  const ctx = await portfolioScopedWriteContext(portfolioId);
  if (!ctx) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).deleteOne(
    strictWriteTenantFilter(
      {
        _id: new ObjectId(channelId),
        ...userIdQuery(ctx.userId),
        portfolioId: ctx.portfolioOid
      },
      ctx.tenantId
    )
  );
  return (res.deletedCount ?? 0) > 0;
}

async function ensureBrokerCatalogIndexes(): Promise<void> {
  if (!ensureBrokerCatalogIndexesPromise) {
    ensureBrokerCatalogIndexesPromise = (async () => {
      const db = await getDb();
      await db.collection<BrokerCatalogEntry>(collections.brokerCatalog).createIndex(
        { type: 1 },
        { name: "idx_admin_broker_catalog_type", unique: true }
      );
    })();
  }
  await ensureBrokerCatalogIndexesPromise;
}

async function seedBrokerCatalogIfEmpty(): Promise<void> {
  await ensureBrokerCatalogIndexes();
  const db = await getDb();
  const col = db.collection<BrokerCatalogEntry>(collections.brokerCatalog);
  const n = await col.countDocuments();
  if (n > 0) {
    return;
  }
  const now = new Date();
  await col.insertMany([
    {
      type: "merrill",
      name: "Merrill Edge",
      description:
        "Bank of America Merrill Edge — typical CSV exports for positions and activity (admin + broker import defaults).",
      iconUrl: "/brokers/merrill-edge.png",
      createdAt: now,
      updatedAt: now
    },
    {
      type: "fidelity",
      name: "Fidelity",
      description: "Fidelity Investments — common retail brokerage CSV layouts for holdings.",
      iconUrl: "/brokers/fidelity.png",
      createdAt: now,
      updatedAt: now
    },
    {
      type: "etrade",
      name: "E*TRADE",
      description: "E*TRADE from Morgan Stanley — CSV holdings and history exports.",
      iconUrl: "/brokers/etrade.png",
      createdAt: now,
      updatedAt: now
    },
    {
      type: "ibkr",
      name: "Interactive Brokers (IBKR)",
      description: "Interactive Brokers (IBKR) — multi-asset brokerage accounts and global trading.",
      iconUrl: "/brokers/ibkr.png",
      createdAt: now,
      updatedAt: now
    }
  ]);
}

/** Ensures indexes and default Merrill / Fidelity / E*TRADE / IBKR rows when the catalog is empty. */
export async function adminEnsureBrokerCatalogReady(): Promise<void> {
  await seedBrokerCatalogIfEmpty();
}

export async function adminListBrokerCatalog(): Promise<BrokerCatalogEntry[]> {
  await adminEnsureBrokerCatalogReady();
  const db = await getDb();
  return db.collection<BrokerCatalogEntry>(collections.brokerCatalog).find({}).sort({ type: 1 }).toArray();
}

export async function adminBrokerCatalogHasType(typeSlug: string): Promise<boolean> {
  await adminEnsureBrokerCatalogReady();
  const s = typeSlug.trim().toLowerCase();
  if (!BROKER_CATALOG_TYPE_RE.test(s)) {
    return false;
  }
  const db = await getDb();
  const hit = await db.collection<BrokerCatalogEntry>(collections.brokerCatalog).findOne({ type: s });
  return Boolean(hit);
}

export async function adminCreateBrokerCatalogEntry(input: {
  type: string;
  name: string;
  description?: string;
  iconUrl?: string;
}): Promise<BrokerCatalogEntry | null> {
  await adminEnsureBrokerCatalogReady();
  const type = input.type.trim().toLowerCase();
  if (!BROKER_CATALOG_TYPE_RE.test(type)) {
    return null;
  }
  const name = input.name.trim().slice(0, 128);
  if (!name) {
    return null;
  }
  const description = input.description?.trim() ? input.description.trim().slice(0, 2000) : undefined;
  const iconUrl = input.iconUrl?.trim() ? input.iconUrl.trim().slice(0, 2048) : undefined;
  const now = new Date();
  const doc: BrokerCatalogEntry = {
    type,
    name,
    ...(description ? { description } : {}),
    ...(iconUrl ? { iconUrl } : {}),
    createdAt: now,
    updatedAt: now
  };
  const db = await getDb();
  try {
    const res = await db.collection<BrokerCatalogEntry>(collections.brokerCatalog).insertOne(doc);
    return db.collection<BrokerCatalogEntry>(collections.brokerCatalog).findOne({ _id: res.insertedId });
  } catch {
    return null;
  }
}

export async function adminUpdateBrokerCatalogEntry(input: {
  id: string;
  patch: Partial<Pick<BrokerCatalogEntry, "name" | "description" | "iconUrl">>;
}): Promise<BrokerCatalogEntry | null> {
  await adminEnsureBrokerCatalogReady();
  if (!ObjectId.isValid(input.id)) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (input.patch.name !== undefined) {
    const n = input.patch.name.trim().slice(0, 128);
    if (!n) {
      return null;
    }
    $set.name = n;
  }
  if (input.patch.description !== undefined) {
    $set.description = input.patch.description?.trim() ? input.patch.description.trim().slice(0, 2000) : undefined;
  }
  if (input.patch.iconUrl !== undefined) {
    $set.iconUrl = input.patch.iconUrl?.trim() ? input.patch.iconUrl.trim().slice(0, 2048) : undefined;
  }
  if (Object.keys($set).length <= 1) {
    return db.collection<BrokerCatalogEntry>(collections.brokerCatalog).findOne({ _id: new ObjectId(input.id) });
  }
  const res = await db.collection<BrokerCatalogEntry>(collections.brokerCatalog).updateOne(
    { _id: new ObjectId(input.id) },
    { $set }
  );
  if ((res.matchedCount ?? 0) < 1) {
    return null;
  }
  return db.collection<BrokerCatalogEntry>(collections.brokerCatalog).findOne({ _id: new ObjectId(input.id) });
}

export async function adminDeleteBrokerCatalogEntry(id: string): Promise<boolean> {
  await adminEnsureBrokerCatalogReady();
  if (!ObjectId.isValid(id)) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection<BrokerCatalogEntry>(collections.brokerCatalog).deleteOne({ _id: new ObjectId(id) });
  return (res.deletedCount ?? 0) > 0;
}

async function ensureOptionsStrategyPreferenceIndexes(): Promise<void> {
  if (!ensureOptionsStrategyPreferenceIndexesPromise) {
    ensureOptionsStrategyPreferenceIndexesPromise = (async () => {
      const db = await getDb();
      await db.collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences).createIndex(
        { slug: 1 },
        { name: "uniq_options_strategy_preferences_slug", unique: true }
      );
    })();
  }
  await ensureOptionsStrategyPreferenceIndexesPromise;
}

export async function adminListOptionsStrategyPreferenceSummaries(): Promise<OptionsStrategyPreferenceSummary[]> {
  await ensureOptionsStrategyPreferenceIndexes();
  const db = await getDb();
  const rows = await db
    .collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences)
    .find(
      {},
      { projection: { slug: 1, name: 1, sourceRelPath: 1, createdAt: 1, updatedAt: 1 } }
    )
    .sort({ slug: 1 })
    .toArray();
  return rows as OptionsStrategyPreferenceSummary[];
}

export async function adminGetOptionsStrategyPreferenceById(id: string): Promise<OptionsStrategyPreference | null> {
  await ensureOptionsStrategyPreferenceIndexes();
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences)
    .findOne({ _id: new ObjectId(id) });
}

export async function adminUpdateOptionsStrategyPreference(input: {
  id: string;
  patch: Partial<Pick<OptionsStrategyPreference, "name" | "description">>;
}): Promise<OptionsStrategyPreference | null> {
  await ensureOptionsStrategyPreferenceIndexes();
  if (!ObjectId.isValid(input.id)) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (input.patch.name !== undefined) {
    const n = input.patch.name.trim().slice(0, 128);
    if (!n) {
      return null;
    }
    $set.name = n;
  }
  if (input.patch.description !== undefined) {
    const d = input.patch.description;
    if (d.length > OPTIONS_STRATEGY_DESCRIPTION_MAX_LEN) {
      return null;
    }
    $set.description = d;
  }
  if (Object.keys($set).length <= 1) {
    return db
      .collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences)
      .findOne({ _id: new ObjectId(input.id) });
  }
  const res = await db.collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences).updateOne(
    { _id: new ObjectId(input.id) },
    { $set }
  );
  if ((res.matchedCount ?? 0) < 1) {
    return null;
  }
  return db
    .collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences)
    .findOne({ _id: new ObjectId(input.id) });
}

async function ensureOptionsStrategyIndexes(): Promise<void> {
  if (!ensureOptionsStrategyIndexesPromise) {
    ensureOptionsStrategyIndexesPromise = (async () => {
      const db = await getDb();
      await db.collection<OptionsStrategy>(collections.optionsStrategy).createIndex(
        { slug: 1 },
        { name: "uniq_options_strategy_slug", unique: true }
      );
    })();
  }
  await ensureOptionsStrategyIndexesPromise;
}

export async function adminListOptionsStrategySummaries(): Promise<OptionsStrategySummary[]> {
  await ensureOptionsStrategyIndexes();
  const db = await getDb();
  const rows = await db
    .collection<OptionsStrategy>(collections.optionsStrategy)
    .find({}, { projection: { slug: 1, name: 1, sourceRelPath: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ slug: 1 })
    .toArray();
  return rows as OptionsStrategySummary[];
}

/** Slug + `filters` only — for scheduled options scanner prefs merge (`PLAN` 270n). */
export async function adminListOptionsStrategyFilterRows(): Promise<
  { slug: string; filters: Record<string, unknown> | null | undefined }[]
> {
  await ensureOptionsStrategyIndexes();
  const db = await getDb();
  const rows = await db
    .collection<OptionsStrategy>(collections.optionsStrategy)
    .find({}, { projection: { slug: 1, filters: 1 } })
    .sort({ slug: 1 })
    .toArray();
  return rows.map((r) => ({
    slug: r.slug,
    filters: r.filters ?? null
  }));
}

export async function adminGetOptionsStrategyById(id: string): Promise<OptionsStrategy | null> {
  await ensureOptionsStrategyIndexes();
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection<OptionsStrategy>(collections.optionsStrategy).findOne({ _id: new ObjectId(id) });
}

export async function adminCreateOptionsStrategy(input: {
  slug: string;
  name: string;
  description: string;
  filters?: Record<string, unknown> | null;
  sourceRelPath?: string;
}): Promise<OptionsStrategy | null> {
  await ensureOptionsStrategyIndexes();
  const db = await getDb();
  const now = new Date();
  const doc: OptionsStrategy = {
    slug: input.slug.trim().toLowerCase(),
    name: input.name.trim().slice(0, 128),
    description: input.description.slice(0, OPTIONS_STRATEGY_DESCRIPTION_MAX_LEN),
    filters: input.filters ?? null,
    sourceRelPath: input.sourceRelPath,
    createdAt: now,
    updatedAt: now
  };
  if (!doc.slug || !doc.name) return null;
  try {
    const res = await db.collection<OptionsStrategy>(collections.optionsStrategy).insertOne(doc);
    return { ...doc, _id: res.insertedId };
  } catch {
    return null;
  }
}

export async function adminUpdateOptionsStrategy(input: {
  id: string;
  patch: Partial<Pick<OptionsStrategy, "name" | "description" | "filters" | "sourceRelPath">>;
}): Promise<OptionsStrategy | null> {
  await ensureOptionsStrategyIndexes();
  if (!ObjectId.isValid(input.id)) return null;
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (input.patch.name !== undefined) {
    const n = String(input.patch.name).trim().slice(0, 128);
    if (!n) return null;
    $set.name = n;
  }
  if (input.patch.description !== undefined) {
    const d = String(input.patch.description);
    if (d.length > OPTIONS_STRATEGY_DESCRIPTION_MAX_LEN) return null;
    $set.description = d;
  }
  if (input.patch.filters !== undefined) {
    $set.filters = input.patch.filters ?? null;
  }
  if (input.patch.sourceRelPath !== undefined) {
    $set.sourceRelPath = input.patch.sourceRelPath ?? undefined;
  }
  if (Object.keys($set).length <= 1) {
    return db.collection<OptionsStrategy>(collections.optionsStrategy).findOne({ _id: new ObjectId(input.id) });
  }
  const res = await db
    .collection<OptionsStrategy>(collections.optionsStrategy)
    .updateOne({ _id: new ObjectId(input.id) }, { $set });
  if ((res.matchedCount ?? 0) < 1) return null;
  return db.collection<OptionsStrategy>(collections.optionsStrategy).findOne({ _id: new ObjectId(input.id) });
}

export async function adminDeleteOptionsStrategy(id: string): Promise<boolean> {
  await ensureOptionsStrategyIndexes();
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const res = await db.collection<OptionsStrategy>(collections.optionsStrategy).deleteOne({ _id: new ObjectId(id) });
  return (res.deletedCount ?? 0) > 0;
}

/**
 * Hex + `ObjectId` variants for `userId: { $in: … }` so BSON matches both storage shapes.
 */
export async function collectTenantMemberUserIdQueryAtoms(tenantId: ObjectId): Promise<(string | ObjectId)[]> {
  const db = await getDb();
  const memberships = await db
    .collection<{ userId: unknown }>("core_tenant_memberships")
    .find({ tenantId })
    .project({ userId: 1 })
    .toArray();

  const hexSet = new Set<string>();
  for (const m of memberships) {
    const u = m.userId;
    if (u instanceof ObjectId) {
      hexSet.add(u.toHexString());
    } else if (typeof u === "string" && u.trim()) {
      hexSet.add(u.trim());
    }
  }

  const userIdIn: (string | ObjectId)[] = [];
  for (const hex of hexSet) {
    userIdIn.push(hex);
    if (ObjectId.isValid(hex)) {
      userIdIn.push(new ObjectId(hex));
    }
  }
  return userIdIn;
}

/**
 * Desk collections (`portfolio_positions`, `portfolio_watchlists`, …): strict `tenantId` **or** legacy
 * `tenantId: null` rows for users who are members of that tenant — same idea as {@link userWatchlistSessionScopeFilter}.
 */
export function mongoPortfolioDeskFamilyTenantFilter(
  tenantId: ObjectId,
  memberUserIdAtoms: readonly (string | ObjectId)[]
): Record<string, unknown> {
  const legacyBranch =
    memberUserIdAtoms.length > 0
      ? {
          $and: [
            { userId: { $in: [...memberUserIdAtoms] } },
            /** Matches BSON null and documents where `tenantId` is absent. */
            { tenantId: null }
          ]
        }
      : null;

  return legacyBranch != null ? { $or: [{ tenantId }, legacyBranch] } : { tenantId };
}

/**
 * Watchlists for tenant-scoped jobs (`watchlist_price_scanner`, etc.).
 * When `tenantId` is set: documents with that `tenantId` **or** legacy rows (null/missing `tenantId`) whose
 * `userId` is a member of the tenant — mirrors {@link userWatchlistSessionScopeFilter} so batch jobs update
 * the same docs the app-user API can read.
 * Omit `tenantId` only for degenerate / test runs (full collection read).
 */
export async function listWatchlistsForTenantScope(tenantId?: ObjectId): Promise<Watchlist[]> {
  const db = await getDb();
  const col = db.collection<Watchlist>(collections.watchlists);
  if (!tenantId) {
    return col.find({}).toArray();
  }

  const userIdIn = await collectTenantMemberUserIdQueryAtoms(tenantId);
  const filter = mongoPortfolioDeskFamilyTenantFilter(tenantId, userIdIn);
  return col.find(filter as Filter<Watchlist>).toArray();
}

function watchlistSymbolMergeKey(symbol: string): string {
  return String(symbol).trim().toUpperCase();
}

function mergedWatchlistSymbolField(
  row: unknown,
  base: Record<string, unknown>,
  normalizedKey: string
): string {
  if (typeof row === "string") {
    return normalizedKey;
  }
  const b = base.symbol;
  if (typeof b === "string" && b.trim()) {
    return b.trim();
  }
  return normalizedKey;
}

/**
 * Merges price (and optional rationale / rowStatus) into `portfolio_watchlists.symbols`.
 *
 * **Symbol mode** (default): match by normalized ticker on every row — same as Yahoo uppercase vs stored
 * lowercase. If the array has duplicate tickers, each matching row receives the **same** payload (last update
 * wins in the keyed map).
 *
 * **Row-index mode**: when **every** entry includes `symbolRowIndex`, patch only that position after
 * verifying normalized `symbol` matches the row (duplicate tickers get independent desk rows).
 *
 * Uses read-modify-write (avoids positional `arrayFilters` exact-match pitfalls).
 *
 * @returns Count of symbol **rows** in the array that were patched.
 */
export async function updateWatchlistSymbolPrices(
  watchlistId: ObjectId,
  priceUpdates: Array<{
    symbol: string;
    /** Omit to leave prior row prices unchanged (e.g. Yahoo miss — still merge rationale / rowStatus). */
    lastPrice?: number;
    lastUpdatedAt?: Date;
    rationale?: string;
    rowStatus?: WatchlistRowStatus;
    /** When present on all updates, targets `symbols[symbolRowIndex]` only. */
    symbolRowIndex?: number;
  }>
): Promise<number> {
  if (priceUpdates.length === 0) {
    return 0;
  }

  const db = await getDb();
  const col = db.collection<Watchlist>(collections.watchlists);
  const doc = await col.findOne({ _id: watchlistId });
  if (!doc?.symbols || !Array.isArray(doc.symbols) || doc.symbols.length === 0) {
    return 0;
  }

  const indexMode = priceUpdates.every((u) => typeof u.symbolRowIndex === "number");

  let patched = 0;
  /** Assigned on every path before `updateOne` (index merge, index→symbol fallback, or symbol-only merge). */
  let nextSymbols!: WatchlistSymbol[];

  const mergeNow = new Date();

  const applySymbolKeyMerge = (symbols: typeof doc.symbols): void => {
    const byKey = new Map<string, (typeof priceUpdates)[0]>();
    for (const u of priceUpdates) {
      byKey.set(watchlistSymbolMergeKey(u.symbol), u);
    }
    patched = 0;
    nextSymbols = symbols.map((row): WatchlistSymbol => {
      const rowSym = symbolFromRawWatchlistEntry(row);
      if (!rowSym) {
        return row as WatchlistSymbol;
      }
      const u = byKey.get(watchlistSymbolMergeKey(rowSym));
      if (!u) {
        return row as WatchlistSymbol;
      }
      patched += 1;
      const base = mergeBaseFromRawWatchlistEntry(row, mergeNow);
      return {
        ...base,
        symbol: mergedWatchlistSymbolField(row, base, rowSym),
        ...(u.lastPrice !== undefined ? { lastPrice: u.lastPrice } : {}),
        ...(u.lastUpdatedAt !== undefined ? { lastUpdatedAt: u.lastUpdatedAt } : {}),
        ...(u.rationale !== undefined ? { rationale: u.rationale } : {}),
        ...(u.rowStatus !== undefined ? { rowStatus: u.rowStatus } : {})
      } as WatchlistSymbol;
    });
  };

  if (indexMode) {
    const byIdx = new Map<number, (typeof priceUpdates)[0]>();
    for (const u of priceUpdates) {
      byIdx.set(u.symbolRowIndex!, u);
    }
    nextSymbols = doc.symbols.map((row, idx): WatchlistSymbol => {
      const u = byIdx.get(idx);
      if (!u) {
        return row as WatchlistSymbol;
      }
      const rowSym = symbolFromRawWatchlistEntry(row);
      if (!rowSym || watchlistSymbolMergeKey(rowSym) !== watchlistSymbolMergeKey(u.symbol)) {
        return row as WatchlistSymbol;
      }
      patched += 1;
      const base = mergeBaseFromRawWatchlistEntry(row, mergeNow);
      return {
        ...base,
        symbol: mergedWatchlistSymbolField(row, base, rowSym),
        ...(u.lastPrice !== undefined ? { lastPrice: u.lastPrice } : {}),
        ...(u.lastUpdatedAt !== undefined ? { lastUpdatedAt: u.lastUpdatedAt } : {}),
        ...(u.rationale !== undefined ? { rationale: u.rationale } : {}),
        ...(u.rowStatus !== undefined ? { rowStatus: u.rowStatus } : {})
      } as WatchlistSymbol;
    });
    /**
     * `watchlist_price_scanner` builds updates with `symbolRowIndex` from an in-memory snapshot. If the array
     * order changed before this read-modify-write (concurrent PATCH/import) every index check fails → `patched=0`
     * and **no** Mongo write (no rationale / `rowStatus`). Fall back to symbol-key merge so the scan still lands.
     * Duplicate tickers in one list may share the last payload for that symbol (acceptable vs silent no-op).
     */
    if (patched === 0) {
      console.warn(
        "[watchlist/repository] updateWatchlistSymbolPrices: index merge patched 0 rows; retrying symbol-key merge",
        { watchlistId: watchlistId.toHexString(), updateCount: priceUpdates.length }
      );
      applySymbolKeyMerge(doc.symbols);
    }
  } else {
    applySymbolKeyMerge(doc.symbols);
  }

  if (patched === 0) {
    return 0;
  }

  const tickTimes = priceUpdates
    .map((u) => u.lastUpdatedAt?.getTime())
    .filter((t): t is number => typeof t === "number" && !Number.isNaN(t));
  const latestMs = tickTimes.length > 0 ? Math.max(...tickTimes) : Date.now();
  await col.updateOne(
    { _id: watchlistId },
    { $set: { symbols: nextSymbols, updatedAt: new Date(latestMs) } }
  );
  return patched;
}

/** Canonical watchlist for the user (tenant-scoped); one document per user after migration. */
export async function getUserWatchlist(input: {
  userId: string;
  tenantId?: string;
}): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const doc = await findLatestWatchlistMatchingFilter(
    db,
    userWatchlistSessionScopeFilter(input.userId, input.tenantId, "allowLegacyUserScope")
  );
  if (!doc) {
    return null;
  }
  const symbols = normalizeWatchlistDocumentSymbols(doc.symbols, [DEFAULT_WATCHLIST_SYMBOL]);
  return { ...doc, symbols };
}

/** Ensures a user-global watchlist exists (via default portfolio provision when needed). */
export async function ensureUserWatchlistForSessionUser(input: {
  userId: string;
  tenantId?: string;
}): Promise<Watchlist | null> {
  const existing = await getUserWatchlist(input);
  if (existing) {
    return existing;
  }
  try {
    await provisionDefaultPortfolioForUser({
      userId: input.userId,
      tenantId: input.tenantId,
      watchlistSymbols: ["TSLA"]
    });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[watchlist] ensureUserWatchlistForSessionUser provision failed userId=${input.userId} detail=${detail}`
    );
    return null;
  }
  return getUserWatchlist(input);
}

/**
 * When the session user owns `portfolioId`, returns the same document as {@link getUserWatchlist}
 * (compatibility shim for portfolio-scoped URLs).
 */
export async function getPortfolioWatchlist(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  const owned = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!owned?._id) {
    return null;
  }
  return getUserWatchlist({ userId: input.userId, tenantId: input.tenantId });
}

/**
 * Idempotent: returns existing watchlist or runs the same provision path as PATCH `/api/portfolios/.../watchlist`
 * so tool + API callers never see a missing doc after portfolio exists.
 */
export async function ensurePortfolioWatchlistForUser(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<Watchlist | null> {
  const existing = await getPortfolioWatchlist(input);
  if (existing) {
    return existing;
  }
  const portfolio = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!portfolio?._id) {
    return null;
  }
  try {
    await provisionDefaultPortfolioForUser({
      userId: input.userId,
      tenantId: input.tenantId,
      watchlistSymbols: ["TSLA"]
    });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[watchlist] ensurePortfolioWatchlistForUser provision failed userId=${input.userId} portfolioId=${input.portfolioId} detail=${detail}`
    );
    return null;
  }
  return getPortfolioWatchlist(input);
}

export type MutatePortfolioWatchlistInput = {
  userId: string;
  portfolioId: string;
  tenantId?: string;
  /** When set, updates the watchlist display name (trimmed, non-empty). */
  name?: string;
  addSymbols?: string[];
  /** Merge metadata on existing symbols or append new rows (CSV import). */
  addEntries?: WatchlistSymbolImportEntry[];
  removeSymbols?: string[];
  dedupe?: boolean;
  /** Clears field in Mongo when `null`. */
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  /** Clears field in Mongo when `null`. */
  outlook?: AccountOutlook | null;
};

export type MutateUserWatchlistInput = Omit<MutatePortfolioWatchlistInput, "portfolioId">;

function mergeImportEntryIntoSymbol(
  base: WatchlistSymbol,
  entry: WatchlistSymbolImportEntry
): WatchlistSymbol {
  const next: WatchlistSymbol = { ...base };
  if (entry.lineType !== undefined) {
    if (entry.lineType === null) {
      delete next.lineType;
    } else {
      const v = entry.lineType.trim();
      if (v.length === 0) {
        delete next.lineType;
      } else {
        next.lineType = v.slice(0, 128);
      }
    }
  }
  if (entry.strategy !== undefined) {
    if (entry.strategy === null) {
      delete next.strategy;
    } else {
      const v = entry.strategy.trim();
      if (v.length === 0) {
        delete next.strategy;
      } else {
        next.strategy = v.slice(0, 512);
      }
    }
  }
  if (entry.quantity !== undefined) {
    if (entry.quantity === null) {
      delete next.quantity;
    } else {
      next.quantity = Number.isFinite(entry.quantity) ? entry.quantity : undefined;
    }
  }
  if (entry.entryPrice !== undefined) {
    if (entry.entryPrice === null) {
      delete next.entryPrice;
    } else {
      next.entryPrice = Number.isFinite(entry.entryPrice) ? entry.entryPrice : undefined;
    }
  }
  if (entry.priceAlertMinAbsMovePercent !== undefined) {
    if (entry.priceAlertMinAbsMovePercent === null) {
      delete next.priceAlertMinAbsMovePercent;
    } else {
      const v = entry.priceAlertMinAbsMovePercent;
      if (!Number.isFinite(v) || v <= 0) {
        delete next.priceAlertMinAbsMovePercent;
      } else {
        next.priceAlertMinAbsMovePercent = Math.min(100, Math.max(0.1, v));
      }
    }
  }
  if (entry.rationale !== undefined) {
    if (entry.rationale === null) {
      delete next.rationale;
    } else {
      const v = entry.rationale.trim().slice(0, 4000);
      if (v.length === 0) {
        delete next.rationale;
      } else {
        next.rationale = v;
      }
    }
  }
  if (entry.rowStatus !== undefined) {
    if (entry.rowStatus === null) {
      delete next.rowStatus;
    } else if (entry.rowStatus === "draft" || entry.rowStatus === "active" || entry.rowStatus === "review") {
      next.rowStatus = entry.rowStatus;
    }
  }
  return next;
}

export async function mutateUserWatchlistSymbols(input: MutateUserWatchlistInput): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  const trimmedName =
    input.name === undefined ? undefined : input.name.trim().slice(0, 128);
  const hasNameUpdate = trimmedName !== undefined && trimmedName.length > 0;
  const hasMutation =
    hasNameUpdate ||
    Boolean(input.addSymbols?.length) ||
    Boolean(input.addEntries?.length) ||
    Boolean(input.removeSymbols?.length) ||
    Boolean(input.dedupe) ||
    input.riskProfile !== undefined ||
    input.outlook !== undefined;
  if (!hasMutation) {
    return getUserWatchlist({ userId: input.userId, tenantId: input.tenantId });
  }

  const db = await getDb();
  const filter = userWatchlistSessionScopeFilter(input.userId, input.tenantId, "allowLegacyUserScope");
  const doc = await findLatestWatchlistMatchingFilter(db, filter);
  if (!doc?._id) {
    return null;
  }

  const now = new Date();
  let symbols = normalizeWatchlistDocumentSymbols(doc.symbols, []);

  if (input.dedupe) {
    const seen = new Map<string, WatchlistSymbol>();
    for (const s of symbols) {
      if (!seen.has(s.symbol)) {
        seen.set(s.symbol, s);
      }
    }
    symbols = Array.from(seen.values());
  }

  if (input.removeSymbols?.length) {
    const removeSet = new Set(
      input.removeSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)
    );
    symbols = symbols.filter((s) => !removeSet.has(s.symbol));
  }

  if (input.addSymbols?.length) {
    const existing = new Set(symbols.map((s) => s.symbol));
    for (const raw of input.addSymbols) {
      const symbol = raw.trim().toUpperCase();
      if (!symbol || !/^[A-Z0-9.\-]{1,32}$/.test(symbol)) {
        continue;
      }
      if (existing.has(symbol)) {
        continue;
      }
      if (symbols.length >= MAX_WATCHLIST_SYMBOLS) {
        break;
      }
      symbols.push({ symbol, addedAt: now });
      existing.add(symbol);
    }
  }

  if (input.addEntries?.length) {
    for (const entry of input.addEntries) {
      const symbol = entry.symbol.trim().toUpperCase();
      if (!symbol || !/^[A-Z0-9.\-]{1,32}$/.test(symbol)) {
        continue;
      }
      const idx = symbols.findIndex((s) => s.symbol === symbol);
      if (idx >= 0) {
        symbols[idx] = mergeImportEntryIntoSymbol(symbols[idx]!, entry);
        continue;
      }
      if (symbols.length >= MAX_WATCHLIST_SYMBOLS) {
        break;
      }
      symbols.push(mergeImportEntryIntoSymbol({ symbol, addedAt: now }, entry));
    }
  }

  if (symbols.length === 0) {
    symbols = [{ symbol: DEFAULT_WATCHLIST_SYMBOL, addedAt: now }];
  }

  const setDoc: Record<string, unknown> = { symbols, updatedAt: now };
  if (hasNameUpdate && trimmedName !== undefined) {
    setDoc.name = trimmedName;
  }
  const unsetDoc: Record<string, string> = {};
  if (input.riskProfile !== undefined) {
    if (input.riskProfile === null) {
      unsetDoc.riskProfile = "";
    } else {
      setDoc.riskProfile = input.riskProfile;
    }
  }
  if (input.outlook !== undefined) {
    if (input.outlook === null) {
      unsetDoc.outlook = "";
    } else {
      const slug = parseAccountOutlook(input.outlook);
      if (slug) {
        setDoc.outlook = slug;
      }
    }
  }

  const update: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length > 0) {
    update.$unset = unsetDoc;
  }

  await db.collection<Watchlist>(collections.watchlists).updateOne({ _id: doc._id }, update);

  await bumpWorkspaceContentRevForAllUserPortfolios({
    userId: input.userId,
    tenantId: input.tenantId
  });

  return getUserWatchlist({ userId: input.userId, tenantId: input.tenantId });
}

export async function mutatePortfolioWatchlistSymbols(
  input: MutatePortfolioWatchlistInput
): Promise<Watchlist | null> {
  if (!ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  const owned = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!owned?._id) {
    return null;
  }
  return mutateUserWatchlistSymbols({
    userId: input.userId,
    tenantId: input.tenantId,
    name: input.name,
    addSymbols: input.addSymbols,
    addEntries: input.addEntries,
    removeSymbols: input.removeSymbols,
    dedupe: input.dedupe,
    riskProfile: input.riskProfile,
    outlook: input.outlook
  });
}

/**
 * Ensures a watchlist row exists for the portfolio (upsert with default symbol) so admin PATCH can mutate.
 */
export async function adminEnsurePortfolioWatchlist(portfolioId: string): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(portfolioId)) {
    return null;
  }
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return null;
  }
  const ownerId = portfolioOwnerUserIdString(portfolio.userId);
  const tenantId = portfolioTenantIdString(portfolio);
  const existing = await getUserWatchlist({ userId: ownerId, tenantId });
  if (existing) {
    return existing;
  }
  const db = await getDb();
  const now = new Date();
  const tenantObjectId = toTenantObjectId(tenantId);
  const mergedWatchlistSymbols = normalizeWatchlistDocumentSymbols([], [DEFAULT_WATCHLIST_SYMBOL]);
  const watchlistSetFields = {
    name: DEFAULT_WATCHLIST_NAME,
    symbols: mergedWatchlistSymbols,
    isDefault: portfolio.isDefault === true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };
  const watchlistInsertFilter = strictWriteTenantFilter(
    {
      userId: ownerId
    },
    tenantId
  );
  await db.collection<Watchlist>(collections.watchlists).updateOne(
    watchlistInsertFilter,
    {
      $setOnInsert: {
        userId: ownerId,
        createdAt: now
      },
      $set: watchlistSetFields
    },
    { upsert: true }
  );
  await bumpWorkspaceContentRevForAllUserPortfolios({ userId: ownerId, tenantId });
  return getUserWatchlist({ userId: ownerId, tenantId });
}

export async function provisionDefaultPortfolioForUser(
  input: ProvisionDefaultPortfolioInput
): Promise<ProvisionDefaultPortfolioResult> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const now = new Date();
  const tenantObjectId = toTenantObjectId(input.tenantId);
  const portfolioName = input.portfolioName ?? DEFAULT_PORTFOLIO_NAME;
  const accountName = input.accountName ?? DEFAULT_ACCOUNT_NAME;
  const watchlistName = input.watchlistName ?? DEFAULT_WATCHLIST_NAME;
  const accountType: AccountType = "fidelity";
  const seedSymbolStrings =
    input.watchlistSymbols !== undefined ? input.watchlistSymbols : [DEFAULT_WATCHLIST_SYMBOL];

  if (tenantObjectId) {
    await db.collection<Portfolio>(collections.portfolios).updateMany(
      {
        ...userIdQuery(input.userId),
        isDefault: true,
        $or: [{ tenantId: { $exists: false } }, { tenantId: { $type: "null" } }]
      } as Filter<Portfolio>,
      {
        $set: {
          tenantId: tenantObjectId,
          tenantPortfolioOrgKey: getTenantPortfolioOrgKey(),
          updatedAt: now
        }
      }
    );
  }

  const portfolioLookupFilter = defaultPortfolioMarkerFilter(
    input.userId,
    input.tenantId,
    "allowLegacyUserScope"
  );
  let portfolio = await db
    .collection<Portfolio>(collections.portfolios)
    .findOne(portfolioLookupFilter);

  /** Idempotent provision runs on every OAuth login — do not clobber user-renamed titles. */
  const portfolioSetForInsert = {
    name: portfolioName,
    isDefault: true,
    tenantPortfolioOrgKey: getTenantPortfolioOrgKey(),
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };
  const portfolioSetForExisting = {
    isDefault: true,
    tenantPortfolioOrgKey: getTenantPortfolioOrgKey(),
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (portfolio?._id) {
    await db.collection<Portfolio>(collections.portfolios).updateOne(
      { _id: portfolio._id },
      { $set: portfolioSetForExisting }
    );
    const existingName = typeof portfolio.name === "string" ? portfolio.name.trim() : "";
    if (!existingName) {
      await db.collection<Portfolio>(collections.portfolios).updateOne(
        { _id: portfolio._id },
        { $set: { name: portfolioName, updatedAt: now } }
      );
    }
  } else {
    const portfolioInsertFilter = strictWriteTenantFilter(
      { userId: input.userId, isDefault: true },
      input.tenantId
    );
    await db.collection<Portfolio>(collections.portfolios).updateOne(
      portfolioInsertFilter,
      {
        // tenantId must not appear in both $set and $setOnInsert (Mongo conflict).
        $setOnInsert: {
          userId: input.userId,
          createdAt: now
        },
        $set: portfolioSetForInsert
      },
      { upsert: true }
    );
    portfolio = await db
      .collection<Portfolio>(collections.portfolios)
      .findOne(portfolioLookupFilter);
  }

  if (!portfolio?._id) {
    throw new Error("Failed to provision default portfolio");
  }

  if (typeof portfolio.userId !== "string") {
    await db.collection<Portfolio>(collections.portfolios).updateOne(
      { _id: portfolio._id },
      { $set: { userId: input.userId, updatedAt: now } }
    );
    portfolio = { ...portfolio, userId: input.userId };
  }

  if (tenantObjectId) {
    await db.collection<Account>(collections.accounts).updateMany(
      {
        ...userIdQuery(input.userId),
        portfolioId: portfolio._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: { $type: "null" } }]
      } as Filter<Account>,
      { $set: { tenantId: tenantObjectId, updatedAt: now } }
    );
    await db.collection<Watchlist>(collections.watchlists).updateMany(
      {
        ...userWatchlistSessionScopeFilter(
          input.userId,
          input.tenantId,
          "allowLegacyUserScope"
        ),
        $or: [{ tenantId: { $exists: false } }, { tenantId: { $type: "null" } }]
      } as Filter<Watchlist>,
      { $set: { tenantId: tenantObjectId, updatedAt: now } }
    );
  }

  const extAccountId = DEFAULT_ACCOUNT_REF;
  const accountLookupFilter = {
    ...userAccountsForPortfolioSessionScopeFilter(
      input.userId,
      portfolio._id.toHexString(),
      input.tenantId,
      "allowLegacyUserScope"
    ),
    isDefault: true
  };
  let account = await db.collection<Account>(collections.accounts).findOne(accountLookupFilter);

  const accountSetForInsert = {
    name: accountName,
    type: accountType,
    extAccountId,
    cashBalance: DEFAULT_ACCOUNT_CASH_BALANCE,
    riskProfile: DEFAULT_PROVISION_ACCOUNT_RISK_PROFILE,
    outlook: DEFAULT_PROVISION_ACCOUNT_OUTLOOK,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };
  const accountSetForExisting = {
    type: accountType,
    extAccountId,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (account?._id) {
    await db.collection<Account>(collections.accounts).updateOne(
      { _id: account._id },
      { $set: accountSetForExisting }
    );
    const existingAccName = typeof account.name === "string" ? account.name.trim() : "";
    if (!existingAccName) {
      await db.collection<Account>(collections.accounts).updateOne(
        { _id: account._id },
        { $set: { name: accountName, updatedAt: now } }
      );
    }
  } else {
    const accountInsertFilter = strictWriteTenantFilter(
      {
        userId: input.userId,
        portfolioId: portfolio._id,
        isDefault: true
      },
      input.tenantId
    );
    await db.collection<Account>(collections.accounts).updateOne(
      accountInsertFilter,
      {
        $setOnInsert: {
          userId: input.userId,
          portfolioId: portfolio._id,
          createdAt: now
        },
        $set: accountSetForInsert
      },
      { upsert: true }
    );
    account = await db.collection<Account>(collections.accounts).findOne(accountLookupFilter);
  }

  if (!account?._id) {
    throw new Error("Failed to provision default account");
  }

  if (typeof account.userId !== "string") {
    await db.collection<Account>(collections.accounts).updateOne(
      { _id: account._id },
      { $set: { userId: input.userId, updatedAt: now } }
    );
    account = { ...account, userId: input.userId };
  }

  const cashBackfillFilter = {
    $and: [
      userAccountsForPortfolioSessionScopeFilter(
        input.userId,
        portfolio._id.toHexString(),
        input.tenantId,
        "allowLegacyUserScope"
      ),
      {
        $or: [{ cashBalance: { $exists: false } }, { cashBalance: { $type: "null" } }]
      }
    ]
  } as Filter<Account>;
  await db.collection<Account>(collections.accounts).updateMany(cashBackfillFilter, {
    $set: {
      cashBalance: DEFAULT_ACCOUNT_CASH_BALANCE,
      updatedAt: now
    }
  });

  const defaultAccountDeskScope = {
    ...userAccountsForPortfolioSessionScopeFilter(
      input.userId,
      portfolio._id.toHexString(),
      input.tenantId
    ),
    isDefault: true
  };
  await db.collection<Account>(collections.accounts).updateMany(
    {
      $and: [
        defaultAccountDeskScope,
        {
          $or: [{ riskProfile: { $exists: false } }, { riskProfile: null }]
        }
      ]
    } as Filter<Account>,
    { $set: { riskProfile: DEFAULT_PROVISION_ACCOUNT_RISK_PROFILE, updatedAt: now } }
  );
  await db.collection<Account>(collections.accounts).updateMany(
    {
      $and: [
        defaultAccountDeskScope,
        {
          $or: [{ outlook: { $exists: false } }, { outlook: null }]
        }
      ]
    } as Filter<Account>,
    { $set: { outlook: DEFAULT_PROVISION_ACCOUNT_OUTLOOK, updatedAt: now } }
  );

  const watchlistLookupFilter = userWatchlistSessionScopeFilter(
    input.userId,
    input.tenantId,
    "allowLegacyUserScope"
  );
  const existingWatchlist = await findLatestWatchlistMatchingFilter(db, watchlistLookupFilter);
  const mergedWatchlistSymbols = normalizeWatchlistDocumentSymbols(
    existingWatchlist?.symbols ?? [],
    Array.from(
      new Set([DEFAULT_WATCHLIST_SYMBOL, ...seedSymbolStrings.map((s) => s.trim().toUpperCase())])
    ).filter(Boolean)
  );

  const watchlistSetForInsert = {
    name: watchlistName,
    symbols: mergedWatchlistSymbols,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };
  const watchlistSetForExisting = {
    symbols: mergedWatchlistSymbols,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (existingWatchlist?._id) {
    await db.collection<Watchlist>(collections.watchlists).updateOne(
      { _id: existingWatchlist._id },
      { $set: watchlistSetForExisting }
    );
    const existingWlName =
      typeof existingWatchlist.name === "string" ? existingWatchlist.name.trim() : "";
    if (!existingWlName) {
      await db.collection<Watchlist>(collections.watchlists).updateOne(
        { _id: existingWatchlist._id },
        { $set: { name: watchlistName, updatedAt: now } }
      );
    }
  } else {
    const watchlistInsertFilter = strictWriteTenantFilter(
      {
        userId: input.userId
      },
      input.tenantId
    );
    await db.collection<Watchlist>(collections.watchlists).updateOne(
      watchlistInsertFilter,
      {
        $setOnInsert: {
          userId: input.userId,
          createdAt: now
        },
        $set: watchlistSetForInsert
      },
      { upsert: true }
    );
  }

  let watchlist = await findLatestWatchlistMatchingFilter(db, watchlistLookupFilter);
  if (!watchlist?._id) {
    throw new Error("Failed to provision default watchlist");
  }

  if (typeof watchlist.userId !== "string") {
    await db.collection<Watchlist>(collections.watchlists).updateOne(
      { _id: watchlist._id },
      { $set: { userId: input.userId, updatedAt: now } }
    );
    watchlist = { ...watchlist, userId: input.userId };
  }

  return { portfolio, account, watchlist };
}

export async function upsertPositionForAccount(input: UpsertPositionInput): Promise<Position> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.accountId)) {
    throw new PositionValidationError("INVALID_IDS", "Invalid portfolioId or accountId");
  }

  const positionType = normalizePositionType(input.type);
  const rawSym = input.symbol.trim();
  const normalizedUnderlying = rawSym.toUpperCase().slice(0, 32);
  const cashLabel = (rawSym || "CASH").toUpperCase().slice(0, 32);

  if (positionType === "stock") {
    if (!normalizedUnderlying) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Stock requires a symbol");
    }
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Stock requires a positive share count");
    }
    if (!Number.isFinite(input.avgCost) || input.avgCost < 0) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Stock requires a non-negative purchase price");
    }
  } else if (positionType === "cash") {
    if (!Number.isFinite(input.avgCost) || input.avgCost < 0) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Cash requires a non-negative amount");
    }
  } else {
    if (!normalizedUnderlying) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Option requires an underlying symbol");
    }
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      throw new PositionValidationError("POSITION_FIELDS_INCOMPLETE", "Option requires a positive contract count");
    }
    if (!Number.isFinite(input.avgCost) || input.avgCost < 0) {
      throw new PositionValidationError(
        "POSITION_FIELDS_INCOMPLETE",
        "Option requires a non-negative premium per contract"
      );
    }
    const yref = input.yahooRef?.trim();
    if (!yref) {
      if (input.optionType !== "call" && input.optionType !== "put") {
        throw new PositionValidationError(
          "POSITION_FIELDS_INCOMPLETE",
          "Option requires yahooRef, or call/put + strike + expiration"
        );
      }
      const strike = input.strike;
      if (typeof strike !== "number" || !Number.isFinite(strike) || strike <= 0) {
        throw new PositionValidationError(
          "POSITION_FIELDS_INCOMPLETE",
          "Option requires a positive strike when yahooRef is omitted"
        );
      }
      const exp = input.expiration;
      if (!(exp instanceof Date) || Number.isNaN(exp.getTime())) {
        throw new PositionValidationError("INVALID_OPTION_EXPIRATION", "Option requires a valid expiration date");
      }
    }
  }

  const db = await getDb();
  const portfolioId = new ObjectId(input.portfolioId);
  const accountId = new ObjectId(input.accountId);
  const tenantScopedAccountFilter = withTenantScope(
    {
      _id: accountId,
      ...userIdQuery(input.userId)
    },
    input.tenantId
  );
  const account = await db
    .collection<Account>(collections.accounts)
    .findOne(tenantScopedAccountFilter);
  if (!account?._id) {
    throw new PositionValidationError("ACCOUNT_NOT_FOUND", "Account not found for user and tenant");
  }
  if (!account.portfolioId.equals(portfolioId)) {
    throw new PositionValidationError(
      "ACCOUNT_PORTFOLIO_MISMATCH",
      "Account does not belong to the specified portfolio"
    );
  }
  if (!account.extAccountId.trim()) {
    throw new PositionValidationError(
      "ACCOUNT_MISSING_EXT_ACCOUNT_ID",
      "Account is missing extAccountId"
    );
  }

  const now = new Date();
  const tenantObjectId = toTenantObjectId(input.tenantId);
  const effectiveQty = positionType === "cash" ? 1 : input.qty;
  const yrefTrim = input.yahooRef?.trim();

  let filterCore: Record<string, unknown>;
  let displaySymbol: string;

  if (positionType === "stock") {
    filterCore = {
      ...userIdQuery(input.userId),
      portfolioId,
      accountId,
      symbol: normalizedUnderlying,
      $or: [{ type: "stock" }, { type: { $exists: false } }]
    };
    displaySymbol = normalizedUnderlying;
  } else if (positionType === "cash") {
    filterCore = {
      ...userIdQuery(input.userId),
      portfolioId,
      accountId,
      type: "cash",
      symbol: cashLabel
    };
    displaySymbol = cashLabel;
  } else if (yrefTrim) {
    filterCore = {
      ...userIdQuery(input.userId),
      portfolioId,
      accountId,
      type: "option",
      yahooRef: yrefTrim
    };
    displaySymbol = normalizedUnderlying;
  } else {
    filterCore = {
      ...userIdQuery(input.userId),
      portfolioId,
      accountId,
      type: "option",
      symbol: normalizedUnderlying,
      optionType: input.optionType,
      strike: input.strike,
      expiration: input.expiration
    };
    displaySymbol = normalizedUnderlying;
  }

  const filter = withTenantScope(filterCore, input.tenantId);

  const setDoc = {
    userId: input.userId,
    portfolioId,
    accountId,
    symbol: displaySymbol,
    qty: effectiveQty,
    avgCost: input.avgCost,
    type: positionType,
    updatedAt: now,
    yahooRef: positionType === "option" && yrefTrim ? yrefTrim : null,
    optionType: positionType === "option" ? input.optionType ?? null : null,
    strike: positionType === "option" ? input.strike ?? null : null,
    expiration: positionType === "option" ? input.expiration ?? null : null
  };

  await db.collection<Position>(collections.positions).updateOne(
    filter,
    {
      $setOnInsert: {
        tenantId: tenantObjectId,
        createdAt: now
      },
      $set: setDoc
    },
    { upsert: true }
  );

  await bumpPortfolioWorkspaceContentRev({
    userId: input.userId,
    portfolioId: portfolioId.toHexString(),
    tenantId: input.tenantId
  });

  const position = await db.collection<Position>(collections.positions).findOne(filter);
  if (!position?._id) {
    throw new Error("Failed to upsert position");
  }
  return position;
}

export type UpdatePortfolioAccountInput = {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  accountId: string;
  name?: string;
  cashBalance?: number;
  extAccountId?: string;
  /** Custodian slug (`merrill` | `fidelity` | `etrade` | `ibkr`). */
  type?: AccountType;
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  outlook?: AccountOutlook | null;
  /** When true (admin paths), `type` may be updated even if `brokerImportLocked`. `extAccountId` is always patchable for the account owner. */
  bypassBrokerImportLock?: boolean;
};

/**
 * Patch account metadata for the owning user (name, cash, external ref, broker type, desk fields).
 */
export async function updatePortfolioAccountForUser(
  input: UpdatePortfolioAccountInput
): Promise<Account | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.accountId)) {
    return null;
  }
  const db = await getDb();
  const accountId = new ObjectId(input.accountId);
  const filter = {
    _id: accountId,
    ...userAccountsForPortfolioSessionScopeFilter(input.userId, input.portfolioId, input.tenantId)
  };
  const existing = await db.collection<Account>(collections.accounts).findOne(filter);
  if (!existing?._id) {
    return null;
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === "string" && input.name.trim()) {
    $set.name = input.name.trim().slice(0, 80);
  }
  if (typeof input.cashBalance === "number" && Number.isFinite(input.cashBalance) && input.cashBalance >= 0) {
    $set.cashBalance = input.cashBalance;
  }
  const brokerTypeLocked = Boolean(existing.brokerImportLocked) && !input.bypassBrokerImportLock;
  if (typeof input.extAccountId === "string") {
    const ref = input.extAccountId.trim();
    if (ref) {
      $set.extAccountId = ref;
    }
  }
  if (
    !brokerTypeLocked &&
    input.type !== undefined &&
    (accountTypeValues as readonly AccountType[]).includes(input.type)
  ) {
    $set.type = input.type;
  }

  const $unset: Record<string, string> = {};
  if (input.riskProfile !== undefined) {
    if (input.riskProfile === null) {
      $unset.riskProfile = "";
    } else {
      $set.riskProfile = input.riskProfile;
    }
  }
  if (input.outlook !== undefined) {
    if (input.outlook === null) {
      $unset.outlook = "";
    } else {
      const slug = parseAccountOutlook(input.outlook);
      if (slug) {
        $set.outlook = slug;
      }
    }
  }

  const hasSetMutation = Object.keys($set).some((k) => k !== "updatedAt");
  const hasUnsets = Object.keys($unset).length > 0;
  if (!hasSetMutation && !hasUnsets) {
    return existing;
  }

  const updateDoc: Record<string, unknown> = { $set };
  if (hasUnsets) {
    updateDoc.$unset = $unset;
  }
  await db.collection<Account>(collections.accounts).updateOne(filter, updateDoc);
  await bumpPortfolioWorkspaceContentRev({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  return db.collection<Account>(collections.accounts).findOne(filter);
}

/**
 * Marks an account as tied to a broker CSV import (locks broker `type` for app-user PATCH; `extAccountId` remains editable).
 */
export async function markPortfolioAccountBrokerImportLocked(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  accountId: string;
}): Promise<boolean> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.accountId)) {
    return false;
  }
  const db = await getDb();
  const filter = {
    _id: new ObjectId(input.accountId),
    ...userAccountsForPortfolioSessionScopeFilter(input.userId, input.portfolioId, input.tenantId)
  };
  const res = await db.collection<Account>(collections.accounts).updateOne(filter, {
    $set: { brokerImportLocked: true, updatedAt: new Date() }
  });
  return res.matchedCount === 1;
}

export async function updatePortfolioForUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  name?: string;
  portfolioKind?: Portfolio["portfolioKind"];
  isDefault?: boolean;
}): Promise<Portfolio | null> {
  const owned = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!owned?._id) {
    return null;
  }
  const hasFieldUpdate =
    input.name !== undefined ||
    input.portfolioKind !== undefined ||
    input.isDefault !== undefined;
  if (!hasFieldUpdate) {
    return owned;
  }
  return adminUpdatePortfolio({
    portfolioId: input.portfolioId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.portfolioKind !== undefined ? { portfolioKind: input.portfolioKind } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {})
  });
}

/**
 * Deletes an owned portfolio and dependent rows (accounts, positions, etc.).
 * Refuses when this is the user's only portfolio in tenant scope.
 */
export async function deletePortfolioForSessionUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
}): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "LAST_PORTFOLIO" }> {
  const owned = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!owned?._id) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const count = await countPortfoliosForUserInTenant({
    userId: input.userId,
    tenantId: input.tenantId
  });
  if (count <= 1) {
    return { ok: false, code: "LAST_PORTFOLIO" };
  }
  const deleted = await adminDeletePortfolio(input.portfolioId);
  return deleted ? { ok: true } : { ok: false, code: "NOT_FOUND" };
}

export type InsertPortfolioAccountInput = {
  userId: string;
  tenantId: string;
  portfolioId: string;
  name: string;
  type?: AccountType;
  /** External/broker ref; generated if omitted (xfinance-strategy `accountRef` compatibility). */
  extAccountId?: string;
  cashBalance?: number;
  /** When true, sets `isDefault` on this account (e.g. first account when creating a portfolio). */
  markAsPortfolioDefault?: boolean;
};

/**
 * Adds an account under an owned portfolio (manual / multi-broker desks, or seeded default row).
 */
export async function insertPortfolioAccountForUser(
  input: InsertPortfolioAccountInput
): Promise<Account | null> {
  await ensurePortfolioIndexes();
  const portfolio = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!portfolio?._id) {
    return null;
  }

  const limits = await getEffectiveWorkspaceLimitsForUser({
    tenantId: input.tenantId.trim(),
    userId: input.userId
  });
  const accountCount = await countPortfolioAccountsForUser({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  if (accountCount >= limits.portfolioAccountLimit) {
    return null;
  }

  const db = await getDb();
  const now = new Date();
  const tenantObjectId = toTenantObjectId(input.tenantId.trim());
  if (!tenantObjectId) {
    return null;
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) {
    return null;
  }
  const type: AccountType = input.type ?? "fidelity";
  const ext =
    input.extAccountId?.trim().slice(0, 200) ||
    `atx-${new ObjectId().toHexString().slice(-12)}`;
  const cash =
    typeof input.cashBalance === "number" &&
    Number.isFinite(input.cashBalance) &&
    input.cashBalance >= 0
      ? input.cashBalance
      : DEFAULT_ACCOUNT_CASH_BALANCE;

  const markDefault = Boolean(input.markAsPortfolioDefault);
  const doc: Account = {
    tenantId: tenantObjectId,
    userId: input.userId,
    portfolioId: portfolio._id,
    name,
    type,
    extAccountId: ext,
    cashBalance: cash,
    isDefault: markDefault,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<Account>(collections.accounts).insertOne(doc);
  await bumpPortfolioWorkspaceContentRev({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  return db.collection<Account>(collections.accounts).findOne({ _id: result.insertedId });
}

export async function deletePositionForAccount(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  accountId: string;
  positionId: string;
}): Promise<boolean> {
  await ensurePortfolioIndexes();
  if (
    !ObjectId.isValid(input.portfolioId) ||
    !ObjectId.isValid(input.accountId) ||
    !ObjectId.isValid(input.positionId)
  ) {
    return false;
  }
  const db = await getDb();
  const result = await db.collection<Position>(collections.positions).deleteOne(
    withTenantScope(
      {
        _id: new ObjectId(input.positionId),
        ...userIdQuery(input.userId),
        portfolioId: new ObjectId(input.portfolioId),
        accountId: new ObjectId(input.accountId)
      },
      input.tenantId
    )
  );
  const ok = result.deletedCount === 1;
  if (ok) {
    await bumpPortfolioWorkspaceContentRev({
      userId: input.userId,
      portfolioId: input.portfolioId,
      tenantId: input.tenantId
    });
  }
  return ok;
}

export async function deleteAccessRequest(
  id: string,
  options?: TenantScopedOptions
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<AccessRequest>(collections.accessRequests)
    .deleteOne(strictWriteTenantFilter({ _id: new ObjectId(id) }, options?.tenantId));
  return result.deletedCount === 1;
}

function portfolioTenantIdString(p: Portfolio): string | undefined {
  return p.tenantId ? p.tenantId.toHexString() : undefined;
}

function portfolioOwnerUserIdString(userId: Portfolio["userId"]): string {
  return typeof userId === "string" ? userId : userId.toHexString();
}

export async function adminGetPortfolioById(portfolioId: string): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(portfolioId)) {
    return null;
  }
  const db = await getDb();
  return db.collection<Portfolio>(collections.portfolios).findOne({ _id: new ObjectId(portfolioId) });
}

/** Admin portfolio list: unscoped (`all`) only when `ADMIN_PORTFOLIOS_LIST_ALL` is enabled for the session’s operator tooling. */
export type AdminPortfolioListScope =
  | { mode: "all" }
  | { mode: "scoped"; userId: string; tenantId: string };

export async function adminListPortfolios(input: {
  limit?: number;
  listScope: AdminPortfolioListScope;
}): Promise<Portfolio[]> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const filter =
    input.listScope.mode === "all"
      ? {}
      : withTenantScope({ ...userIdQuery(input.listScope.userId.trim()) }, input.listScope.tenantId);
  return db
    .collection<Portfolio>(collections.portfolios)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function adminListPortfoliosWithStats(input: {
  limit?: number;
  listScope: AdminPortfolioListScope;
}): Promise<Array<Portfolio & { accountCount: number; totalCashBalance: number }>> {
  const rows = await adminListPortfolios(input);
  const enriched = await Promise.all(
    rows.map(async (p) => {
      if (!p._id) {
        return { ...p, accountCount: 0, totalCashBalance: 0 };
      }
      const accounts = await listPortfolioAccounts({
        userId: portfolioOwnerUserIdString(p.userId),
        portfolioId: p._id.toHexString(),
        tenantId: portfolioTenantIdString(p)
      });
      const accountCount = accounts.length;
      const totalCashBalance = accounts.reduce((sum, a) => {
        const b = typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance) ? a.cashBalance : DEFAULT_ACCOUNT_CASH_BALANCE;
        return sum + b;
      }, 0);
      return { ...p, accountCount, totalCashBalance };
    })
  );
  return enriched;
}

export async function adminUpdatePortfolio(input: {
  portfolioId: string;
  name?: string;
  /** Workspace manage UI — real estate vs investments bucket. */
  portfolioKind?: Portfolio["portfolioKind"];
  /** Validated rows, or null to unset (read path uses catalog defaults). */
  scoringFactors?: PortfolioScoringFactor[] | null;
  /** When true, clears `isDefault` on other portfolios for the same user (and tenant scope). */
  isDefault?: boolean;
}): Promise<Portfolio | null> {
  const existing = await adminGetPortfolioById(input.portfolioId);
  if (!existing?._id) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const fieldSet: Record<string, unknown> = {};
  if (typeof input.name === "string" && input.name.trim()) {
    fieldSet.name = input.name.trim().slice(0, 200);
  }
  if (input.portfolioKind !== undefined) {
    fieldSet.portfolioKind = input.portfolioKind;
  }
  let unsetScoringFactors = false;
  if (input.scoringFactors !== undefined) {
    if (input.scoringFactors === null) {
      unsetScoringFactors = true;
    } else {
      fieldSet.scoringFactors = input.scoringFactors;
    }
  }

  const hasSetFields = Object.keys(fieldSet).length > 0;
  if (hasSetFields || unsetScoringFactors) {
    const $set: Record<string, unknown> = { ...fieldSet, updatedAt: now };
    const op: Record<string, unknown> = { $set };
    if (unsetScoringFactors) {
      op.$unset = { scoringFactors: "" };
    }
    await db.collection<Portfolio>(collections.portfolios).updateOne({ _id: existing._id }, op);
  }
  if (input.isDefault === true) {
    const tenantId = portfolioTenantIdString(existing);
    await db.collection<Portfolio>(collections.portfolios).updateMany(
      strictWriteTenantFilter(
        {
          ...userIdQuery(portfolioOwnerUserIdString(existing.userId)),
          isDefault: true,
          _id: { $ne: existing._id }
        },
        tenantId
      ),
      { $set: { isDefault: false, updatedAt: now } }
    );
    await db.collection<Portfolio>(collections.portfolios).updateOne(
      { _id: existing._id },
      { $set: { isDefault: true, updatedAt: now } }
    );
  }
  if (hasSetFields || unsetScoringFactors || input.isDefault === true) {
    await bumpPortfolioWorkspaceContentRev({
      userId: portfolioOwnerUserIdString(existing.userId),
      portfolioId: input.portfolioId,
      tenantId: portfolioTenantIdString(existing)
    });
  }
  return adminGetPortfolioById(input.portfolioId);
}

export async function adminCreatePortfolio(input: {
  userId: string;
  tenantId?: string;
  name: string;
  isDefault?: boolean;
  portfolioKind?: Portfolio["portfolioKind"];
  /** When set, persisted on the new portfolio row (tenant default from admin API). */
  initialScoringFactors?: PortfolioScoringFactor[] | null;
}): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  const name = input.name.trim().slice(0, 200);
  if (!name || !input.userId.trim()) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const tenantObjectId = toTenantObjectId(input.tenantId);
  const isDefault = Boolean(input.isDefault);

  if (tenantObjectId && input.tenantId?.trim()) {
    const limits = await getEffectiveWorkspaceLimitsForUser({
      tenantId: input.tenantId.trim(),
      userId: input.userId.trim()
    });
    const existingPortfolios = await countPortfoliosForUserInTenant({
      userId: input.userId.trim(),
      tenantId: input.tenantId.trim()
    });
    if (existingPortfolios >= limits.tenantPortfolioLimit) {
      return null;
    }
  }

  if (isDefault) {
    await db.collection<Portfolio>(collections.portfolios).updateMany(
      strictWriteTenantFilter({ ...userIdQuery(input.userId.trim()), isDefault: true }, input.tenantId),
      { $set: { isDefault: false, updatedAt: now } }
    );
  }

  const initialSf =
    input.initialScoringFactors &&
    Array.isArray(input.initialScoringFactors) &&
    input.initialScoringFactors.length > 0
      ? input.initialScoringFactors
      : undefined;
  const doc: Portfolio = {
    tenantId: tenantObjectId,
    userId: input.userId.trim(),
    name,
    isDefault,
    tenantPortfolioOrgKey: getTenantPortfolioOrgKey(),
    createdAt: now,
    updatedAt: now,
    ...(initialSf ? { scoringFactors: initialSf } : {}),
    ...(input.portfolioKind !== undefined && input.portfolioKind !== null
      ? { portfolioKind: input.portfolioKind }
      : {})
  };
  const res = await db.collection<Portfolio>(collections.portfolios).insertOne(doc);
  const created = await db.collection<Portfolio>(collections.portfolios).findOne({ _id: res.insertedId });
  if (created?._id) {
    await bumpPortfolioWorkspaceContentRev({
      userId: input.userId.trim(),
      portfolioId: created._id.toHexString(),
      tenantId: input.tenantId?.trim()
    });
    const tid = input.tenantId?.trim();
    if (tid && tenantObjectId) {
      const ordinal = await countPortfoliosForUserInTenant({
        userId: input.userId.trim(),
        tenantId: tid
      });
      await insertPortfolioAccountForUser({
        userId: input.userId.trim(),
        tenantId: tid,
        portfolioId: created._id.toHexString(),
        name: `defaultaccount${ordinal}`,
        markAsPortfolioDefault: true,
        cashBalance: DEFAULT_ACCOUNT_CASH_BALANCE
      });
    }
  }
  return created;
}

export async function adminDeletePortfolio(portfolioId: string): Promise<boolean> {
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return false;
  }
  const db = await getDb();
  const pid = portfolio._id;
  const ownerHex = portfolioOwnerUserIdString(portfolio.userId);
  const tenantStr = portfolioTenantIdString(portfolio);
  const uid = userIdQuery(ownerHex);
  const baseFilter: Record<string, unknown> = { portfolioId: pid, ...uid };
  await db.collection<Position>(collections.positions).deleteMany(baseFilter);
  await db.collection<Recommendation>(collections.recommendations).deleteMany(baseFilter);
  await db.collection<PortfolioAlert>(collections.portfolioAlerts).deleteMany(baseFilter);
  await db.collection<PortfolioDeliveryChannel>(collections.portfolioDeliveryChannels).deleteMany(baseFilter);
  await db.collection<Account>(collections.accounts).deleteMany(baseFilter);
  const res = await db.collection<Portfolio>(collections.portfolios).deleteOne({ _id: pid });
  const deleted = (res.deletedCount ?? 0) === 1;
  if (deleted) {
    const remaining = await db.collection<Portfolio>(collections.portfolios).countDocuments(
      userPortfoliosInSessionScopeFilter(ownerHex, tenantStr || undefined, "allowLegacyUserScope")
    );
    if (remaining === 0) {
      await db
        .collection<Watchlist>(collections.watchlists)
        .deleteMany(
          userWatchlistSessionScopeFilter(ownerHex, tenantStr || undefined, "allowLegacyUserScope")
        );
    }
  }
  return deleted;
}

/** Deletes every portfolio owned by `userId` (hex), including nested accounts/positions/etc. */
export async function deleteAllPortfoliosOwnedByUser(userId: string): Promise<number> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  const rows = await db
    .collection<Portfolio>(collections.portfolios)
    .find({ ...userIdQuery(userId) })
    .project({ _id: 1 })
    .toArray();
  let deleted = 0;
  for (const row of rows) {
    if (row._id && (await adminDeletePortfolio(row._id.toHexString()))) {
      deleted += 1;
    }
  }
  return deleted;
}

/**
 * Deletes app data tied to a `core_users` id (and optionally rows keyed by normalized email).
 * Does not delete the `core_users` document — caller must call `deleteCoreUserById` after.
 *
 * @param emailNormalizedForKeys — When null/empty (OAuth merge placeholder cleanup), skips deletes that
 *   could touch another user with the same email (bootstrap profile by `emailNormalized`, bootstrap trace
 *   tasks, `audit_login` by email).
 */
async function purgeCoreUserAssociatedData(
  userIdHex: string,
  emailNormalizedForKeys: string | null
): Promise<void> {
  if (!ObjectId.isValid(userIdHex)) {
    return;
  }
  await deleteAllPortfoliosOwnedByUser(userIdHex);
  const db = await getDb();
  const oid = new ObjectId(userIdHex);
  const uidQ = userIdQuery(userIdHex);

  await db.collection("core_tenant_memberships").deleteMany({ userId: oid });
  await db.collection<AccessRequest>(collections.accessRequests).deleteMany({ userId: userIdHex });
  await db.collection<UserAdminSettings>(collections.userSettings).deleteMany({ userId: userIdHex });

  await db.collection<OptionsStrategyPreference>(collections.optionsStrategyPreferences).deleteMany(uidQ);
  await db.collection("app_user_recommendations").deleteMany(uidQ);
  await db.collection("xchat_logs").deleteMany({
    $or: [{ userId: oid }, { userId: userIdHex }]
  });
  await db.collection("xchat_user_preferences").deleteMany({ userId: oid });
  await db.collection("app_feature_daily_usage").deleteMany({ userId: userIdHex });
  await db.collection("strategy_jobs").deleteMany(uidQ);

  const em = emailNormalizedForKeys?.trim() ? emailNormalizedForKeys.trim().toLowerCase() : "";
  if (em) {
    await db.collection("audit_login").deleteMany({
      $or: [{ userId: userIdHex }, { email: em }]
    });
    await db.collection("admin_user_bootstrap_profiles").deleteMany({
      $or: [{ userId: userIdHex }, { emailNormalized: em }]
    });
    await db.collection<ScheduledTask>(collections.scheduledTasks).deleteMany({
      name: `access-request-bootstrap:${em}`
    });
  } else {
    await db.collection("audit_login").deleteMany({ userId: userIdHex });
    await db.collection("admin_user_bootstrap_profiles").deleteMany({ userId: userIdHex });
  }
}

/**
 * Removes tenant rows tied to a `core_users` id before deleting that user (OAuth merge / cleanup).
 * Does not delete the `core_users` document — caller must call `deleteCoreUserById` after.
 */
export async function purgeEphemeralCoreUserScaffolding(userIdHex: string): Promise<void> {
  await purgeCoreUserAssociatedData(userIdHex, null);
}

/** Admin-only: full purge before removing `core_users`, including rows keyed by normalized email. */
export async function purgeAllDataAssociatedWithCoreUser(input: {
  userIdHex: string;
  emailNormalized: string;
}): Promise<void> {
  await purgeCoreUserAssociatedData(input.userIdHex, input.emailNormalized);
}

export async function adminListAccountsForPortfolio(portfolioId: string): Promise<Account[]> {
  const p = await adminGetPortfolioById(portfolioId);
  if (!p?._id) {
    return [];
  }
  return listPortfolioAccounts({
    userId: portfolioOwnerUserIdString(p.userId),
    portfolioId: p._id.toHexString(),
    tenantId: portfolioTenantIdString(p)
  });
}

export async function adminInsertAccountForPortfolio(input: {
  portfolioId: string;
  name: string;
  type?: AccountType;
  extAccountId?: string;
  cashBalance?: number;
}): Promise<Account | null> {
  const portfolio = await adminGetPortfolioById(input.portfolioId);
  if (!portfolio?._id) {
    return null;
  }
  const tenantId = portfolioTenantIdString(portfolio);
  if (!tenantId) {
    return null;
  }
  return insertPortfolioAccountForUser({
    userId: portfolioOwnerUserIdString(portfolio.userId),
    tenantId,
    portfolioId: portfolio._id.toHexString(),
    name: input.name,
    type: input.type,
    extAccountId: input.extAccountId,
    cashBalance: input.cashBalance
  });
}

export async function adminUpdatePortfolioAccount(input: {
  portfolioId: string;
  accountId: string;
  name?: string;
  cashBalance?: number;
  extAccountId?: string;
  type?: AccountType;
  isDefault?: boolean;
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  outlook?: AccountOutlook | null;
}): Promise<Account | null> {
  const portfolio = await adminGetPortfolioById(input.portfolioId);
  if (!portfolio?._id) {
    return null;
  }
  const tenantId = portfolioTenantIdString(portfolio);
  const portfolioTenantScopeMode = tenantId ? "denyIfTenantMissing" : "allowLegacyUserScope";
  const ownerId = portfolioOwnerUserIdString(portfolio.userId);
  const base = await updatePortfolioAccountForUser({
    userId: ownerId,
    tenantId,
    portfolioId: input.portfolioId,
    accountId: input.accountId,
    name: input.name,
    cashBalance: input.cashBalance,
    extAccountId: input.extAccountId,
    type: input.type,
    riskProfile: input.riskProfile,
    outlook: input.outlook,
    bypassBrokerImportLock: true
  });
  if (input.isDefault === undefined) {
    return base;
  }
  const db = await getDb();
  const aid = new ObjectId(input.accountId);
  const filter = {
    _id: aid,
    ...userAccountsForPortfolioSessionScopeFilter(
      ownerId,
      input.portfolioId,
      tenantId,
      portfolioTenantScopeMode
    )
  };
  const existing = await db.collection<Account>(collections.accounts).findOne(filter);
  if (!existing?._id) {
    return null;
  }
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.isDefault === true) {
    await db.collection<Account>(collections.accounts).updateMany(
      {
        ...userAccountsForPortfolioSessionScopeFilter(
          ownerId,
          input.portfolioId,
          tenantId,
          portfolioTenantScopeMode
        ),
        isDefault: true,
        _id: { $ne: aid }
      },
      { $set: { isDefault: false, updatedAt: new Date() } }
    );
    $set.isDefault = true;
  }
  if (Object.keys($set).length <= 1) {
    return db.collection<Account>(collections.accounts).findOne(filter);
  }
  await db.collection<Account>(collections.accounts).updateOne(filter, { $set });
  await bumpPortfolioWorkspaceContentRev({
    userId: ownerId,
    portfolioId: input.portfolioId,
    tenantId
  });
  return db.collection<Account>(collections.accounts).findOne(filter);
}

/**
 * Deletes a custodian account (and its positions) within a portfolio when more than one account exists.
 * Reassigns default when the deleted row was default.
 */
export async function deleteAccountInPortfolioForOwner(input: {
  ownerUserId: string;
  tenantId: string | undefined;
  portfolioId: string;
  accountId: string;
}): Promise<boolean> {
  const accounts = await listPortfolioAccounts({
    userId: input.ownerUserId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  const target = accounts.find((a) => a._id?.toHexString() === input.accountId);
  if (!target?._id) {
    return false;
  }
  if (accounts.length <= 1) {
    return false;
  }
  const db = await getDb();
  const pid = new ObjectId(input.portfolioId);
  const aid = new ObjectId(input.accountId);
  const scope = withTenantScope(
    {
      ...userIdQuery(input.ownerUserId),
      portfolioId: pid,
      accountId: aid
    },
    input.tenantId
  );
  await db.collection<Position>(collections.positions).deleteMany(scope);
  const accountDeleteFilter = {
    _id: aid,
    ...userAccountsForPortfolioSessionScopeFilter(input.ownerUserId, input.portfolioId, input.tenantId)
  };
  const del = await db.collection<Account>(collections.accounts).deleteOne(accountDeleteFilter);
  if ((del.deletedCount ?? 0) === 0) {
    return false;
  }
  if (target.isDefault) {
    const next = accounts.find((a) => a._id?.toHexString() !== input.accountId);
    if (next?._id) {
      await db.collection<Account>(collections.accounts).updateOne(
        {
          _id: next._id,
          ...userAccountsForPortfolioSessionScopeFilter(input.ownerUserId, input.portfolioId, input.tenantId)
        },
        { $set: { isDefault: true, updatedAt: new Date() } }
      );
    }
  }
  await bumpPortfolioWorkspaceContentRev({
    userId: input.ownerUserId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  return true;
}

export async function deletePortfolioAccountForUser(input: {
  userId: string;
  tenantId: string | undefined;
  portfolioId: string;
  accountId: string;
}): Promise<boolean> {
  return deleteAccountInPortfolioForOwner({
    ownerUserId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId,
    accountId: input.accountId
  });
}

export async function adminDeleteAccountForPortfolio(input: {
  portfolioId: string;
  accountId: string;
}): Promise<boolean> {
  const portfolio = await adminGetPortfolioById(input.portfolioId);
  if (!portfolio?._id) {
    return false;
  }
  const tenantId = portfolioTenantIdString(portfolio);
  const ownerId = portfolioOwnerUserIdString(portfolio.userId);
  return deleteAccountInPortfolioForOwner({
    ownerUserId: ownerId,
    tenantId,
    portfolioId: portfolio._id.toHexString(),
    accountId: input.accountId
  });
}

type AdminPortfolioAccountContext = {
  portfolio: Portfolio;
  ownerId: string;
  tenantId: string | undefined;
  account: Account;
};

async function resolveAdminPortfolioAccount(
  portfolioId: string,
  accountId: string
): Promise<AdminPortfolioAccountContext | null> {
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id || !ObjectId.isValid(accountId)) {
    return null;
  }
  const ownerId = portfolioOwnerUserIdString(portfolio.userId);
  const tenantId = portfolioTenantIdString(portfolio);
  const accounts = await listPortfolioAccounts({
    userId: ownerId,
    portfolioId: portfolio._id.toHexString(),
    tenantId
  });
  const account = accounts.find((a) => a._id?.toHexString() === accountId);
  if (!account?._id) {
    return null;
  }
  return { portfolio, ownerId, tenantId, account };
}

/** Admin: list positions (holdings) for a portfolio account after verifying the account belongs to the portfolio. */
export async function adminListPositionsForPortfolioAccount(input: {
  portfolioId: string;
  accountId: string;
}): Promise<{ portfolio: Portfolio; account: Account; positions: Position[] } | null> {
  const ctx = await resolveAdminPortfolioAccount(input.portfolioId, input.accountId);
  if (!ctx) {
    return null;
  }
  const positions = await listPortfolioPositionsByAccount({
    userId: ctx.ownerId,
    portfolioId: input.portfolioId,
    accountIds: [new ObjectId(input.accountId)],
    tenantId: ctx.tenantId
  });
  return { portfolio: ctx.portfolio, account: ctx.account, positions };
}

/** Admin: upsert a position lot (same semantics as {@link upsertPositionForAccount}). */
export async function adminUpsertPositionForPortfolioAccount(input: AdminUpsertPositionInput): Promise<Position> {
  const ctx = await resolveAdminPortfolioAccount(input.portfolioId, input.accountId);
  if (!ctx) {
    throw new PositionValidationError("ACCOUNT_NOT_FOUND", "Account not found for portfolio");
  }
  return upsertPositionForAccount({
    userId: ctx.ownerId,
    tenantId: ctx.tenantId,
    ...input
  });
}

/** Admin: delete one position document for a portfolio account. */
export async function adminDeletePositionForPortfolioAccount(input: {
  portfolioId: string;
  accountId: string;
  positionId: string;
}): Promise<boolean> {
  const ctx = await resolveAdminPortfolioAccount(input.portfolioId, input.accountId);
  if (!ctx) {
    return false;
  }
  return deletePositionForAccount({
    userId: ctx.ownerId,
    tenantId: ctx.tenantId,
    portfolioId: input.portfolioId,
    accountId: input.accountId,
    positionId: input.positionId
  });
}
