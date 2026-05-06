import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

import type { ParsedInitialTenantAdmin, ParsedTenantSpecV1 } from "@/lib/tenant-spec-v1-parse";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import { upsertTenantMembership } from "@/modules/identity/repository";
import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";
import {
    coalesceTenantWorkspaceLimitsForPersistence,
    tenantWorkspaceLimitsScalarsMissing
} from "@/modules/identity/tenant-workspace-limits";
import { bootstrapPolicyToMongoShape } from "@/modules/platform/tenant-bootstrap-policy";
import { ensureCoreTenantRentalIndexes } from "@/modules/platform/tenant-rental-indexes";
import { finalizeTenantRentalProvisioning } from "@/modules/platform/tenant-rental-provision";
import { ensureTenantTeamXchatAttachmentsCollection } from "@/modules/platform/tenant-xchat-team-collection";

export async function ensureTenantProvisionIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("core_tenants").createIndex({ slug: 1 }, { unique: true, name: "uniq_tenant_slug" }),
    db.collection("core_tenants").createIndex(
      { isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_tenant"
      }
    ),
    db.collection("core_users").createIndex({ email: 1 }, { unique: true, name: "uniq_core_user_email" }),
    db.collection("core_users").createIndex(
      { "xAccount.xUserId": 1 },
      { unique: true, sparse: true, name: "uniq_core_user_x_user_id" }
    ),
    db.collection("core_tenant_memberships").createIndex(
      { userId: 1, tenantId: 1 },
      { unique: true, name: "uniq_membership_user_tenant" }
    )
  ]);
  await ensureCoreTenantRentalIndexes(db);
}

async function provisionInitialTenantAdmin(
  db: Db,
  tenantId: ObjectId,
  admin: ParsedInitialTenantAdmin,
  now: Date
): Promise<void> {
  const users = db.collection("core_users");
  const email = admin.email;

  const existing = await users.findOne({ email });
  const platformRole = admin.platformRole;
  let roles: string[];
  if (!existing) {
    roles = [platformRole];
  } else {
    const prev = Array.isArray(existing.roles) ? existing.roles.map(String) : [];
    roles = [...new Set([...prev, platformRole])];
  }

  await users.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        createdAt: now,
        subscriptionPlan: "basic"
      },
      $set: {
        roles,
        status: "active",
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const user = await users.findOne({ email });
  if (!user?._id) {
    throw new Error("Failed to upsert core user for initialTenantAdmin");
  }

  if (admin.xUserId) {
    const holder = await users.findOne({
      "xAccount.xUserId": admin.xUserId,
      email: { $ne: email }
    });
    if (holder) {
      throw new Error(
        `[seed:tenant] initialTenantAdmin.xUserId "${admin.xUserId}" is already linked to ${holder.email}`
      );
    }
    const xSet: Record<string, unknown> = {
      "xAccount.xUserId": admin.xUserId,
      "xAccount.username": user.xAccount?.username || admin.xUserId,
      "xAccount.linkedAt": now,
      updatedAt: now
    };
    if (user.xAccount?.displayName) {
      xSet["xAccount.displayName"] = user.xAccount.displayName;
    }
    await users.updateOne({ _id: user._id }, { $set: xSet });
  }

  await upsertTenantMembership({
    userId: user._id,
    tenantId,
    role: "tenant_admin",
    isDefaultTenant: true
  });
}

export type UpsertTenantFromSpecResult = {
  tenantId: string;
  slug: string;
  name: string;
  provisionedInitialAdmin: boolean;
  /** Present when xAI team attachments collection was resolved or already stored (requires `XAI_TEAM_ID` + management key). */
  xchatTeamAttachments?: {
    collectionId: string;
    collectionName: string;
    alreadyConfigured: boolean;
  };
};

/**
 * Same Mongo writes as `scripts/seed-tenant-from-spec.ts` — upserts `core_tenants` and optional initial admin.
 *
 * **Hang during `seed:tenant`:** the final step may call the **xAI Management API** (list/create collection).
 * Slow or broken network can stall indefinitely (`fetch` has no timeout). Set
 * **`SKIP_SEED_TENANT_XCHAT_TEAM_COLLECTION=1`** to skip that step (tenant row + rental persona still apply).
 */
