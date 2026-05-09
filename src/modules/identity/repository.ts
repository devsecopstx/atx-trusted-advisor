import { ObjectId } from "mongodb";

import { googleLinkedId, isGoogleLegacyXUserId } from "@/lib/google-oauth-identity";
import { getDb } from "@/lib/mongodb";
import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import { isXfBrandPaletteId } from "@/lib/tenant-branding-palette";
import { MAX_XF_HERO_ICON_URL_CHARS } from "@/lib/tenant-hero-icon-url";
import { MAX_XF_TENANT_LOGO_URL_CHARS } from "@/lib/tenant-logo-url";
import {
    parseXfUiThemePreferenceFromUnknown,
    type XfUiThemePreference
} from "@/lib/xf-ui-theme";
import { purgeEphemeralCoreUserScaffolding } from "@/modules/core-admin/repository";
import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";
import {
    appendLoginAuditRecord,
    type LoginAuditProvider
} from "@/modules/identity/login-audit";
import type { TenantBrandingPreferences } from "@/modules/identity/tenant-branding-preferences";
import { TenantMembershipCapExceededError } from "@/modules/identity/tenant-membership-cap";
import { normalizeTenantIdHexFromStoredMembershipField } from "@/modules/identity/tenant-membership-grounding";
import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";
import {
    mergeTenantWorkspaceLimits,
    type TenantPlanWorkspaceOverrides,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type {
    AuthContext,
    CoreUser,
    CoreUserAccountStatus,
    CoreUserBillingOverride,
    CoreUserOptionsScanPreferences,
    CoreUserStripeSubscriptionStatus,
    Tenant,
    TenantMembership
} from "@/modules/identity/types";
import { deleteTenantTeamXchatAttachmentsCollection } from "@/modules/platform/tenant-xchat-team-collection";

const collections = {
  users: "core_users",
  tenants: "core_tenants",
  memberships: "core_tenant_memberships"
} as const;

let ensureIndexesPromise: Promise<void> | null = null;
const DEFAULT_OPTIONS_SCAN_PREFERENCES: CoreUserOptionsScanPreferences = {
  frequency: "off",
  deliveryChannel: "inapp"
};

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
      ),
    db
      .collection<CoreUser>(collections.users)
      .createIndex(
        { credentialInviteTokenHash: 1 },
        {
          unique: true,
          sparse: true,
          name: "uniq_core_user_credential_invite_token"
        }
      ),
    db
      .collection<CoreUser>(collections.users)
      .createIndex(
        { passwordResetTokenHash: 1 },
        {
          unique: true,
          sparse: true,
          name: "uniq_core_user_password_reset_token"
        }
      ),
    db
      .collection<CoreUser>(collections.users)
      .createIndex(
        { emailVerificationTokenHash: 1 },
        {
          unique: true,
          sparse: true,
          name: "uniq_core_user_email_verification_token"
        }
      )
  ]);
}

