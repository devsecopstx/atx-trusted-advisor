import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/mongodb";

const expectedIndexNames = {
  users: ["uniq_core_user_email", "uniq_core_user_x_user_id"],
  tenants: ["uniq_tenant_slug", "uniq_default_tenant"],
  memberships: ["uniq_membership_user_tenant"]
} as const;

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const db = await getDb();
  const env = getEnv();
  const seedEmailConfigured = Boolean(env.ADMIN_SEED_EMAIL?.trim());
  const seedEmail = env.ADMIN_SEED_EMAIL?.trim().toLowerCase() ?? null;

  const [userIndexes, tenantIndexes, membershipIndexes, seededUser, defaultTenant] =
    await Promise.all([
      db.collection("core_users").indexes(),
      db.collection("core_tenants").indexes(),
      db.collection("core_tenant_memberships").indexes(),
      seedEmail
        ? db.collection("core_users").findOne({ email: seedEmail })
        : Promise.resolve(null),
      db.collection("core_tenants").findOne({ isDefault: true })
    ]);

  const userIndexNames = new Set(userIndexes.map((index) => index.name));
  const tenantIndexNames = new Set(tenantIndexes.map((index) => index.name));
  const membershipIndexNames = new Set(membershipIndexes.map((index) => index.name));

  const hasAllIndexes =
    expectedIndexNames.users.every((name) => userIndexNames.has(name)) &&
    expectedIndexNames.tenants.every((name) => tenantIndexNames.has(name)) &&
    expectedIndexNames.memberships.every((name) => membershipIndexNames.has(name));

  const hasSeededUser = Boolean(seededUser?._id);
  const hasDefaultTenant = Boolean(defaultTenant?._id);

  const seededMembership = seededUser?._id && defaultTenant?._id
    ? await db.collection("core_tenant_memberships").findOne({
        userId: seededUser._id,
        tenantId: defaultTenant._id,
        isDefaultTenant: true
      })
    : null;

  const hasSeededMembership = Boolean(seededMembership?._id);

  const healthy =
    hasAllIndexes &&
    hasSeededUser &&
    hasDefaultTenant &&
    hasSeededMembership &&
    seedEmailConfigured;

  return NextResponse.json({
    data: {
      healthy,
      seedEmailConfigured,
      seedEmail,
      indexes: {
        healthy: hasAllIndexes,
        users: expectedIndexNames.users.map((name) => ({
          name,
          exists: userIndexNames.has(name)
        })),
        tenants: expectedIndexNames.tenants.map((name) => ({
          name,
          exists: tenantIndexNames.has(name)
        })),
        memberships: expectedIndexNames.memberships.map((name) => ({
          name,
          exists: membershipIndexNames.has(name)
        }))
      },
      seedEntities: {
        userExists: hasSeededUser,
        defaultTenantExists: hasDefaultTenant,
        defaultMembershipExists: hasSeededMembership
      },
      context: {
        requestingUser: session.email,
        requestingTenantId: session.tenantId
      }
    }
  });
}
