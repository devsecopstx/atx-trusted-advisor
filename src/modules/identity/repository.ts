import { ObjectId } from "mongodb";

import { googleLinkedId, isGoogleLegacyXUserId } from "@/lib/google-oauth-identity";
import { getDb } from "@/lib/mongodb";
import { purgeEphemeralCoreUserScaffolding } from "@/modules/core-admin/repository";
import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";
import {
    appendLoginAuditRecord,
    type LoginAuditProvider
} from "@/modules/identity/login-audit";
import type { TenantBrandingPreferences } from "@/modules/identity/tenant-branding-preferences";
import {
    mergeTenantWorkspaceLimits,
    type TenantPlanWorkspaceOverrides,
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
      .collection<CoreUser>(collections.users)
      .createIndex(
        { "googleAccount.sub": 1 },
        {
          unique: true,
          sparse: true,
          name: "uniq_core_user_google_sub"
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
        subscriptionPlan: "basic"
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
  const g = user.googleAccount;
  const fromGoogle = g?.displayName?.trim() || g?.username?.trim();
  if (fromGoogle) {
    return fromGoogle;
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
    subscriptionPlan: input.subscriptionPlan ?? "basic",
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
        subscriptionPlan: "basic",
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

export async function getCoreUserByGoogleSub(sub: string): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const trimmed = sub.trim();
  if (!trimmed) {
    return null;
  }
  const db = await getDb();
  const legacyId = googleLinkedId(trimmed);
  return db.collection<CoreUser>(collections.users).findOne({
    $or: [{ "googleAccount.sub": trimmed }, { "xAccount.xUserId": legacyId }]
  });
}

export async function linkGoogleAccountToUser(input: {
  userId: ObjectId;
  sub: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const sub = input.sub.trim();
  const existing = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (existing?.xAccount?.xUserId && isGoogleLegacyXUserId(existing.xAccount.xUserId)) {
    await db.collection<CoreUser>(collections.users).updateOne(
      { _id: input.userId },
      { $unset: { xAccount: "" }, $set: { updatedAt: now } }
    );
  }

  const $set: Record<string, unknown> = {
    "googleAccount.sub": sub,
    "googleAccount.linkedAt": now,
    "googleAccount.username": input.username,
    updatedAt: now,
    lastLoginAt: now
  };
  if (input.displayName !== undefined) {
    $set["googleAccount.displayName"] = input.displayName;
  }
  if (input.avatarUrl !== undefined) {
    $set["googleAccount.avatarUrl"] = input.avatarUrl;
  }

  await db.collection<CoreUser>(collections.users).updateOne({ _id: input.userId }, { $set });

  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to link Google account");
  }
  return user;
}

export async function unlinkGoogleIdentityFromUser(input: { userId: ObjectId }): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const existing = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  const $unset: Record<string, ""> = { googleAccount: "" };
  if (existing?.xAccount?.xUserId && isGoogleLegacyXUserId(existing.xAccount.xUserId)) {
    $unset.xAccount = "";
  }
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $unset,
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Merges an X-only placeholder `core_users` row into the account that already has this real email
 * (e.g. Google OAuth). Frees `xAccount.xUserId` for {@link linkXAccountToUser}.
 */
export async function mergePlaceholderXUserIntoEmailUser(input: {
  canonicalUserId: ObjectId;
  placeholderUser: CoreUser;
  xIdentity: {
    xUserId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}): Promise<CoreUser> {
  const { canonicalUserId, placeholderUser, xIdentity } = input;
  if (!placeholderUser._id) {
    throw new Error("Placeholder user is missing _id");
  }
  if (placeholderUser._id.equals(canonicalUserId)) {
    throw new Error("Canonical and placeholder users must differ");
  }
  const phId = placeholderUser._id.toHexString();
  await purgeEphemeralCoreUserScaffolding(phId);
  const deleted = await deleteCoreUserById(placeholderUser._id);
  if (!deleted) {
    throw new Error("Failed to delete placeholder core user");
  }
  return linkXAccountToUser({
    userId: canonicalUserId,
    ...xIdentity
  });
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
  /** When set (non-empty), persisted on `core_users` for Stripe Customer Portal. */
  stripeCustomerId?: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const setDoc: Partial<CoreUser> & { updatedAt: Date } = {
    subscriptionPlan: input.subscriptionPlan,
    updatedAt: now
  };
  const trimmedCustomer = input.stripeCustomerId?.trim();
  if (trimmedCustomer) {
    setDoc.stripeCustomerId = trimmedCustomer;
  }
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: setDoc
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

export type CoreUserBackofficePatch = {
  subscriptionPlan?: NonNullable<CoreUser["subscriptionPlan"]>;
  status?: CoreUser["status"];
  roles?: CoreUser["roles"];
  email?: string;
  xAccountDisplayName?: string;
  xAccountUsername?: string;
  xAccountAvatarUrl?: string | null;
  xaiCollectionId?: string | null;
  xaiCollectionName?: string | null;
};

export async function lookupCoreUserBackoffice(input: {
  by: "email" | "id";
  value: string;
}): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  if (input.by === "email") {
    return db.collection<CoreUser>(collections.users).findOne({ email: normalizeEmail(input.value) });
  }
  const trimmed = input.value.trim();
  if (!ObjectId.isValid(trimmed)) {
    return null;
  }
  return db.collection<CoreUser>(collections.users).findOne({ _id: new ObjectId(trimmed) });
}

export async function patchCoreUserBackoffice(
  userId: ObjectId,
  patch: CoreUserBackofficePatch
): Promise<
  | { ok: true; user: CoreUser }
  | { ok: false; code: "not_found" | "x_account_required" | "duplicate_email" }
> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const existing = await db.collection<CoreUser>(collections.users).findOne({ _id: userId });
  if (!existing?._id) {
    return { ok: false, code: "not_found" };
  }

  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  const $unset: Record<string, ""> = {};

  if (patch.subscriptionPlan !== undefined) {
    $set.subscriptionPlan = patch.subscriptionPlan;
  }
  if (patch.status !== undefined) {
    $set.status = patch.status;
  }
  if (patch.roles !== undefined) {
    $set.roles = patch.roles;
  }
  if (patch.email !== undefined) {
    $set.email = normalizeEmail(patch.email);
  }

  const needsXAccount =
    patch.xAccountDisplayName !== undefined ||
    patch.xAccountUsername !== undefined ||
    patch.xAccountAvatarUrl !== undefined;
  if (needsXAccount && !existing.xAccount) {
    return { ok: false, code: "x_account_required" };
  }
  if (patch.xAccountDisplayName !== undefined) {
    const t = patch.xAccountDisplayName.trim();
    if (t.length === 0) {
      $unset["xAccount.displayName"] = "";
    } else {
      $set["xAccount.displayName"] = t.slice(0, 200);
    }
  }
  if (patch.xAccountUsername !== undefined) {
    const t = patch.xAccountUsername.trim();
    if (t.length > 0) {
      $set["xAccount.username"] = t.slice(0, 200);
    }
  }
  if (patch.xAccountAvatarUrl !== undefined) {
    if (patch.xAccountAvatarUrl === null || patch.xAccountAvatarUrl === "") {
      $unset["xAccount.avatarUrl"] = "";
    } else {
      $set["xAccount.avatarUrl"] = patch.xAccountAvatarUrl.trim().slice(0, 500);
    }
  }

  if (patch.xaiCollectionId !== undefined) {
    if (patch.xaiCollectionId === null || patch.xaiCollectionId === "") {
      $unset.xaiCollectionId = "";
    } else {
      $set.xaiCollectionId = patch.xaiCollectionId.trim();
    }
  }
  if (patch.xaiCollectionName !== undefined) {
    if (patch.xaiCollectionName === null || patch.xaiCollectionName === "") {
      $unset.xaiCollectionName = "";
    } else {
      $set.xaiCollectionName = patch.xaiCollectionName.trim().slice(0, 200);
    }
  }

  try {
    await db.collection<CoreUser>(collections.users).updateOne(
      { _id: userId },
      {
        $set,
        ...(Object.keys($unset).length > 0 ? { $unset } : {})
      }
    );
  } catch (error) {
    const isDuplicate = error instanceof Error && /E11000/.test(error.message);
    if (isDuplicate) {
      return { ok: false, code: "duplicate_email" };
    }
    throw error;
  }

  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: userId });
  if (!user?._id) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, user };
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
  /** When set, appends a row to `audit_login` with outcome success. */
  audit?: {
    provider: LoginAuditProvider;
    xUserId?: string;
    username?: string;
    email?: string;
  };
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

  if (input.audit) {
    await appendLoginAuditRecord({
      outcome: "success",
      provider: input.audit.provider,
      clientIp: input.clientIp,
      country: input.country,
      userAgent: input.userAgent,
      userId: input.userId.toHexString(),
      xUserId: input.audit.xUserId,
      username: input.audit.username,
      email: input.audit.email
    });
  }
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

/** Default `core_tenant_memberships` row for this user, if any (e.g. after a prior OAuth login). */
export async function getDefaultTenantIdHexForCoreUser(userIdHex: string): Promise<string | null> {
  if (!ObjectId.isValid(userIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const membership = await db.collection<TenantMembership>(collections.memberships).findOne({
    userId: new ObjectId(userIdHex),
    isDefaultTenant: true
  });
  const tid = membership?.tenantId;
  return tid ? tid.toHexString() : null;
}

/**
 * Tenant id for portfolio/account provisioning when an access request is approved: the applicant's
 * default membership tenant if present, else the platform default tenant (same as OAuth finalize).
 * Must not use the approving admin's `session.tenantId` — it can differ and strand book data where
 * the applicant's session cannot read it (then the UI provisions a second default book).
 */
export async function resolveTenantIdForApprovedUserPortfolio(userIdHex: string): Promise<string> {
  const fromMembership = await getDefaultTenantIdHexForCoreUser(userIdHex);
  if (fromMembership) {
    return fromMembership;
  }
  const tenant = await ensureDefaultTenant();
  if (!tenant._id) {
    throw new Error("Failed to resolve tenant for approved user portfolio");
  }
  return tenant._id.toHexString();
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

  const g = input.user.googleAccount;
  const x = input.user.xAccount;
  const xUserId =
    x?.xUserId ??
    (g?.sub ? googleLinkedId(g.sub) : undefined);
  const username = x?.username ?? g?.username;
  const displayName = x?.displayName ?? g?.displayName;
  const avatarUrl = x?.avatarUrl ?? g?.avatarUrl;

  return {
    userId: input.user._id,
    email: input.user.email,
    roles: input.user.roles,
    tenantId: membership.tenantId,
    tenantRole: membership.role,
    xUserId,
    username,
    displayName,
    avatarUrl
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

/** Matches `DEFAULT_TENANT_SLUG` in `scripts/seed-admin-user.mjs`. */
const SEED_DEFAULT_TENANT_SLUG = "atxfinance-core";

/**
 * Resolves which `core_tenants._id` the admin console should use for tenant-scoped rows.
 *
 * After switching `MONGODB_URI` / `MONGODB_DB_NAME` or re-seeding a fresh database, the session cookie can still
 * hold a **previous** tenant ObjectId that no longer exists → workspace limits 404, empty tasks/delivery channels.
 * For `global_admin` routes we fall back to the seeded default tenant (or any default / first tenant).
 */
export async function resolveTenantIdHexForGlobalAdminConsole(
  sessionTenantIdHex: string | undefined
): Promise<string | null> {
  const trimmed = String(sessionTenantIdHex ?? "").trim();
  if (trimmed && ObjectId.isValid(trimmed)) {
    const hit = await getTenantByHexId(trimmed);
    if (hit?._id) {
      return hit._id.toHexString();
    }
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const bySlug = await db
    .collection<Tenant>(collections.tenants)
    .findOne({ slug: SEED_DEFAULT_TENANT_SLUG });
  if (bySlug?._id) {
    return bySlug._id.toHexString();
  }
  const byDefault = await db
    .collection<Tenant>(collections.tenants)
    .findOne({ isDefault: true }, { sort: { _id: 1 } });
  if (byDefault?._id) {
    return byDefault._id.toHexString();
  }
  const any = await db.collection<Tenant>(collections.tenants).findOne({}, { sort: { _id: 1 } });
  return any?._id?.toHexString() ?? null;
}

export async function updateTenantWorkspaceLimits(
  tenantIdHex: string,
  patch: Partial<TenantWorkspaceLimits>,
  planOverrides?: TenantPlanWorkspaceOverrides | null
): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(patch) as [keyof TenantWorkspaceLimits, unknown][]) {
    if (k === "changePersonaEnabled") {
      if (typeof v === "boolean") {
        $set[`workspaceLimits.${k}`] = v;
      }
      continue;
    }
    if (typeof v === "number" && Number.isInteger(v) && v >= 1) {
      $set[`workspaceLimits.${k}`] = v;
    }
  }
  if (planOverrides !== undefined && planOverrides !== null) {
    $set["workspaceLimits.planOverrides"] = planOverrides;
  }
  if (Object.keys($set).length <= 1) {
    return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  }
  await db.collection<Tenant>(collections.tenants).updateOne({ _id: id }, { $set });
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

export async function updateTenantDefaultPortfolioScoringFactors(
  tenantIdHex: string,
  factors: PortfolioScoringFactor[] | null
): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const now = new Date();
  if (factors === null) {
    await db.collection<Tenant>(collections.tenants).updateOne(
      { _id: id },
      { $unset: { defaultPortfolioScoringFactors: "" }, $set: { updatedAt: now } }
    );
  } else {
    await db.collection<Tenant>(collections.tenants).updateOne(
      { _id: id },
      { $set: { defaultPortfolioScoringFactors: factors, updatedAt: now } }
    );
  }
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

export async function updateTenantBrandingPreferencesOneTime(
  tenantIdHex: string,
  patch: Partial<TenantBrandingPreferences>
): Promise<{ tenant: Tenant | null; conflictKeys: (keyof TenantBrandingPreferences)[] }> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return { tenant: null, conflictKeys: [] };
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const tenant = await db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  if (!tenant?._id) {
    return { tenant: null, conflictKeys: [] };
  }

  const existing = tenant.tenantPreferences ?? {};
  const toSet: Partial<TenantBrandingPreferences> = {};
  const conflictKeys: (keyof TenantBrandingPreferences)[] = [];
  const keys: (keyof TenantBrandingPreferences)[] = ["xchat_brandname", "xstrategybuilder_brandname"];
  for (const key of keys) {
    const nextValue = patch[key];
    if (!nextValue) {
      continue;
    }
    const currentValue = existing[key]?.trim();
    if (currentValue) {
      if (currentValue !== nextValue) {
        conflictKeys.push(key);
      }
      continue;
    }
    toSet[key] = nextValue;
  }

  if (conflictKeys.length > 0) {
    return { tenant, conflictKeys };
  }
  if (Object.keys(toSet).length === 0) {
    return { tenant, conflictKeys: [] };
  }

  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(toSet) as [keyof TenantBrandingPreferences, string][]) {
    $set[`tenantPreferences.${k}`] = v;
  }
  await db.collection<Tenant>(collections.tenants).updateOne({ _id: id }, { $set });
  const updated = await db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  return { tenant: updated, conflictKeys: [] };
}

/** Toggle `tenantPreferences.xchat_debug_enabled` (global_admin — Admin → Tenant workspace). */
export async function updateTenantXchatDebugEnabled(
  tenantIdHex: string,
  enabled: boolean
): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const now = new Date();
  await db.collection<Tenant>(collections.tenants).updateOne(
    { _id: id },
    { $set: { "tenantPreferences.xchat_debug_enabled": enabled, updatedAt: now } }
  );
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

export function resolvedWorkspaceLimitsForTenant(tenant: Tenant | null): TenantWorkspaceLimits {
  return mergeTenantWorkspaceLimits(tenant?.workspaceLimits ?? null);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
