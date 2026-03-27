import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import {
    mergeTenantWorkspaceLimits,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type {
    AuthContext,
    CoreUser,
    Tenant,
    TenantMembership
} from "@/modules/identity/types";

const collections = {
  users: "core_users",
  tenants: "core_tenants",
  memberships: "core_tenant_memberships"
} as const;

let ensureIndexesPromise: Promise<void> | null = null;

export async function ensureIdentityIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = createIdentityIndexes();
  }
  await ensureIndexesPromise;
}

async function createIdentityIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db
      .collection<CoreUser>(collections.users)
      .createIndex({ email: 1 }, { unique: true, name: "uniq_core_user_email" }),
    db
      .collection<CoreUser>(collections.users)
      .createIndex(
        { "xAccount.xUserId": 1 },
        {
          unique: true,
          sparse: true,
          name: "uniq_core_user_x_user_id"
        }
      ),
    db
      .collection<TenantMembership>(collections.memberships)
      .createIndex({ userId: 1, tenantId: 1 }, { unique: true, name: "uniq_membership_user_tenant" }),
    db
      .collection<Tenant>(collections.tenants)
      .createIndex({ slug: 1 }, { unique: true, name: "uniq_tenant_slug" }),
    db
      .collection<Tenant>(collections.tenants)
      .createIndex(
        { isDefault: 1 },
        {
          unique: true,
          partialFilterExpression: { isDefault: true },
          name: "uniq_default_tenant"
        }
      )
  ]);
}

