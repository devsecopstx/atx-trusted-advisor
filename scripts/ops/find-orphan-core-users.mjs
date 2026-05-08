#!/usr/bin/env node
/**
 * Lists `core_users` documents with no `core_tenant_memberships` row (orphan accounts).
 *
 * Usage: node --env-file=.env scripts/ops/find-orphan-core-users.mjs
 *
 * Does not modify data. Pipe to review or delete manually after backup.
 */
import { MongoClient } from "mongodb";

function parseMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  return uri;
}

function dbNameFromUri(uri) {
  const envName = process.env.MONGODB_DB_NAME?.trim();
  if (envName) {
    return envName;
  }
  try {
    const path = new URL(uri.replace(/^mongodb\+srv:/iu, "mongodb:")).pathname.replace(/^\//u, "");
    const seg = path.split("/").filter(Boolean)[0];
    return seg && !seg.includes("?") ? seg.split("?")[0] : "atxfinance";
  } catch {
    return "atxfinance";
  }
}

async function main() {
  const uri = parseMongoUri();
  const dbName = dbNameFromUri(uri);
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const memberUserIds = await db.collection("core_tenant_memberships").distinct("userId");
    const orphans = await db
      .collection("core_users")
      .find({
        _id: { $nin: memberUserIds }
      })
      .project({ email: 1, roles: 1, accountStatus: 1, status: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    console.log(
      JSON.stringify(
        {
          db: dbName,
          distinctMembershipUserIds: memberUserIds.length,
          orphanSampleCount: orphans.length,
          orphans: orphans.map((u) => ({
            _id: String(u._id),
            email: u.email,
            roles: u.roles,
            accountStatus: u.accountStatus ?? null,
            status: u.status,
            createdAt: u.createdAt
          }))
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