export async function upsertCoreUserByEmail(input: {
  email: string;
  roles: CoreUser["roles"];
  status?: CoreUser["status"];
  accountStatus?: CoreUserAccountStatus;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const $set: Record<string, unknown> = {
    email,
    roles: input.roles,
    status: input.status ?? "active",
    updatedAt: now
  };
  if (input.accountStatus !== undefined) {
    $set.accountStatus = input.accountStatus;
  }

  await db.collection<CoreUser>(collections.users).updateOne(
    { email },
    {
      $setOnInsert: {
        createdAt: now,
        subscriptionPlan: "basic"
      },
      $set
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

/**
 * Defensive helper for admin hard-delete flows.
 * In a healthy DB this returns one row because `email` is uniquely indexed.
 */
export async function listCoreUsersByEmail(email: string): Promise<CoreUser[]> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<CoreUser>(collections.users).find({ email: normalizeEmail(email) }).toArray();
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

/** Serialized shape for admin user list/detail (tenant linkage from `core_tenant_memberships`). */
export type AdminUserTenantMembershipJson = {
  tenantId: string;
  slug: string;
  name: string;
  tenantRole: TenantMembership["role"];
  isDefaultSessionTenant: boolean;
};

/**
 * For each user id, returns tenant memberships sorted for display: default session tenant first,
 * then by `updatedAt` descending.
 */
export async function listAdminTenantMembershipsByUserIds(
  userIds: ObjectId[]
): Promise<Map<string, AdminUserTenantMembershipJson[]>> {
  const out = new Map<string, AdminUserTenantMembershipJson[]>();
  if (userIds.length === 0) {
    return out;
  }
  await ensureIdentityIndexes();
  const db = await getDb();

  const duplicateUsers = await db
    .collection<TenantMembership>(collections.memberships)
    .aggregate<{ _id: ObjectId }>([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } }
    ])
    .toArray();
  for (const row of duplicateUsers) {
    if (row._id instanceof ObjectId) {
      await pruneExcessTenantMembershipsForUser(row._id);
    }
  }

  const memberships = await db
    .collection<TenantMembership>(collections.memberships)
    .find({ userId: { $in: userIds } })
    .toArray();

  const tenantHexIds = new Set<string>();
  for (const row of memberships) {
    if (row.tenantId) {
      tenantHexIds.add(row.tenantId.toHexString());
    }
  }
  const tenantOids = [...tenantHexIds].filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const tenants =
    tenantOids.length === 0
      ? []
      : await db
          .collection<Tenant>(collections.tenants)
          .find({ _id: { $in: tenantOids } })
          .project({ slug: 1, name: 1 })
          .toArray();
  const tenantMeta = new Map<string, { slug: string; name: string }>();
  for (const tenant of tenants) {
    if (tenant._id) {
      tenantMeta.set(tenant._id.toHexString(), { slug: tenant.slug, name: tenant.name });
    }
  }

  const byUser = new Map<string, TenantMembership[]>();
  for (const row of memberships) {
    const uid = row.userId?.toHexString();
    if (!uid) {
      continue;
    }
    const bucket = byUser.get(uid) ?? [];
    bucket.push(row);
    byUser.set(uid, bucket);
  }

  for (const [uid, rows] of byUser) {
    const sorted = [...rows].sort((a, b) => {
      if (a.isDefaultTenant !== b.isDefaultTenant) {
        return a.isDefaultTenant ? -1 : 1;
      }
      const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return tb - ta;
    });
    out.set(
      uid,
      sorted.map((row) => {
        const tid = row.tenantId.toHexString();
        const meta = tenantMeta.get(tid);
        return {
          tenantId: tid,
          slug: meta?.slug ?? "(unknown tenant)",
          name: meta?.name ?? "",
          tenantRole: row.role,
          isDefaultSessionTenant: row.isDefaultTenant
        };
      })
    );
  }

  return out;
}

/** One `tenant_admin` row for the platform tenant register (admin UI). */
export type TenantRegisterAdminRow = {
  userId: string;
  email: string;
  displayName: string;
  isDefaultSessionTenant: boolean;
};

/** One `core_tenants` row plus its tenant admins for the platform tenant register. */
export type TenantRegisterRow = {
  tenantId: string;
  slug: string;
  name: string;
  isPlatformDefault: boolean;
  createdAt: string;
  updatedAt: string;
  /** Count of `core_tenant_memberships` rows for this tenant (all roles). */
  membershipCount: number;
  /** xAI team KB for xChat uploads when provisioned (`tenantPreferences`). */
  xchatTeamAttachmentsCollectionId: string | null;
  xchatTeamAttachmentsCollectionName: string | null;
  /** Stored partial from `core_tenants.workspaceLimits` (e.g. seed YAML); null when unset. */
  workspaceLimits: Record<string, unknown> | null;
  /** Stored `core_tenants.tenantPreferences` (branding, xf_ui_theme, flags); null when unset. */
  tenantPreferences: Record<string, unknown> | null;
  tenantAdmins: TenantRegisterAdminRow[];
};

function toTenantRegisterJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * global_admin directory: all tenants from `core_tenants` with `tenant_admin` memberships and user email/display name.
 */
export async function listTenantRegisterForAdmin(): Promise<TenantRegisterRow[]> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const tenants = await db
    .collection<Tenant>(collections.tenants)
    .find({})
    .sort({ slug: 1 })
    .toArray();

  if (tenants.length === 0) {
    return [];
  }

  const tenantObjectIds = tenants.map((t) => t._id).filter((id): id is ObjectId => Boolean(id));
  const memberships = await db
    .collection<TenantMembership>(collections.memberships)
    .find({
      tenantId: { $in: tenantObjectIds },
      role: "tenant_admin"
    })
    .toArray();

  const userHexIds = [
    ...new Set(
      memberships
        .map((m) => m.userId?.toHexString())
        .filter((id): id is string => Boolean(id) && ObjectId.isValid(id))
    )
  ];
  const userObjectIds = userHexIds.map((id) => new ObjectId(id));
  const users =
    userObjectIds.length === 0
      ? []
      : await db
          .collection<CoreUser>(collections.users)
          .find({ _id: { $in: userObjectIds } })
          .project({ email: 1, xAccount: 1 })
          .toArray();
  const userById = new Map(users.filter((u) => u._id).map((u) => [u._id!.toHexString(), u]));

  const adminsByTenantHex = new Map<string, TenantRegisterAdminRow[]>();
  for (const m of memberships) {
    const tid = m.tenantId?.toHexString();
    const uid = m.userId?.toHexString();
    if (!tid || !uid) {
      continue;
    }
    const u = userById.get(uid);
    const email = u?.email ?? "";
    const displayName =
      u?.xAccount?.displayName?.trim() ||
      u?.xAccount?.username?.trim() ||
      email ||
      uid;
    const row: TenantRegisterAdminRow = {
      userId: uid,
      email,
      displayName,
      isDefaultSessionTenant: m.isDefaultTenant
    };
    const bucket = adminsByTenantHex.get(tid) ?? [];
    bucket.push(row);
    adminsByTenantHex.set(tid, bucket);
  }

  for (const rows of adminsByTenantHex.values()) {
    rows.sort((a, b) => {
      if (a.isDefaultSessionTenant !== b.isDefaultSessionTenant) {
        return a.isDefaultSessionTenant ? -1 : 1;
      }
      return a.email.localeCompare(b.email);
    });
  }

  const membershipCountByHex = new Map<string, number>();
  if (tenantObjectIds.length > 0) {
    const grouped = await db
      .collection<TenantMembership>(collections.memberships)
      .aggregate<{ _id: ObjectId; count: number }>([
        { $match: { tenantId: { $in: tenantObjectIds } } },
        { $group: { _id: "$tenantId", count: { $sum: 1 } } }
      ])
      .toArray();
    for (const row of grouped) {
      if (row._id) {
        membershipCountByHex.set(row._id.toHexString(), row.count);
      }
    }
  }

  return tenants
    .filter((t) => t._id)
    .map((t) => {
      const id = t._id!.toHexString();
      const tp = toTenantRegisterJsonObject(t.tenantPreferences);
      let xchatTeamAttachmentsCollectionId: string | null = null;
      let xchatTeamAttachmentsCollectionName: string | null = null;
      if (tp) {
        const cid = tp.xchat_team_attachments_collection_id;
        const cname = tp.xchat_team_attachments_collection_name;
        if (typeof cid === "string" && cid.trim()) {
          xchatTeamAttachmentsCollectionId = cid.trim();
        }
        if (typeof cname === "string" && cname.trim()) {
          xchatTeamAttachmentsCollectionName = cname.trim();
        }
      }
      return {
        tenantId: id,
        slug: t.slug,
        name: t.name,
        isPlatformDefault: Boolean(t.isDefault),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        membershipCount: membershipCountByHex.get(id) ?? 0,
        xchatTeamAttachmentsCollectionId,
        xchatTeamAttachmentsCollectionName,
        workspaceLimits: toTenantRegisterJsonObject(t.workspaceLimits),
        tenantPreferences: tp,
        tenantAdmins: adminsByTenantHex.get(id) ?? []
      };
    });
}

export type DeleteTenantIfNoMembershipsXaiOutcome =
  | "deleted"
  | "already_absent"
  | "no_collection_id"
  | "skipped_no_management_key";

export type DeleteTenantIfNoMembershipsResult =
  | {
      ok: true;
      xaiTeamAttachmentsCollection?: {
        outcome: DeleteTenantIfNoMembershipsXaiOutcome;
        collectionId?: string;
      };
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "HAS_MEMBERS" | "PLATFORM_DEFAULT" | "XAI_COLLECTION_DELETE_FAILED";
      xaiError?: string;
    };

/**
 * Removes `core_tenants` when the tenant has no memberships and is not the platform default row.
 */
export async function deleteTenantIfNoMemberships(tenantIdHex: string): Promise<DeleteTenantIfNoMembershipsResult> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return { ok: false, code: "NOT_FOUND" };
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const tenant = await db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  if (!tenant) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (tenant.isDefault) {
    return { ok: false, code: "PLATFORM_DEFAULT" };
  }
  const n = await db.collection(collections.memberships).countDocuments({ tenantId: id });
  if (n > 0) {
    return { ok: false, code: "HAS_MEMBERS" };
  }

  const xai = await deleteTenantTeamXchatAttachmentsCollection({
    tenantPreferences: tenant.tenantPreferences
  });
  if (xai.status === "failed") {
    return {
      ok: false,
      code: "XAI_COLLECTION_DELETE_FAILED",
      xaiError: xai.message
    };
  }

  const del = await db.collection<Tenant>(collections.tenants).deleteOne({ _id: id });
  if (del.deletedCount !== 1) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const xaiTeamAttachmentsCollection =
    xai.status === "no_collection_id"
      ? { outcome: "no_collection_id" as const }
      : xai.status === "skipped_no_management_key"
        ? { outcome: "skipped_no_management_key" as const, collectionId: xai.collectionId }
        : xai.status === "already_absent"
          ? { outcome: "already_absent" as const, collectionId: xai.collectionId }
          : { outcome: "deleted" as const, collectionId: xai.collectionId };

  return { ok: true, xaiTeamAttachmentsCollection };
}

