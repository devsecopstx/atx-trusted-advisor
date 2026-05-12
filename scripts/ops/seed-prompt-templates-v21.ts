/**
 * Upserts global (`tenantId: null`) HNWI Desk Report v2.1 rows into `prompt_templates`.
 *
 * Usage:
 *   npm run seed:prompt-templates-v21
 *
 * @see atx-docs/sre-ops/prompt-templates-schema.md
 */

import { MongoClient, ObjectId } from "mongodb";

import { PROMPT_TEMPLATES_COLLECTION } from "@/modules/xchat/prompt-template-repository";
import { listHnwiV21DefaultSeedRows } from "@/modules/xchat/prompt-templates-v21-defaults";

import { resolveMongoUri } from "../lib/resolve-mongo-uri.mjs";
import { resolveSyncTargetMongoDatabaseName, formatSyncTargetMongoDatabaseLogSuffix } from "../lib/sync-target-mongo-db";

async function main(): Promise<void> {
  const uri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection(PROMPT_TEMPLATES_COLLECTION);
  const now = new Date();
  const rows = listHnwiV21DefaultSeedRows();
  for (const row of rows) {
    await coll.updateOne(
      { slug: row.slug, tenantId: null, version: row.version },
      {
        $set: {
          slug: row.slug,
          version: row.version,
          tenantId: null,
          prompt_text: row.prompt_text,
          output_schema: row.output_schema,
          active: row.active,
          bias_defaults: row.bias_defaults,
          updatedAt: now
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now
        }
      },
      { upsert: true }
    );
  }
  console.log(
    `[seed:prompt-templates-v21] upserted ${rows.length} global rows into ${PROMPT_TEMPLATES_COLLECTION} db=${dbName}${formatSyncTargetMongoDatabaseLogSuffix()}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
