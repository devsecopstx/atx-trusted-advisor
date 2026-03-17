import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import type { CoreUser } from "@/modules/identity/types";
import type {
  AccessRequest,
  AccessRequestListItem,
  ApprovedUserListItem,
  AccessRequestStatus,
  Account,
  AccountType,
  ScheduledTask,
  TaskRun,
  UserAdminSettings,
  Portfolio,
  Position,
  Watchlist
} from "@/modules/core-admin/types";

const collections = {
  accessRequests: "admin_access_requests",
  scheduledTasks: "admin_scheduled_tasks",
  taskRuns: "admin_task_runs",
  userSettings: "admin_user_settings",
  portfolios: "portfolio_portfolios",
  accounts: "portfolio_accounts",
  watchlists: "portfolio_watchlists",
  positions: "portfolio_positions"
} as const;

let ensurePortfolioIndexesPromise: Promise<void> | null = null;

const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_ACCOUNT_NAME = "Default Account";
const DEFAULT_WATCHLIST_NAME = "Default Watchlist";

type TenantScopedOptions = {
  tenantId?: string;
};

function toTenantObjectId(tenantId?: string): ObjectId | undefined {
  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return undefined;
  }
  return new ObjectId(tenantId);
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
    $or: [{ tenantId: tenantObjectId }, { tenantId: { $exists: false } }]
  };
}

function withStrictTenantScope(
  query: Record<string, unknown>,
  tenantId?: string
): Record<string, unknown> {
  const tenantObjectId = toTenantObjectId(tenantId);
  if (!tenantObjectId) {
    return query;
  }
  return {
    ...query,
    tenantId: tenantObjectId
  };
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
    ensurePortfolioIndexesPromise = createPortfolioIndexes();
  }
  await ensurePortfolioIndexesPromise;
}

export async function listAccessRequests(options?: {
  limit?: number;
  status?: AccessRequestStatus;
  tenantId?: string;
}): Promise<AccessRequestListItem[]> {
  const limit = options?.limit ?? 50;
  const db = await getDb();
  const requests = await db
    .collection<AccessRequest>(collections.accessRequests)
    .find(
      withTenantScope(
        options?.status ? { status: options.status } : {},
        options?.tenantId
      )
    )
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
    withTenantScope({ _id, status: "pending" }, input.tenantId),
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

export async function getDefaultPortfolio(
  userId: string,
  options?: TenantScopedOptions
): Promise<Portfolio | null> {
  await ensurePortfolioIndexes();
  const db = await getDb();
  return db
    .collection<Portfolio>(collections.portfolios)
    .findOne(withStrictTenantScope({ userId, isDefault: true }, options?.tenantId));
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
      withStrictTenantScope(
        {
          userId: input.userId,
          portfolioId: new ObjectId(input.portfolioId)
        },
        input.tenantId
      )
    )
    .sort({ isDefault: -1, createdAt: 1 })
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
  return db.collection<Watchlist>(collections.watchlists).findOne(
    withStrictTenantScope(
      {
        userId: input.userId,
        portfolioId: new ObjectId(input.portfolioId)
      },
      input.tenantId
    )
  );
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
  const accountType = input.accountType ?? "fidelity";
  const watchlistSymbols = (input.watchlistSymbols ?? ["TSLA"]).map(
    (symbol) => ({ symbol: symbol.toUpperCase(), addedAt: now })
  );

  const portfolioFilter = withStrictTenantScope(
    { userId: input.userId, isDefault: true },
    input.tenantId
  );
  await db.collection<Portfolio>(collections.portfolios).updateOne(
    portfolioFilter,
    {
      $setOnInsert: {
        tenantId: tenantObjectId,
        userId: input.userId,
        createdAt: now
      },
      $set: {
        name: portfolioName,
        isDefault: true,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const portfolio = await db
    .collection<Portfolio>(collections.portfolios)
    .findOne(portfolioFilter);
  if (!portfolio?._id) {
    throw new Error("Failed to provision default portfolio");
  }

  const extAccountId = `${accountType}-default-${input.userId}`;
  const accountFilter = withStrictTenantScope(
    {
      userId: input.userId,
      portfolioId: portfolio._id,
      isDefault: true
    },
    input.tenantId
  );
  await db.collection<Account>(collections.accounts).updateOne(
    accountFilter,
    {
      $setOnInsert: {
        tenantId: tenantObjectId,
        userId: input.userId,
        portfolioId: portfolio._id,
        createdAt: now
      },
      $set: {
        name: accountName,
        type: accountType,
        extAccountId,
        isDefault: true,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const account = await db
    .collection<Account>(collections.accounts)
    .findOne(accountFilter);
  if (!account?._id) {
    throw new Error("Failed to provision default account");
  }

  const watchlistFilter = withStrictTenantScope(
    {
      userId: input.userId,
      portfolioId: portfolio._id
    },
    input.tenantId
  );
  await db.collection<Watchlist>(collections.watchlists).updateOne(
    watchlistFilter,
    {
      $setOnInsert: {
        tenantId: tenantObjectId,
        userId: input.userId,
        portfolioId: portfolio._id,
        createdAt: now
      },
      $set: {
        name: watchlistName,
        symbols: watchlistSymbols,
        isDefault: true,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const watchlist = await db
    .collection<Watchlist>(collections.watchlists)
    .findOne(watchlistFilter);
  if (!watchlist?._id) {
    throw new Error("Failed to provision default watchlist");
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
  const tenantScopedAccountFilter = withStrictTenantScope(
    {
      _id: accountId,
      userId: input.userId
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
  const filter = withStrictTenantScope(
    {
      userId: input.userId,
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
