import { type Filter, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import { getTenantPortfolioOrgKey } from "@/modules/core-admin/tenant-portfolio-org";
import {
    ACTIONABLE_ACCESS_REQUEST_STATUSES,
    type AccessRequest,
    type AccessRequestListItem,
    type AccessRequestStatus,
    type Account,
    type AccountType,
    type ApprovedUserListItem,
    type DeployNoteConfig,
    type Portfolio,
    type Position,
    type ScheduledTask,
    type TaskRun,
    type UserAdminSettings,
    type Watchlist,
    type WatchlistSymbol,
    type WatchlistSymbolImportEntry
} from "@/modules/core-admin/types";
import type { CoreUser } from "@/modules/identity/types";
import { MAX_WATCHLIST_SYMBOLS } from "@/modules/watchlist/constants";

const collections = {
  accessRequests: "admin_access_requests",
  scheduledTasks: "admin_scheduled_tasks",
  taskRuns: "admin_task_runs",
  userSettings: "admin_user_settings",
  deployNoteConfigs: "admin_deploy_note_configs",
  portfolios: TENANT_PORTFOLIO_COLLECTION,
  accounts: "portfolio_accounts",
  watchlists: "portfolio_watchlists",
  positions: "portfolio_positions"
} as const;

let ensurePortfolioIndexesPromise: Promise<void> | null = null;

const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
/** Default broker bucket on new portfolios for future trader cohort grouping. */
export const DEFAULT_EXT_BROKER_REF = "extBrokerName";
const DEFAULT_ACCOUNT_NAME = "defaultaccount";
const DEFAULT_ACCOUNT_REF = "fidelity-default-account";
/** Default paper cash for provision + read-time coalesce when Mongo field is missing. */
export const DEFAULT_ACCOUNT_CASH_BALANCE = 25_000;
const DEFAULT_WATCHLIST_NAME = "DefaultWatchlist";
/** Ensured on every default watchlist read/provision (xChat + portfolio UX). */
const DEFAULT_WATCHLIST_SYMBOL = "TSLA";

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
    return {
      symbol,
      addedAt,
      ...(lineType ? { lineType } : {}),
      ...(strategy ? { strategy } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(entryPrice !== undefined ? { entryPrice } : {})
    };
  }
  return null;
}

/** Normalizes legacy string[] rows and guarantees `ensureSymbols` exist (deduped, stable insert order). */
export function normalizeWatchlistDocumentSymbols(
  raw: unknown,
  ensureSymbols: string[]
): WatchlistSymbol[] {
  const now = new Date();
  const arr = Array.isArray(raw) ? raw : [];
  const bySymbol = new Map<string, WatchlistSymbol>();
  for (const item of arr) {
    const coerced = coerceWatchlistSymbolEntry(item, now);
    if (coerced && !bySymbol.has(coerced.symbol)) {
      bySymbol.set(coerced.symbol, coerced);
    }
  }
  const ensureUnique = Array.from(
    new Set(
      ensureSymbols
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is string => Boolean(s))
    )
  );
  for (const symbol of ensureUnique) {
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, { symbol, addedAt: now });
    }
  }
  return Array.from(bySymbol.values());
}

type TenantScopedOptions = {
  tenantId?: string;
};

function toTenantObjectId(tenantId?: string): ObjectId | undefined {
  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return undefined;
  }
  return new ObjectId(tenantId);
}

/**
 * Session `userId` is a hex string; older rows may store `userId` as BSON ObjectId.
 * Use this on reads and non-upsert writes so both match.
 */
function userIdQuery(userId: string): { userId: string | { $in: (string | ObjectId)[] } } {
  if (ObjectId.isValid(userId)) {
    return { userId: { $in: [userId, new ObjectId(userId)] } };
  }
  return { userId };
}

function withTenantScope(
  query: Record<string, unknown>,
  tenantId?: string
): Record<string, unknown> {
  const tenantObjectId = toTenantObjectId(tenantId);
  if (!tenantObjectId) {
    return query;
  }
  return {
    ...query,
    $or: [
      { tenantId: tenantObjectId },
      { tenantId: { $exists: false } },
      { tenantId: { $type: "null" } }
    ]
  };
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
};