const SHELL_PREF_KEYS = [
  "xf_accent_color",
  "xf_brand_palette",
  "xf_tenant_logo_url",
  "xf_tenant_tagline",
  "xf_hero_icon_url"
] as const;

/**
 * Applies visual shell keys from `tenantPreferences` (accent, palette, logo, tagline, hero icon).
 * Only keys present on `raw` are considered; other preference keys are left unchanged.
 */
export async function applyTenantShellPreferencesPatch(
  tenantIdHex: string,
  raw: Record<string, unknown>
): Promise<{ tenant: Tenant | null; error?: string }> {
  const hasShellKey = SHELL_PREF_KEYS.some((k) => k in raw);
  if (!hasShellKey) {
    return { tenant: null };
  }
  if (!ObjectId.isValid(tenantIdHex)) {
    return { tenant: null, error: "Invalid tenant id" };
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const existing = await db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  if (!existing?._id) {
    return { tenant: null, error: "Tenant not found" };
  }

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, string> = {};
  let touched = false;

  for (const key of SHELL_PREF_KEYS) {
    if (!(key in raw)) {
      continue;
    }
    touched = true;
    const v = raw[key];
    const path = `tenantPreferences.${key}` as const;

    if (v === null) {
      $unset[path] = "";
      continue;
    }

    if (key === "xf_accent_color") {
      try {
        $set[path] = normalizeXfAccentColor(String(v));
      } catch {
        return { tenant: null, error: "Invalid xf_accent_color" };
      }
      continue;
    }

    if (key === "xf_brand_palette") {
      const s = String(v).trim();
      if (!s) {
        $unset[path] = "";
      } else if (!isXfBrandPaletteId(s)) {
        return { tenant: null, error: "Invalid xf_brand_palette" };
      } else {
        $set[path] = s;
      }
      continue;
    }

    if (key === "xf_tenant_logo_url") {
      const s = String(v).trim();
      if (!s) {
        $unset[path] = "";
      } else if (s.length > MAX_XF_TENANT_LOGO_URL_CHARS) {
        return { tenant: null, error: "xf_tenant_logo_url too long" };
      } else {
        $set[path] = s;
      }
      continue;
    }

    if (key === "xf_tenant_tagline") {
      const s = String(v).trim().slice(0, 60);
      if (!s) {
        $unset[path] = "";
      } else {
        $set[path] = s;
      }
      continue;
    }

    if (key === "xf_hero_icon_url") {
      const s = String(v).trim();
      if (!s) {
        $unset[path] = "";
      } else if (s.length > MAX_XF_HERO_ICON_URL_CHARS) {
        return { tenant: null, error: "xf_hero_icon_url too long" };
      } else {
        $set[path] = s;
      }
    }
  }

  if (!touched) {
    return { tenant: existing };
  }

  const now = new Date();
  const update: Record<string, unknown> = {
    $set: { ...$set, updatedAt: now }
  };
  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }

  await db.collection<Tenant>(collections.tenants).updateOne({ _id: id }, update);
  const updated = await db.collection<Tenant>(collections.tenants).findOne({ _id: id });
  return { tenant: updated ?? null };
}

