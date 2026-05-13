/**
 * Upserts global (`tenantId: null`) `email_templates` rows + ensures Mongo indexes for
 * `email_templates` and `portfolio_email_preferences`.
 *
 * Usage:
 *   npm run seed:email-templates
 *
 * @see atx-docs/sre-ops/email-templates-schema.md
 */

import { MongoClient, ObjectId } from "mongodb";

import { listGlobalEmailTemplateSeedRows } from "@/modules/email-templates/email-templates-defaults";
import {
    EMAIL_TEMPLATES_COLLECTION,
    ensureEmailTemplateIndexes
} from "@/modules/email-templates/email-templates-repository";
import {
    PORTFOLIO_EMAIL_PREFERENCES_COLLECTION,
    ensurePortfolioEmailPreferenceIndexes
} from "@/modules/email-templates/portfolio-email-preferences-repository";

import { resolveMongoUri } from "../lib/resolve-mongo-uri.mjs";
import {
    formatSyncTargetMongoDatabaseLogSuffix,
    resolveSyncTargetMongoDatabaseName
} from "../lib/sync-target-mongo-db";

async function main(): Promise<void> {
  const uri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  await ensureEmailTemplateIndexes(db);
  await ensurePortfolioEmailPreferenceIndexes(db);

  const coll = db.collection(EMAIL_TEMPLATES_COLLECTION);
  const now = new Date();
  const rows = listGlobalEmailTemplateSeedRows();
  let upserts = 0;
  for (const row of rows) {
    await coll.updateOne(
      { slug: row.slug, tenantId: null },
      {
        $set: {
          slug: row.slug,
          version: row.version,
          tenantId: null,
          subject: row.subject,
          body: row.body,
          active: row.active,
          defaultCadence: row.defaultCadence,
          updatedAt: now
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now
        }
      },
      { upsert: true }
    );
    upserts += 1;
  }
  console.log(
    `[seed:email-templates] upserted ${upserts} global rows into ${EMAIL_TEMPLATES_COLLECTION}; ensured indexes on ${PORTFOLIO_EMAIL_PREFERENCES_COLLECTION} db=${dbName}${formatSyncTargetMongoDatabaseLogSuffix()}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