export class PositionValidationError extends Error {
  readonly code: "INVALID_IDS" | "ACCOUNT_NOT_FOUND" | "ACCOUNT_PORTFOLIO_MISMATCH" | "ACCOUNT_MISSING_EXT_ACCOUNT_ID";

  constructor(code: PositionValidationError["code"], message: string) {
    super(message);
    this.name = "PositionValidationError";
    this.code = code;
  }
}

async function createPortfolioIndexes(): Promise<void> {
  const db = await getDb();
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
    db.collection<Watchlist>(collections.watchlists).createIndex(
      { tenantId: 1, portfolioId: 1 },
      {
        unique: true,
        name: "uniq_watchlist_per_portfolio"
      }
    ),
    db.collection<Position>(collections.positions).createIndex(
      { tenantId: 1, portfolioId: 1, accountId: 1, symbol: 1 },
      {
        name: "idx_positions_tenant_portfolio_account_symbol"
      }
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

export async function listAccessRequests(options?: {
  limit?: number;
  status?: AccessRequestStatus;
  statuses?: AccessRequestStatus[];
  tenantId?: string;
}): Promise<AccessRequestListItem[]> {
  const limit = options?.limit ?? 50;
  const db = await getDb();

  let statusQuery: Record<string, unknown> = {};
  if (options?.statuses && options.statuses.length > 0) {
    statusQuery = { status: { $in: options.statuses } };
  } else if (options?.status) {
    statusQuery = { status: options.status };
  }

  const requests = await db
    .collection<AccessRequest>(collections.accessRequests)
    .find(withTenantScope(statusQuery, options?.tenantId))
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
      "xAccount.avatarUrl": 1
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
          avatarUrl: user.xAccount?.avatarUrl
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
  const db = await getDb();

  const document: AccessRequest = {
    ...payload,
    tenantId: toTenantObjectId(payload.tenantId),
    requestedPlan: payload.requestedPlan ?? "free",
    status: payload.status ?? "pending",
    requestedAt: payload.requestedAt ?? new Date()
  };

  const result = await db
    .collection<AccessRequest>(collections.accessRequests)
    .insertOne(document);

  return { ...document, _id: result.insertedId };
}

export async function getPendingAccessRequestByUserAndRole(input: {
  userId: string;
  requestedRole: AccessRequest["requestedRole"];
  tenantId?: string;
}): Promise<AccessRequest | null> {
  const db = await getDb();
  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(
      withTenantScope(
        {
          userId: input.userId,
          requestedRole: input.requestedRole,
          status: "pending"
        },
        input.tenantId
      )
    );
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
    .findOne(withTenantScope({ _id: new ObjectId(id) }, options?.tenantId));
}

export async function reviewAccessRequestById(input: {
  requestId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  tenantId?: string;
}): Promise<AccessRequest | null> {
  if (!ObjectId.isValid(input.requestId)) {
    return null;
  }
  const db = await getDb();
  const reviewedAt = new Date();
  const _id = new ObjectId(input.requestId);
  await db.collection<AccessRequest>(collections.accessRequests).updateOne(
    withTenantScope({ _id }, input.tenantId),
    {
      $set: {
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt
      }
    }
  );

  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(withTenantScope({ _id }, input.tenantId));
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
    withTenantScope({ _id, status: { $in: ACTIONABLE_ACCESS_REQUEST_STATUSES } }, input.tenantId),
    {
      $set: {
        requestedPlan: input.requestedPlan
      }
    }
  );

  return db
    .collection<AccessRequest>(collections.accessRequests)
    .findOne(withTenantScope({ _id }, input.tenantId));
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
      subscriptionPlan: request.user?.subscriptionPlan ?? "free",
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
        subscriptionPlan: user.subscriptionPlan ?? "free"
      });
    }
  }

  return Array.from(approvedByUserId.values()).slice(0, limit);
}

export async function listScheduledTasks(options?: {
  limit?: number;
  tenantId?: string;
}): Promise<ScheduledTask[]> {
  const limit = options?.limit ?? 50;
  const db = await getDb();
  return db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .find(withTenantScope({}, options?.tenantId))
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
}