export async function getCoreUserById(userId: ObjectId): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<CoreUser>(collections.users).findOne({ _id: userId });
}

function parseCoreUserOptionsScanPreferencesFromUnknown(
  raw: unknown
): CoreUserOptionsScanPreferences {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_OPTIONS_SCAN_PREFERENCES };
  }
  const record = raw as Record<string, unknown>;
  const frequency =
    record.frequency === "weekly" || record.frequency === "monthly" || record.frequency === "off"
      ? record.frequency
      : DEFAULT_OPTIONS_SCAN_PREFERENCES.frequency;
  const deliveryChannel =
    record.deliveryChannel === "email" || record.deliveryChannel === "inapp"
      ? record.deliveryChannel
      : DEFAULT_OPTIONS_SCAN_PREFERENCES.deliveryChannel;
  const lastRunAt =
    record.lastRunAt instanceof Date
      ? record.lastRunAt
      : typeof record.lastRunAt === "string"
        ? new Date(record.lastRunAt)
        : undefined;
  return {
    frequency,
    deliveryChannel,
    ...(lastRunAt && !Number.isNaN(lastRunAt.getTime()) ? { lastRunAt } : {})
  };
}

export async function getCoreUserOptionsScanPreferences(
  userId: ObjectId
): Promise<CoreUserOptionsScanPreferences> {
  const user = await getCoreUserById(userId);
  return parseCoreUserOptionsScanPreferencesFromUnknown(user?.optionsScanPreferences);
}

export async function updateCoreUserOptionsScanPreferences(
  userId: ObjectId,
  patch: Partial<CoreUserOptionsScanPreferences>
): Promise<CoreUserOptionsScanPreferences | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const existing = await db.collection<CoreUser>(collections.users).findOne({ _id: userId });
  if (!existing?._id) {
    return null;
  }
  const current = parseCoreUserOptionsScanPreferencesFromUnknown(existing.optionsScanPreferences);
  const next: CoreUserOptionsScanPreferences = {
    frequency:
      patch.frequency === "weekly" || patch.frequency === "monthly" || patch.frequency === "off"
        ? patch.frequency
        : current.frequency,
    deliveryChannel:
      patch.deliveryChannel === "email" || patch.deliveryChannel === "inapp"
        ? patch.deliveryChannel
        : current.deliveryChannel,
    ...(patch.lastRunAt instanceof Date
      ? { lastRunAt: patch.lastRunAt }
      : current.lastRunAt
        ? { lastRunAt: current.lastRunAt }
        : {})
  };
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: userId },
    {
      $set: {
        optionsScanPreferences: next,
        updatedAt: new Date()
      }
    }
  );
  return next;
}

