/**
 * One-shot Mongo migration to canonical collection name `tenant_portfolio` (singular).
 *
 * Rename order (first match wins):
 * - `portfolio_portfolios` → `tenant_portfolio` if final name absent
 * - `tenant_portfolios` (plural interim) → `tenant_portfolio` if final absent
 *
 * Then: backfill `tenantPortfolioOrgKey`, ensure indexes.
 *
 * Run: npm run migrate:tenant-portfolio
 *
 * Safe to re-run: skips rename when `tenant_portfolio` exists; updateMany only for missing org key.
 */
import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

const DB_NAME = resolveSeedDbName();
const FINAL = "tenant_portfolio";
const LEGACY_DOUBLE = "portfolio_portfolios";
const LEGACY_PLURAL = "tenant_portfolios";
const DEFAULT_ORG =
  (process.env.TENANT_PORTFOLIO_ORG_KEY || "").trim() || "org-atx-finance";

async function main() {
  const client = new MongoClient(resolveMongoUri());
  await client.connect();
  const db = client.db(DB_NAME);
  try {
    const collNames = new Set((await db.listCollections().toArray()).map((c) => c.name));
    const hasFinal = collNames.has(FINAL);
    const hasLegacyDouble = collNames.has(LEGACY_DOUBLE);
    const hasLegacyPlural = collNames.has(LEGACY_PLURAL);

    if (hasFinal && (hasLegacyDouble || hasLegacyPlural)) {
      throw new Error(
        `${FINAL} exists alongside legacy collection(s). Resolve duplicates manually before re-running.`
      );
    }
    if (hasLegacyDouble && hasLegacyPlural) {
      throw new Error(`Both ${LEGACY_DOUBLE} and ${LEGACY_PLURAL} exist. Merge manually before running this script.`);
    }

    if (!hasFinal && !hasLegacyDouble && !hasLegacyPlural) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            step: "noop",
            message: `No portfolio collection found; the app will create ${FINAL} on first provision.`
          },
          null,
          2
        )
      );
      await client.close();
      return;
    }

    if (!hasFinal && hasLegacyPlural) {
      await db.collection(LEGACY_PLURAL).rename(FINAL);
      console.log(JSON.stringify({ ok: true, step: "renamed", from: LEGACY_PLURAL, to: FINAL }, null, 2));
    } else if (!hasFinal && hasLegacyDouble) {
      await db.collection(LEGACY_DOUBLE).rename(FINAL);
      console.log(JSON.stringify({ ok: true, step: "renamed", from: LEGACY_DOUBLE, to: FINAL }, null, 2));
    } else {
      console.log(JSON.stringify({ ok: true, step: "rename_skipped", message: `${FINAL} already present` }, null, 2));
    }

    const target = db.collection(FINAL);
    const backfill = await target.updateMany(
      { tenantPortfolioOrgKey: { $exists: false } },
      { $set: { tenantPortfolioOrgKey: DEFAULT_ORG } }
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          step: "backfill_org_key",
          matchedCount: backfill.matchedCount,
          modifiedCount: backfill.modifiedCount,
          tenantPortfolioOrgKey: DEFAULT_ORG
        },
        null,
        2
      )
    );

    await Promise.all([
      target.createIndex(
        { tenantId: 1, userId: 1, isDefault: 1 },
        {
          unique: true,
          partialFilterExpression: { isDefault: true },
          name: "uniq_default_portfolio_per_user"
        }
      ),
      target.createIndex(
        { tenantId: 1, userId: 1, name: 1 },
        { unique: true, name: "uniq_portfolio_name_per_user" }
      ),
      target.createIndex(
        { tenantPortfolioOrgKey: 1, tenantId: 1 },
        { name: "idx_tenant_portfolio_org_tenant" }
      )
    ]);
    console.log(JSON.stringify({ ok: true, step: "indexes_ensured" }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
