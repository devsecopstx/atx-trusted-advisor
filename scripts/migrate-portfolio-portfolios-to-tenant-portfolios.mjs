/**
 * One-shot Mongo migration:
 * 1. Renames legacy collection `portfolio_portfolios` → `tenant_portfolios` (if needed).
 * 2. Backfills `tenantPortfolioOrgKey` when missing (default `org-atx-finance`, or `TENANT_PORTFOLIO_ORG_KEY`).
 *
 * Run: node --env-file=.env scripts/migrate-portfolio-portfolios-to-tenant-portfolios.mjs
 *
 * Safe to re-run: skips rename if `tenant_portfolios` already exists; updateMany only touches docs missing the field.
 */
import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB_NAME ?? "atxfinancedb";
const LEGACY = "portfolio_portfolios";
const NEXT = "tenant_portfolios";
const DEFAULT_ORG =
  (process.env.TENANT_PORTFOLIO_ORG_KEY || "").trim() || "org-atx-finance";

function decodeMongoUri() {
  const encoded = process.env.MONGODB_URI_B64 ?? process.env.MONGODB_URI_B4;
  if (!encoded) {
    throw new Error("Set MONGODB_URI_B64 (or MONGODB_URI_B4)");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Decoded Mongo URI is invalid");
  }
  return decoded;
}

async function main() {
  const client = new MongoClient(decodeMongoUri());
  await client.connect();
  const db = client.db(DB_NAME);
  try {
    const collNames = new Set((await db.listCollections().toArray()).map((c) => c.name));
    const hasLegacy = collNames.has(LEGACY);
    const hasNext = collNames.has(NEXT);

    if (hasLegacy && hasNext) {
      throw new Error(
        `Both ${LEGACY} and ${NEXT} exist. Merge or drop one manually before running this script.`
      );
    }

    if (!hasLegacy && !hasNext) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            step: "noop",
            message:
              "No portfolio collection found; the app will create tenant_portfolios on first provision — nothing to migrate."
          },
          null,
          2
        )
      );
      await client.close();
      return;
    }

    if (hasLegacy && !hasNext) {
      await db.collection(LEGACY).rename(NEXT);
      console.log(JSON.stringify({ ok: true, step: "renamed", from: LEGACY, to: NEXT }, null, 2));
    } else {
      console.log(JSON.stringify({ ok: true, step: "rename_skipped", message: `${NEXT} already present` }, null, 2));
    }

    const target = db.collection(NEXT);
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
        { name: "idx_tenant_portfolios_org_tenant" }
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