export type TenantOptionsScanUser = {
  userId: ObjectId;
  tenantId: ObjectId;
  email: string;
  roles: CoreUser["roles"];
  subscriptionPlan?: CoreUser["subscriptionPlan"];
  optionsScanPreferences: CoreUserOptionsScanPreferences;
};

export async function listTenantUsersEligibleForOptionsScan(
  tenantId: ObjectId
): Promise<TenantOptionsScanUser[]> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const memberships = await db
    .collection<TenantMembership>(collections.memberships)
    .find({ tenantId })
    .project({ userId: 1, tenantId: 1 })
    .toArray();
  const userIds = memberships
    .map((row) => row.userId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  if (userIds.length === 0) {
    return [];
  }
  const userRows = await db
    .collection<CoreUser>(collections.users)
    .find({ _id: { $in: userIds }, status: "active" })
    .project({
      email: 1,
      roles: 1,
      subscriptionPlan: 1,
      optionsScanPreferences: 1
    })
    .toArray();
  return userRows
    .filter((row) => row._id && typeof row.email === "string")
    .map((row) => ({
      userId: row._id!,
      tenantId,
      email: row.email,
      roles: Array.isArray(row.roles) ? row.roles : [],
      subscriptionPlan: row.subscriptionPlan,
      optionsScanPreferences: parseCoreUserOptionsScanPreferencesFromUnknown(
        row.optionsScanPreferences
      )
    }));
}

export async function getCoreUserXfUiThemePreferenceForHex(
  userIdHex: string
): Promise<XfUiThemePreference | undefined> {
  if (!ObjectId.isValid(userIdHex)) {
    return undefined;
  }
  const user = await getCoreUserById(new ObjectId(userIdHex));
  return parseXfUiThemePreferenceFromUnknown(user?.xfUiTheme);
}