export async function upsertCoreUserByEmail(input: {
  email: string;
  roles: CoreUser["roles"];
  status?: CoreUser["status"];
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const now = new Date();

  await db.collection<CoreUser>(collections.users).updateOne(
    { email },
    {
      $setOnInsert: {
        createdAt: now,
        subscriptionPlan: "free"
      },
      $set: {
        email,
        roles: input.roles,
        status: input.status ?? "active",
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const user = await db.collection<CoreUser>(collections.users).findOne({ email });
  if (!user?._id) {
    throw new Error("Failed to upsert core user");
  }
  return user;
}

export async function getCoreUserByEmail(email: string): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<CoreUser>(collections.users).findOne({ email: normalizeEmail(email) });
}

export async function listCoreUsers(limit = 100): Promise<CoreUser[]> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db
    .collection<CoreUser>(collections.users)
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getCoreUserById(userId: ObjectId): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<CoreUser>(collections.users).findOne({ _id: userId });
}

/**
 * Normalize a Mongo-backed user id to a 24-char hex string for maps and `core_users` lookups.
 * Handles hex strings and BSON ObjectId (legacy `tenant_portfolio` / portfolio rows sometimes store ObjectId).
 */
export function normalizeMongoUserIdHex(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  if (raw instanceof ObjectId) {
    return raw.toHexString();
  }
  if (typeof raw === "object") {
    const maybe = raw as { toHexString?: () => string };
    if (typeof maybe.toHexString === "function") {
      const hex = maybe.toHexString();
      return typeof hex === "string" && hex.length > 0 ? hex : null;
    }
  }
  return null;
}

/** Resolve many core users by hex id (skips invalid ids). Accepts strings or BSON ObjectId from legacy docs. */
export async function getCoreUsersByIds(userIds: ReadonlyArray<unknown>): Promise<Map<string, CoreUser>> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const oids: ObjectId[] = [];
  const seen = new Set<string>();
  for (const raw of userIds) {
    const t = normalizeMongoUserIdHex(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (ObjectId.isValid(t)) {
      oids.push(new ObjectId(t));
    }
  }
  if (oids.length === 0) {
    return new Map();
  }
  const users = await db
    .collection<CoreUser>(collections.users)
    .find({ _id: { $in: oids } })
    .toArray();
  const map = new Map<string, CoreUser>();
  for (const u of users) {
    if (u._id) {
      map.set(u._id.toHexString(), u);
    }
  }
  return map;
}

export function formatCoreUserDisplayName(user: CoreUser | undefined): string {
  if (!user) {
    return "Unknown user";
  }
  const x = user.xAccount;
  const fromX = x?.displayName?.trim() || x?.username?.trim();
  if (fromX) {
    return fromX;
  }
  return user.email || "Unknown user";
}

export async function createCoreUser(input: {
  email: string;
  role: CoreUser["roles"][number];
  subscriptionPlan?: NonNullable<CoreUser["subscriptionPlan"]>;
  status?: CoreUser["status"];
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const document: CoreUser = {
    email: normalizeEmail(input.email),
    roles: [input.role],
    subscriptionPlan: input.subscriptionPlan ?? "free",
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<CoreUser>(collections.users).insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function ensureCoreUserByEmail(input: {
  email: string;
  defaultRoles?: CoreUser["roles"];
  defaultStatus?: CoreUser["status"];
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const now = new Date();

  await db.collection<CoreUser>(collections.users).updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        roles: input.defaultRoles ?? [],
        status: input.defaultStatus ?? "active",
        subscriptionPlan: "free",
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const user = await db.collection<CoreUser>(collections.users).findOne({ email });
  if (!user?._id) {
    throw new Error("Failed to ensure core user");
  }
  return user;
}

export async function getCoreUserByXIdentity(
  xUserId: string
): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<CoreUser>(collections.users).findOne({ "xAccount.xUserId": xUserId });
}

export async function addRoleToCoreUser(input: {
  userId: ObjectId;
  role: CoreUser["roles"][number];
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $addToSet: {
        roles: input.role
      },
      $set: {
        updatedAt: now
      }
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to add role to user");
  }
  return user;
}

export async function updateCoreUserEmail(input: {
  userId: ObjectId;
  email: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const email = normalizeEmail(input.email);
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        email,
        updatedAt: now
      }
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user email");
  }
  return user;
}

export async function updateCoreUserSubscriptionPlan(input: {
  userId: ObjectId;
  subscriptionPlan: NonNullable<CoreUser["subscriptionPlan"]>;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        subscriptionPlan: input.subscriptionPlan,
        updatedAt: now
      }
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user subscription plan");
  }
  return user;
}

export async function updateCoreUserXaiCollection(input: {
  userId: ObjectId;
  xaiCollectionId: string;
  xaiCollectionName?: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const normalizedCollectionId = input.xaiCollectionId.trim();
  if (!normalizedCollectionId) {
    throw new Error("xAI collection id is required");
  }

  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        xaiCollectionId: normalizedCollectionId,
        xaiCollectionName: input.xaiCollectionName?.trim() || undefined,
        updatedAt: now
      }
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user xAI collection");
  }
  return user;
}

export async function updateCoreUserRole(input: {
  userId: ObjectId;
  role: CoreUser["roles"][number];
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        roles: [input.role],
        updatedAt: now
      }
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user role");
  }
  return user;
}

export async function updateCoreUserById(
  userId: ObjectId,
  payload: {
    email?: string;
    role?: CoreUser["roles"][number];
    subscriptionPlan?: NonNullable<CoreUser["subscriptionPlan"]>;
    status?: CoreUser["status"];
  }
): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const update: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (payload.email !== undefined) {
    update.email = normalizeEmail(payload.email);
  }
  if (payload.role !== undefined) {
    update.roles = [payload.role];
  }
  if (payload.subscriptionPlan !== undefined) {
    update.subscriptionPlan = payload.subscriptionPlan;
  }
  if (payload.status !== undefined) {
    update.status = payload.status;
  }

  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: userId },
    {
      $set: update
    }
  );

  return db.collection<CoreUser>(collections.users).findOne({ _id: userId });
}

export async function deleteCoreUserById(userId: ObjectId): Promise<boolean> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const result = await db.collection<CoreUser>(collections.users).deleteOne({ _id: userId });
  return result.deletedCount === 1;
}

export async function recordUserSuccessfulLogin(input: {
  userId: ObjectId;
  clientIp?: string;
  country?: string;
  userAgent?: string;
}): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = {
    lastLoginAt: now,
    updatedAt: now
  };
  if (input.clientIp) {
    $set.lastLoginIp = input.clientIp.slice(0, 64);
  }
  if (input.country) {
    $set.lastLoginCountry = input.country.slice(0, 8);
  }
  if (input.userAgent) {
    $set.lastLoginUserAgent = input.userAgent.slice(0, 256);
  }
  await db.collection<CoreUser>(collections.users).updateOne({ _id: input.userId }, { $set });
}

