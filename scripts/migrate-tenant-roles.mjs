#!/usr/bin/env node
/**
 * Backfill core_tenants.tenantRoles from legacy tenantPreferences.tenantRoles when present.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-tenant-roles.mjs
 */

import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

async function main() {
  const client = new MongoClient(resolveMongoUri());
  await client.connect();
  const db = client.db(resolveSeedDbName());
  try {
    const result = await db.collection("core_tenants").updateMany(
      {
        tenantRoles: { $exists: false },
        "tenantPreferences.tenantRoles": { $exists: true }
      },
      [
        {
          $set: {
            tenantRoles: "$tenantPreferences.tenantRoles",
            updatedAt: new Date()
          }
        }
      ]
    );
    console.log(
      `[migrate:tenant-roles] matched=${String(result.matchedCount)} modified=${String(result.modifiedCount)}`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[migrate:tenant-roles] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