export async function updateCoreUserXfUiThemePreference(
  userIdHex: string,
  theme: XfUiThemePreference
): Promise<boolean> {
  if (!ObjectId.isValid(userIdHex)) {
    return false;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const r = await db.collection<CoreUser>(collections.users).updateOne(
    { _id: new ObjectId(userIdHex) },
    { $set: { xfUiTheme: theme, updatedAt: now } }
  );
  return r.matchedCount > 0;
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
    accountStatus: "approved",
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
        accountStatus: "pending_approval" satisfies CoreUserAccountStatus,
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

function normalizeXUsernameForOAuthLookup(handle: string): string {
  const t = handle.trim();
  if (!t) {
    return "";
  }
  const without = t.startsWith("@") ? t.slice(1) : t;
  return without.toLowerCase();
}

function escapeRegexChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a user for X OAuth: match REST API user id on `xAccount.xUserId` first, then
 * case-insensitive handle on `xAccount.username` or `xAccount.xUserId` (YAML may store a handle there).
 */
export async function getCoreUserByXOAuthIdentity(input: {
  xUserId: string;
  username: string;
}): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const byId = await db.collection<CoreUser>(collections.users).findOne({
    "xAccount.xUserId": input.xUserId
  });
  if (byId) {
    return byId;
  }
  const uname = normalizeXUsernameForOAuthLookup(input.username);
  if (!uname) {
    return null;
  }
  const pattern = new RegExp(`^${escapeRegexChars(uname)}$`, "i");
  return db.collection<CoreUser>(collections.users).findOne({
    $or: [{ "xAccount.username": pattern }, { "xAccount.xUserId": pattern }]
  });
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

export async function updateCoreUserStripeBilling(input: {
  userId: ObjectId;
  subscriptionPlan: NonNullable<CoreUser["subscriptionPlan"]>;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: CoreUserStripeSubscriptionStatus;
  stripeCurrentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = {
    subscriptionPlan: input.subscriptionPlan,
    updatedAt: now,
    "billing.updatedAt": now
  };
  const $unset: Record<string, ""> = {};

  const trimmedCustomer = input.stripeCustomerId?.trim();
  if (trimmedCustomer) {
    $set.stripeCustomerId = trimmedCustomer;
  }

  const trimmedSubscriptionId = input.stripeSubscriptionId?.trim();
  if (trimmedSubscriptionId) {
    $set["billing.stripeSubscriptionId"] = trimmedSubscriptionId;
  } else {
    $unset["billing.stripeSubscriptionId"] = "";
  }

  if (input.stripeSubscriptionStatus) {
    $set["billing.stripeSubscriptionStatus"] = input.stripeSubscriptionStatus;
  } else {
    $unset["billing.stripeSubscriptionStatus"] = "";
  }

  if (input.stripeCurrentPeriodEnd instanceof Date && !Number.isNaN(input.stripeCurrentPeriodEnd.getTime())) {
    $set["billing.stripeCurrentPeriodEnd"] = input.stripeCurrentPeriodEnd;
  } else {
    $unset["billing.stripeCurrentPeriodEnd"] = "";
  }

  if (typeof input.cancelAtPeriodEnd === "boolean") {
    $set["billing.cancelAtPeriodEnd"] = input.cancelAtPeriodEnd;
  } else {
    $unset["billing.cancelAtPeriodEnd"] = "";
  }

  if (input.canceledAt instanceof Date && !Number.isNaN(input.canceledAt.getTime())) {
    $set["billing.canceledAt"] = input.canceledAt;
  } else {
    $unset["billing.canceledAt"] = "";
  }

  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set,
      ...(Object.keys($unset).length > 0 ? { $unset } : {})
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user Stripe billing state");
  }
  return user;
}

export async function updateCoreUserBillingOverride(input: {
  userId: ObjectId;
  override: CoreUserBillingOverride;
  actorUserId?: string;
}): Promise<CoreUser> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = {
    "billing.override.enabled": input.override.enabled,
    "billing.updatedAt": now,
    updatedAt: now
  };
  const $unset: Record<string, ""> = {};
  if (input.override.enabled) {
    $set["billing.override.grantedAt"] = now;
    const actor = input.actorUserId?.trim();
    if (actor) {
      $set["billing.override.grantedByUserId"] = actor;
    } else {
      $unset["billing.override.grantedByUserId"] = "";
    }
    const reason = input.override.reason?.trim();
    if (reason) {
      $set["billing.override.reason"] = reason.slice(0, 280);
    } else {
      $unset["billing.override.reason"] = "";
    }
    if (input.override.expiresAt instanceof Date && !Number.isNaN(input.override.expiresAt.getTime())) {
      $set["billing.override.expiresAt"] = input.override.expiresAt;
    } else {
      $unset["billing.override.expiresAt"] = "";
    }
  } else {
    $unset["billing.override.reason"] = "";
    $unset["billing.override.grantedByUserId"] = "";
    $unset["billing.override.grantedAt"] = "";
    $unset["billing.override.expiresAt"] = "";
  }

  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set,
      ...(Object.keys($unset).length > 0 ? { $unset } : {})
    }
  );
  const user = await db.collection<CoreUser>(collections.users).findOne({ _id: input.userId });
  if (!user?._id) {
    throw new Error("Failed to update user billing override");
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

/**
 * Revokes any live credential links/tokens for the provided users.
 * Used by admin hard-delete paths so invite/reset/verify links are dead before purge/delete.
 */
export async function revokeCredentialLinksForUsers(userIds: ObjectId[]): Promise<number> {
  await ensureIdentityIndexes();
  const ids = userIds.filter((id) => id instanceof ObjectId);
  if (ids.length === 0) {
    return 0;
  }
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<CoreUser>(collections.users).updateMany(
    { _id: { $in: ids } },
    {
      $set: { updatedAt: now },
      $unset: {
        credentialInviteTokenHash: "",
        credentialInviteExpiresAt: "",
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
        emailVerificationTokenHash: "",
        emailVerificationExpiresAt: ""
      }
    }
  );
  return result.modifiedCount;
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

/**
 * Single-tenant policy: each user has at most one `core_tenant_memberships` document.
 * Keeps the preferred row (default session tenant, else newest `updatedAt`), deletes the rest,
 * and sets `isDefaultTenant: true` on the survivor.
 */
export async function pruneExcessTenantMembershipsForUser(userId: ObjectId): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const rows = await db
    .collection<TenantMembership>(collections.memberships)
    .find({ userId })
    .toArray();
  if (rows.length === 0) {
    return;
  }
  const sorted = [...rows].sort((a, b) => {
    if (a.isDefaultTenant !== b.isDefaultTenant) {
      return a.isDefaultTenant ? -1 : 1;
    }
    const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
    const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
    return tb - ta;
  });
  const keep = sorted[0];
  const remove = sorted.slice(1).filter((r): r is TenantMembership & { _id: ObjectId } =>
    Boolean(r._id)
  );
  const now = new Date();
  if (remove.length > 0) {
    await db.collection<TenantMembership>(collections.memberships).deleteMany({
      _id: { $in: remove.map((r) => r._id) }
    });
  }
  if (keep._id) {
    await db.collection<TenantMembership>(collections.memberships).updateOne(
      { _id: keep._id },
      { $set: { isDefaultTenant: true, updatedAt: now } }
    );
  }
}

/** Fails if the tenant already has `maxUsersPerTenant` memberships (unless the user is already on this tenant). */
export async function assertCanAddUserToTenant(input: {
  userId: ObjectId;
  tenantId: ObjectId;
}): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const existingForUser = await db
    .collection<TenantMembership>(collections.memberships)
    .findOne({ userId: input.userId });
  if (existingForUser?.tenantId?.equals(input.tenantId)) {
    return;
  }
  await assertTenantHasRoomForAnotherUser(input.tenantId);
}