export async function upsertTenantFromParsedSpecV1(
  db: Db,
  parsed: ParsedTenantSpecV1
): Promise<UpsertTenantFromSpecResult> {
  const now = new Date();
  await ensureTenantProvisionIndexes(db);

  const $set: Record<string, unknown> = {
    name: parsed.name,
    isDefault: false,
    updatedAt: now
  };
  if (parsed.workspaceLimits) {
    $set.workspaceLimits = parsed.workspaceLimits;
  }
  if (parsed.tenantPreferencesBranding) {
    for (const [k, v] of Object.entries(parsed.tenantPreferencesBranding)) {
      $set[`tenantPreferences.${k}`] = v;
    }
  }
  if (parsed.tenantXfUiTheme) {
    $set["tenantPreferences.xf_ui_theme"] = parsed.tenantXfUiTheme;
  }
  if (parsed.rentalProfile) {
    $set.rentalProfile = parsed.rentalProfile;
  }
  if (parsed.bootstrapPolicy) {
    $set["tenantPreferences.bootstrap_policy"] = bootstrapPolicyToMongoShape(parsed.bootstrapPolicy);
  }
  if (parsed.bootstrapOnApprove !== undefined) {
    $set["tenantPreferences.bootstrap_on_approve"] = parsed.bootstrapOnApprove;
  }
  if (parsed.watchlistSeedSymbols) {
    $set["tenantPreferences.watchlist_seed_symbols"] = parsed.watchlistSeedSymbols;
  }

  await db.collection("core_tenants").updateOne(
    { slug: parsed.slug },
    {
      $set,
      $setOnInsert: {
        slug: parsed.slug,
        createdAt: now
      }
    },
    { upsert: true }
  );

  const tenant = await db.collection("core_tenants").findOne({ slug: parsed.slug });
  if (!tenant?._id) {
    throw new Error("Upsert failed — tenant row missing after update");
  }

  const tenantId = tenant._id as ObjectId;

  if (tenantWorkspaceLimitsScalarsMissing(tenant.workspaceLimits)) {
    await db.collection("core_tenants").updateOne(
      { _id: tenantId },
      {
        $set: {
          workspaceLimits: coalesceTenantWorkspaceLimitsForPersistence(tenant.workspaceLimits),
          updatedAt: now
        }
      }
    );
  }

  if (parsed.initialTenantAdmin) {
    await provisionInitialTenantAdmin(db, tenantId, parsed.initialTenantAdmin, now);
    const userRow = await db.collection("core_users").findOne({ email: parsed.initialTenantAdmin.email });
    if (userRow?._id) {
      try {
        await ensureTenantBootstrapForUser({
          userId: userRow._id.toHexString(),
          tenantId: tenantId.toHexString(),
          trigger: "seed_tenant"
        });
      } catch (e) {
        console.warn(
          "[tenant-spec] initialTenantAdmin bootstrap non-fatal:",
          e instanceof Error ? e.message : e
        );
      }
    }
  }

  if (parsed.rentalProfile) {
    console.info("[tenant-spec] Finalize rental persona + sample portfolio (Mongo)…");
    await finalizeTenantRentalProvisioning(db, {
      tenantId,
      tenantSlug: parsed.slug,
      rentalProfile: parsed.rentalProfile
    });
  }

  const refreshed = await db.collection("core_tenants").findOne({ _id: tenantId });
  const prefs = refreshed?.tenantPreferences as TenantPreferences | null | undefined;

  const skipXchatTeamCollection = String(
    process.env.SKIP_SEED_TENANT_XCHAT_TEAM_COLLECTION ?? ""
  ).match(/^(1|true|yes)$/i);

  let xchatEnsured: Awaited<ReturnType<typeof ensureTenantTeamXchatAttachmentsCollection>> = null;

  if (skipXchatTeamCollection) {
    console.warn(
      "[tenant-spec] SKIP_SEED_TENANT_XCHAT_TEAM_COLLECTION set — skipping xAI management API (team attachments collection). Re-run without it when network/API is healthy, or provision from Admin later."
    );
  } else {
    console.info(
      "[tenant-spec] xAI team attachments collection (calls management API; can be slow — SKIP_SEED_TENANT_XCHAT_TEAM_COLLECTION=1 to skip)…"
    );
    xchatEnsured = await ensureTenantTeamXchatAttachmentsCollection({
      db,
      tenantSlug: parsed.slug,
      tenantObjectId: tenantId,
      tenantPreferences: prefs ?? null
    });
  }

  return {
    tenantId: tenantId.toHexString(),
    slug: parsed.slug,
    name: parsed.name,
    provisionedInitialAdmin: Boolean(parsed.initialTenantAdmin),
    ...(xchatEnsured
      ? {
          xchatTeamAttachments: {
            collectionId: xchatEnsured.collectionId,
            collectionName: xchatEnsured.collectionName,
            alreadyConfigured: xchatEnsured.skippedReason === "already_configured"
          }
        }
      : {})
  };
}