export async function linkXAccountToUser(input: {
  userId: ObjectId;
  xUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();

  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        "xAccount.xUserId": input.xUserId,
        "xAccount.username": input.username,
        "xAccount.displayName": input.displayName,
        "xAccount.avatarUrl": input.avatarUrl,
        "xAccount.linkedAt": now,
        updatedAt: now,
        lastLoginAt: now
      }
    }
  );

  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to link X account");
  }
  return user;
}

export async function unlinkXAccountFromUser(input: {
  userId: ObjectId;
}): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $unset: {
        xAccount: ""
      },
      $set: {
        updatedAt: new Date()
      }
    }
  );
}

export async function ensureDefaultTenant(): Promise<Tenant> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const slug = "atxfinance-core";

  await db.collection<Tenant>(collections.tenants).updateOne(
    { slug },
    {
      $setOnInsert: {
        slug,
        name: "atxFinance Core",
        createdAt: now
      },
      $set: {
        updatedAt: now,
        isDefault: true
      }
    },
    { upsert: true }
  );

  const tenant = await db.collection<Tenant>(collections.tenants).findOne({ slug });
  if (!tenant?._id) {
    throw new Error("Failed to ensure default tenant");
  }
  return tenant;
}

export async function upsertTenantMembership(input: {
  userId: ObjectId;
  tenantId: ObjectId;
  role: TenantMembership["role"];
  isDefaultTenant: boolean;
}): Promise<TenantMembership> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<TenantMembership>(collections.memberships).updateOne(
    { userId: input.userId, tenantId: input.tenantId },
    {
      $setOnInsert: {
        createdAt: now
      },
      $set: {
        role: input.role,
        isDefaultTenant: input.isDefaultTenant,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const membership = await db.collection<TenantMembership>(collections.memberships).findOne({
    userId: input.userId,
    tenantId: input.tenantId
  });
  if (!membership?._id) {
    throw new Error("Failed to ensure tenant membership");
  }
  return membership;
}

export async function ensureSeededGlobalAdmin(
  adminEmail: string
): Promise<{ user: CoreUser; tenant: Tenant; membership: TenantMembership }> {
  const user = await upsertCoreUserByEmail({
    email: adminEmail,
    roles: ["global_admin"],
    status: "active"
  });
  if (!user._id) {
    throw new Error("Seeded user is missing _id");
  }
  const tenant = await ensureDefaultTenant();
  if (!tenant._id) {
    throw new Error("Default tenant is missing _id");
  }
  const membership = await upsertTenantMembership({
    userId: user._id,
    tenantId: tenant._id,
    role: "tenant_admin",
    isDefaultTenant: true
  });
  return { user, tenant, membership };
}

export async function resolveAuthContext(input: {
  user: CoreUser;
}): Promise<AuthContext> {
  if (!input.user._id) {
    throw new Error("User is missing _id");
  }
  const db = await getDb();
  const membership = await db.collection<TenantMembership>(collections.memberships).findOne({
    userId: input.user._id,
    isDefaultTenant: true
  });
  if (!membership?.tenantId) {
    throw new Error("No default tenant membership for user");
  }

  return {
    userId: input.user._id,
    email: input.user.email,
    roles: input.user.roles,
    tenantId: membership.tenantId,
    tenantRole: membership.role,
    xUserId: input.user.xAccount?.xUserId,
    username: input.user.xAccount?.username,
    displayName: input.user.xAccount?.displayName,
    avatarUrl: input.user.xAccount?.avatarUrl
  };
}

export async function getTenantByHexId(tenantIdHex: string): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<Tenant>(collections.tenants).findOne({ _id: new ObjectId(tenantIdHex) });
}

export async function updateTenantWorkspaceLimits(
  tenantIdHex: string,
  patch: Partial<TenantWorkspaceLimits>
): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(patch) as [keyof TenantWorkspaceLimits, number][]) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 1) {
      $set[`workspaceLimits.${k}`] = v;
    }
  }
  if (Object.keys($set).length <= 1) {
    return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  }
  await db.collection<Tenant>(collections.tenants).updateOne({ _id: id }, { $set });
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

export function resolvedWorkspaceLimitsForTenant(tenant: Tenant | null): TenantWorkspaceLimits {
  return mergeTenantWorkspaceLimits(tenant?.workspaceLimits ?? null);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