/** For a net-new member (no membership row yet), or any assignee not already on this tenant. */
export async function assertTenantHasRoomForAnotherUser(tenantId: ObjectId): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const tenantDoc = await db.collection<Tenant>(collections.tenants).findOne({ _id: tenantId });
  const sourceTenant = await resolveWorkspaceLimitsSourceTenant({
    tenant: tenantDoc ?? null
  });
  const cap = mergeTenantWorkspaceLimits(sourceTenant?.workspaceLimits ?? null).maxUsersPerTenant;
  const n = await db.collection(collections.memberships).countDocuments({ tenantId });
  if (n >= cap) {
    throw new TenantMembershipCapExceededError(tenantId.toHexString(), cap, n);
  }
}

export async function upsertTenantMembership(input: {
  userId: ObjectId;
  tenantId: ObjectId;
  role: TenantMembership["role"];
  isDefaultTenant: boolean;
}): Promise<TenantMembership> {
  await assertCanAddUserToTenant({ userId: input.userId, tenantId: input.tenantId });

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

  await db.collection<TenantMembership>(collections.memberships).deleteMany({
    userId: input.userId,
    tenantId: { $ne: input.tenantId }
  });

  const nowDefault = new Date();
  await db.collection<TenantMembership>(collections.memberships).updateOne(
    { userId: input.userId, tenantId: input.tenantId },
    { $set: { isDefaultTenant: true, updatedAt: nowDefault } }
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

export async function updateCoreUserAccountStatus(input: {
  userId: ObjectId;
  accountStatus: CoreUserAccountStatus;
}): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: input.userId },
    {
      $set: {
        accountStatus: input.accountStatus,
        updatedAt: new Date()
      }
    }
  );
}

export async function ensureSeededGlobalAdmin(
  adminEmail: string
): Promise<{ user: CoreUser; tenant: Tenant; membership: TenantMembership }> {
  const user = await upsertCoreUserByEmail({
    email: adminEmail,
    roles: ["global_admin"],
    status: "active",
    accountStatus: "approved"
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

/**
 * Membership row the session uses as the active tenant (`isDefaultTenant: true`).
 * When multiple rows are erroneously true (legacy / bugs), prefers the most recently updated.
 */
/**
 * If multiple rows have `isDefaultTenant: true` (legacy / race), keeps the newest `updatedAt` and clears the rest.
 */
export async function dedupeDefaultTenantMembershipsForUser(userId: ObjectId): Promise<void> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const rows = await db
    .collection<TenantMembership>(collections.memberships)
    .find({ userId, isDefaultTenant: true })
    .sort({ updatedAt: -1 })
    .toArray();
  if (rows.length <= 1) {
    return;
  }
  const now = new Date();
  const [, ...stale] = rows;
  await Promise.all(
    stale
      .filter((r) => r._id)
      .map((r) =>
        db.collection<TenantMembership>(collections.memberships).updateOne(
          { _id: r._id },
          { $set: { isDefaultTenant: false, updatedAt: now } }
        )
      )
  );
}

export async function getDefaultTenantMembershipForUser(
  userId: ObjectId
): Promise<TenantMembership | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const rows = await db
    .collection<TenantMembership>(collections.memberships)
    .find({ userId, isDefaultTenant: true })
    .sort({ updatedAt: -1 })
    .limit(1)
    .toArray();
  return rows[0] ?? null;
}

export async function getTenantMembershipForUserAndTenant(
  userId: ObjectId,
  tenantId: ObjectId
): Promise<TenantMembership | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  return db.collection<TenantMembership>(collections.memberships).findOne({ userId, tenantId });
}

/**
 * Session grounding: prefer canonical `{ userId, tenantId }` ObjectIds, then fall back to scanning
 * the user's membership rows with normalized tenant-id comparison (legacy BSON / string drift).
 */
export async function resolveTenantMembershipForSessionGrounding(
  userId: ObjectId,
  tenantIdHex: string
): Promise<TenantMembership | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  const tenantOid = new ObjectId(tenantIdHex);
  const direct = await getTenantMembershipForUserAndTenant(userId, tenantOid);
  if (direct?._id) {
    return direct;
  }

  await ensureIdentityIndexes();
  const db = await getDb();
  const wantHex = tenantOid.toHexString();
  const rows = (await db
    .collection(collections.memberships)
    .find({
      userId: { $in: [userId, userId.toHexString()] }
    })
    .limit(50)
    .toArray()) as TenantMembership[];

  for (const row of rows) {
    const rowHex = normalizeTenantIdHexFromStoredMembershipField(row.tenantId);
    if (rowHex === wantHex) {
      return row;
    }
  }
  return null;
}

