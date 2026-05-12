import { MongoClient } from "mongodb";

import {
    getXaiFinanceCollectionId,
    XAI_FINANCE_COLLECTION_DISPLAY_NAME
} from "@/lib/xai-finance-collection";
import { resolveMongoUri } from "../lib/resolve-mongo-uri.mjs";
import { resolveSyncTargetMongoDatabaseName } from "../lib/sync-target-mongo-db";

const LEGACY_COLLECTION_NAME_RE = /atx-trusted-advisor-(dev|stage|prod)-xpersonas/i;

type MigrationSummary = {
  matched: number;
  updated: number;
  dryRun: boolean;
  financeCollectionId: string;
  database: string;
};

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const financeCollectionId = getXaiFinanceCollectionId();
  const database = resolveSyncTargetMongoDatabaseName();
  const client = new MongoClient(resolveMongoUri());

  const summary: MigrationSummary = {
    matched: 0,
    updated: 0,
    dryRun: !execute,
    financeCollectionId,
    database
  };

  await client.connect();
  try {
    const personas = client.db(database).collection("xchat_personas");
    const cursor = personas.find({
      $or: [
        { "xaiCollection.collectionName": { $regex: LEGACY_COLLECTION_NAME_RE } },
        { "teamCollection.collectionName": { $regex: LEGACY_COLLECTION_NAME_RE } },
        { collectionIds: { $exists: false } },
        { collectionIds: { $size: 0 } },
        { collectionIds: { $in: [null, ""] } }
      ]
    });

    for await (const row of cursor) {
      summary.matched += 1;
      if (execute) {
        await personas.updateOne(
          { _id: row._id },
          {
            $set: {
              xaiCollection: {
                collectionId: financeCollectionId,
                collectionName: XAI_FINANCE_COLLECTION_DISPLAY_NAME
              },
              collectionIds: [financeCollectionId]
            },
            $unset: { teamCollection: "" }
          }
        );
        summary.updated += 1;
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `[migrate:xchat-personas-finance-collection] ${JSON.stringify(summary)}${
      execute ? "" : " (dry-run — pass --execute to apply)"
    }`
  );
  if (!execute && summary.matched > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("[migrate:xchat-personas-finance-collection] failed", error);
  process.exitCode = 1;
});
