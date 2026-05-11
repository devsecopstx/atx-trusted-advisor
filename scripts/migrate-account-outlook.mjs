#!/usr/bin/env node
/**
 * Backfill optional investment outlook refresh fields on `portfolio_accounts`.
 *
 * Usage:
 *   npm run migrate:account-outlook
 */

import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

async function main() {
  const client = new MongoClient(resolveMongoUri());
  await client.connect();
  const db = client.db(resolveSeedDbName());
  try {
    const result = await db.collection("portfolio_accounts").updateMany(
      {
        outlookRefreshEnabled: { $exists: false }
      },
      {
        $set: {
          outlookRefreshEnabled: true,
          updatedAt: new Date()
        }
      }
    );
    console.log(
      `[migrate:account-outlook] matched=${String(result.matchedCount)} modified=${String(result.modifiedCount)}`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[migrate:account-outlook] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