export async function resolveAuthContext(input: {
  user: CoreUser;
}): Promise<AuthContext> {
  if (!input.user._id) {
    throw new Error("User is missing _id");
  }
  const membership = await getDefaultTenantMembershipForUser(input.user._id);
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

export async function getTenantXfUiThemePreferenceForHex(
  tenantIdHex: string
): Promise<XfUiThemePreference | undefined> {
  const tenant = await getTenantByHexId(tenantIdHex);
  const raw = tenant?.tenantPreferences?.xf_ui_theme;
  return parseXfUiThemePreferenceFromUnknown(raw);
}

/**
 * Shell personalization from `core_tenants.tenantPreferences` (accent, optional logo URL / tagline).
 * Accent falls back to {@link DEFAULT_TENANT_ACCENT_HEX} when unset or invalid.
 */
export async function getTenantShellBrandingForHex(tenantIdHex: string): Promise<TenantShellBranding | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  const tenant = await getTenantByHexId(tenantIdHex);
  if (!tenant) {
    return null;
  }
  const p = tenant.tenantPreferences;
  let accentColor = DEFAULT_TENANT_ACCENT_HEX;
  try {
    const raw =
      p && typeof p === "object" && p !== null
        ? (p as Record<string, unknown>).xf_accent_color
        : undefined;
    if (raw !== undefined && raw !== null && String(raw).trim()) {
      accentColor = normalizeXfAccentColor(raw);
    }
  } catch {
    accentColor = DEFAULT_TENANT_ACCENT_HEX;
  }
  const logoUrl =
    p && typeof p === "object" && p !== null
      ? String((p as Record<string, unknown>).xf_tenant_logo_url ?? "").trim() || undefined
      : undefined;
  const tagline =
    p && typeof p === "object" && p !== null
      ? String((p as Record<string, unknown>).xf_tenant_tagline ?? "").trim().slice(0, 60) || undefined
      : undefined;
  const displayName = String(tenant.name ?? "").trim() || tenant.slug;
  return { displayName, accentColor, logoUrl, tagline };
}

export async function updateTenantXfUiThemePreference(
  tenantIdHex: string,
  theme: XfUiThemePreference | null
): Promise<Tenant | null> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  await ensureIdentityIndexes();
  const db = await getDb();
  const id = new ObjectId(tenantIdHex);
  const now = new Date();
  if (theme === null) {
    await db.collection<Tenant>(collections.tenants).updateOne(
      { _id: id },
      { $unset: { "tenantPreferences.xf_ui_theme": "" }, $set: { updatedAt: now } }
    );
  } else {
    await db.collection<Tenant>(collections.tenants).updateOne(
      { _id: id },
      { $set: { "tenantPreferences.xf_ui_theme": theme, updatedAt: now } }
    );
  }
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

/** Matches `DEFAULT_TENANT_SLUG` in `scripts/seed-admin-user.mjs`. */
const SEED_DEFAULT_TENANT_SLUG = "atxfinance-core";

function tenantWorkspaceLimitsOverrideEnabled(tenant: Tenant | null): boolean {
  if (!tenant) {
    return false;
  }
  if (tenant.isDefault) {
    return true;
  }
  return tenant.tenantPreferences?.workspace_limits_override_enabled === true;
}

async function resolveWorkspaceLimitsSourceTenant(input: {
  tenant: Tenant | null;
}): Promise<Tenant | null> {
  const { tenant } = input;
  if (tenantWorkspaceLimitsOverrideEnabled(tenant)) {
    return tenant;
  }
  const fallbackTenantId = await resolveTenantIdHexForGlobalAdminConsole(undefined);
  if (!fallbackTenantId) {
    return tenant;
  }
  const fallbackTenant = await getTenantByHexId(fallbackTenantId);
  if (!fallbackTenant?._id) {
    return tenant;
  }
  return fallbackTenant;
}

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
    if (k === "userChatHourlyLimit") {
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000) {
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

/**
 * Toggle `tenantPreferences.ambient_market_veil` (global_admin — Admin → Tenant
 * preferences → Ambient experience). Pass `null` to **clear** (returns to default-on),
 * `true` to explicitly enable, `false` to opt out for the tenant.
 */
export async function updateTenantAmbientMarketVeil(
  tenantIdHex: string,
  enabled: boolean | null
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
    enabled === null
      ? { $unset: { "tenantPreferences.ambient_market_veil": "" }, $set: { updatedAt: now } }
      : { $set: { "tenantPreferences.ambient_market_veil": enabled, updatedAt: now } }
  );
  return db.collection<Tenant>(collections.tenants).findOne({ _id: id });
}

export async function resolvedWorkspaceLimitsForTenant(
  tenant: Tenant | null
): Promise<TenantWorkspaceLimits> {
  const sourceTenant = await resolveWorkspaceLimitsSourceTenant({ tenant });
  return mergeTenantWorkspaceLimits(sourceTenant?.workspaceLimits ?? null);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