export async function createScheduledTask(
  payload: Omit<ScheduledTask, "_id" | "tenantId"> & {
    tenantId?: string;
  }
): Promise<ScheduledTask> {
  const db = await getDb();
  const now = new Date();
  const document: ScheduledTask = {
    ...payload,
    tenantId: toTenantObjectId(payload.tenantId),
    nextRunAt: payload.nextRunAt ?? new Date(now.getTime() + 5 * 60 * 1000)
  };
  const result = await db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .insertOne(document);
  return { ...document, _id: result.insertedId };
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
    .findOne(withTenantScope({ _id: new ObjectId(id) }, options?.tenantId));
}

export async function listDueScheduledTasks(
  now: Date,
  options?: TenantScopedOptions
): Promise<ScheduledTask[]> {
  const db = await getDb();
  return db
    .collection<ScheduledTask>(collections.scheduledTasks)
    .find(
      withTenantScope(
        {
          enabled: true,
          nextRunAt: { $lte: now }
        },
        options?.tenantId
      )
    )
    .sort({ nextRunAt: 1 })
    .limit(30)
    .toArray();
}

export async function markTaskRunWindow(
  taskId: ObjectId,
  startedAt: Date
): Promise<void> {
  const db = await getDb();
  await db.collection<ScheduledTask>(collections.scheduledTasks).updateOne(
    { _id: taskId },
    {
      $set: {
        lastRunAt: startedAt,
        nextRunAt: new Date(startedAt.getTime() + 24 * 60 * 60 * 1000)
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
}): Promise<TaskRun[]> {
  const limit = options?.limit ?? 50;
  const db = await getDb();
  return db
    .collection<TaskRun>(collections.taskRuns)
    .find(withTenantScope({}, options?.tenantId))
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
    withTenantScope({ userId }, options?.tenantId),
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

export async function getDefaultPortfolio(
  userId: string,
  options?: TenantScopedOptions
): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  return db
    .collection<Portfolio>(collections.portfolios)
    .findOne(withTenantScope({ ...userIdQuery(userId), isDefault: true }, options?.tenantId));
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
  return db
    .collection<Portfolio>(collections.portfolios)
    .findOne(
      withTenantScope(
        {
          _id: new ObjectId(input.portfolioId),
          ...userIdQuery(input.userId)
        },
        input.tenantId
      )
    );
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
  return result.deletedCount ?? 0;
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
    .find(
      withTenantScope(
        {
          ...userIdQuery(input.userId),
          portfolioId: new ObjectId(input.portfolioId)
        },
        input.tenantId
      )
    )
    .sort({ isDefault: -1, createdAt: 1 })
    .toArray();
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

export async function getPortfolioWatchlist(input: {
  userId: string;
  portfolioId: string;
  tenantId?: string;
}): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<Watchlist>(collections.watchlists).findOne(
    withTenantScope(
      {
        ...userIdQuery(input.userId),
        portfolioId: new ObjectId(input.portfolioId)
      },
      input.tenantId
    )
  );
  if (!doc) return null;
  const symbols = normalizeWatchlistDocumentSymbols(doc.symbols, [DEFAULT_WATCHLIST_SYMBOL]);
  return { ...doc, symbols };
}

export type MutatePortfolioWatchlistInput = {
  userId: string;
  portfolioId: string;
  tenantId?: string;
  addSymbols?: string[];
  /** Merge metadata on existing symbols or append new rows (CSV import). */
  addEntries?: WatchlistSymbolImportEntry[];
  removeSymbols?: string[];
  dedupe?: boolean;
};

function mergeImportEntryIntoSymbol(
  base: WatchlistSymbol,
  entry: WatchlistSymbolImportEntry
): WatchlistSymbol {
  const next: WatchlistSymbol = { ...base };
  if (entry.lineType !== undefined) {
    const v = entry.lineType.trim();
    if (v.length === 0) {
      delete next.lineType;
    } else {
      next.lineType = v.slice(0, 128);
    }
  }
  if (entry.strategy !== undefined) {
    const v = entry.strategy.trim();
    if (v.length === 0) {
      delete next.strategy;
    } else {
      next.strategy = v.slice(0, 512);
    }
  }
  if (entry.quantity !== undefined) {
    next.quantity = Number.isFinite(entry.quantity) ? entry.quantity : undefined;
  }
  if (entry.entryPrice !== undefined) {
    next.entryPrice = Number.isFinite(entry.entryPrice) ? entry.entryPrice : undefined;
  }
  return next;
}

export async function mutatePortfolioWatchlistSymbols(
  input: MutatePortfolioWatchlistInput
): Promise<Watchlist | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId)) {
    return null;
  }
  const hasMutation =
    Boolean(input.addSymbols?.length) ||
    Boolean(input.addEntries?.length) ||
    Boolean(input.removeSymbols?.length) ||
    Boolean(input.dedupe);
  if (!hasMutation) {
    return getPortfolioWatchlist({
      userId: input.userId,
      portfolioId: input.portfolioId,
      tenantId: input.tenantId
    });
  }

  const db = await getDb();
  const portfolioOid = new ObjectId(input.portfolioId);
  const filter = withTenantScope(
    {
      ...userIdQuery(input.userId),
      portfolioId: portfolioOid
    },
    input.tenantId
  );
  const doc = await db.collection<Watchlist>(collections.watchlists).findOne(filter);
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

  await db.collection<Watchlist>(collections.watchlists).updateOne(filter, {
    $set: { symbols, updatedAt: now }
  });

  return getPortfolioWatchlist({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
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

  const portfolioLookupFilter = withTenantScope(
    { ...userIdQuery(input.userId), isDefault: true },
    input.tenantId
  );
  let portfolio = await db
    .collection<Portfolio>(collections.portfolios)
    .findOne(portfolioLookupFilter);

  const portfolioSetFields = {
    name: portfolioName,
    isDefault: true,
    ext_broker_ref: DEFAULT_EXT_BROKER_REF,
    tenantPortfolioOrgKey: getTenantPortfolioOrgKey(),
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (portfolio?._id) {
    await db.collection<Portfolio>(collections.portfolios).updateOne(
      { _id: portfolio._id },
      { $set: portfolioSetFields }
    );
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
        $set: portfolioSetFields
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
        ...userIdQuery(input.userId),
        portfolioId: portfolio._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: { $type: "null" } }]
      } as Filter<Watchlist>,
      { $set: { tenantId: tenantObjectId, updatedAt: now } }
    );
  }

  const extAccountId = DEFAULT_ACCOUNT_REF;
  const accountLookupFilter = withTenantScope(
    {
      ...userIdQuery(input.userId),
      portfolioId: portfolio._id,
      isDefault: true
    },
    input.tenantId
  );
  let account = await db.collection<Account>(collections.accounts).findOne(accountLookupFilter);

  const accountSetFields = {
    name: accountName,
    type: accountType,
    extAccountId,
    cashBalance: DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (account?._id) {
    await db.collection<Account>(collections.accounts).updateOne(
      { _id: account._id },
      { $set: accountSetFields }
    );
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
        $set: accountSetFields
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
      withTenantScope(
        {
          ...userIdQuery(input.userId),
          portfolioId: portfolio._id
        },
        input.tenantId
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

  const watchlistLookupFilter = withTenantScope(
    {
      ...userIdQuery(input.userId),
      portfolioId: portfolio._id
    },
    input.tenantId
  );
  const existingWatchlist = await db
    .collection<Watchlist>(collections.watchlists)
    .findOne(watchlistLookupFilter);
  const mergedWatchlistSymbols = normalizeWatchlistDocumentSymbols(
    existingWatchlist?.symbols ?? [],
    Array.from(
      new Set([DEFAULT_WATCHLIST_SYMBOL, ...seedSymbolStrings.map((s) => s.trim().toUpperCase())])
    ).filter(Boolean)
  );

  const watchlistSetFields = {
    name: watchlistName,
    symbols: mergedWatchlistSymbols,
    isDefault: true,
    updatedAt: now,
    ...(tenantObjectId ? { tenantId: tenantObjectId } : {})
  };

  if (existingWatchlist?._id) {
    await db.collection<Watchlist>(collections.watchlists).updateOne(
      { _id: existingWatchlist._id },
      { $set: watchlistSetFields }
    );
  } else {
    const watchlistInsertFilter = strictWriteTenantFilter(
      {
        userId: input.userId,
        portfolioId: portfolio._id
      },
      input.tenantId
    );
    await db.collection<Watchlist>(collections.watchlists).updateOne(
      watchlistInsertFilter,
      {
        $setOnInsert: {
          userId: input.userId,
          portfolioId: portfolio._id,
          createdAt: now
        },
        $set: watchlistSetFields
      },
      { upsert: true }
    );
  }

  let watchlist = await db
    .collection<Watchlist>(collections.watchlists)
    .findOne(watchlistLookupFilter);
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

  const db = await getDb();
  const portfolioId = new ObjectId(input.portfolioId);
  const accountId = new ObjectId(input.accountId);
  const normalizedSymbol = input.symbol.trim().toUpperCase();
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
  const filter = withTenantScope(
    {
      ...userIdQuery(input.userId),
      portfolioId,
      accountId,
      symbol: normalizedSymbol
    },
    input.tenantId
  );
  await db.collection<Position>(collections.positions).updateOne(
    filter,
    {
      $setOnInsert: {
        tenantId: tenantObjectId,
        createdAt: now
      },
      $set: {
        userId: input.userId,
        portfolioId,
        accountId,
        symbol: normalizedSymbol,
        qty: input.qty,
        avgCost: input.avgCost,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const position = await db
    .collection<Position>(collections.positions)
    .findOne(filter);
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
};

/**
 * Patch account metadata for the owning user (name, cash, external ref). Does not change broker type here.
 */
export async function updatePortfolioAccountForUser(
  input: UpdatePortfolioAccountInput
): Promise<Account | null> {
  await ensurePortfolioIndexes();
  if (!ObjectId.isValid(input.portfolioId) || !ObjectId.isValid(input.accountId)) {
    return null;
  }
  const db = await getDb();
  const portfolioId = new ObjectId(input.portfolioId);
  const accountId = new ObjectId(input.accountId);
  const filter = withTenantScope(
    {
      _id: accountId,
      ...userIdQuery(input.userId),
      portfolioId
    },
    input.tenantId
  );
  const existing = await db.collection<Account>(collections.accounts).findOne(filter);
  if (!existing?._id) {
    return null;
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === "string" && input.name.trim()) {
    $set.name = input.name.trim();
  }
  if (typeof input.cashBalance === "number" && Number.isFinite(input.cashBalance) && input.cashBalance >= 0) {
    $set.cashBalance = input.cashBalance;
  }
  if (typeof input.extAccountId === "string") {
    const ref = input.extAccountId.trim();
    if (ref) {
      $set.extAccountId = ref;
    }
  }

  if (Object.keys($set).length <= 1) {
    return existing;
  }

  await db.collection<Account>(collections.accounts).updateOne(filter, { $set });
  return db.collection<Account>(collections.accounts).findOne(filter);
}

export async function updatePortfolioForUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  name: string;
}): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  const existing = await getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
  if (!existing?._id) {
    return null;
  }
  const trimmed = input.name.trim();
  if (!trimmed) {
    return existing;
  }
  const db = await getDb();
  await db.collection<Portfolio>(collections.portfolios).updateOne(
    { _id: existing._id },
    { $set: { name: trimmed.slice(0, 200), updatedAt: new Date() } }
  );
  return getPortfolioByIdForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId
  });
}

export type InsertPortfolioAccountInput = {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  name: string;
  type?: AccountType;
  /** External/broker ref; generated if omitted (xfinance-strategy `accountRef` compatibility). */
  extAccountId?: string;
  cashBalance?: number;
};

/**
 * Adds a non-default account under an owned portfolio (manual / multi-broker desks).
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

  const db = await getDb();
  const now = new Date();
  const tenantObjectId = toTenantObjectId(input.tenantId);
  const name = input.name.trim().slice(0, 200);
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

  const doc: Account = {
    tenantId: tenantObjectId,
    userId: input.userId,
    portfolioId: portfolio._id,
    name,
    type,
    extAccountId: ext,
    cashBalance: cash,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<Account>(collections.accounts).insertOne(doc);
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
  return result.deletedCount === 1;
}

export async function deleteAccessRequest(
  id: string,
  options?: TenantScopedOptions
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<AccessRequest>(collections.accessRequests)
    .deleteOne(withTenantScope({ _id: new ObjectId(id) }, options?.tenantId));
  return result.deletedCount === 1;
}
