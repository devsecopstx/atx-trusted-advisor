import { MongoClient, ObjectId } from "mongodb";

import { resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";

const DB_NAME = process.env.MONGODB_DB_NAME ?? "atxfinancedb";
const TENANT_PORTFOLIO_COLLECTION = "tenant_portfolio";
const DEFAULT_TENANT_PORTFOLIO_ORG_KEY =
  (process.env.TENANT_PORTFOLIO_ORG_KEY || "").trim() || "org-atx-finance";
const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_EXT_BROKER_REF = "extBrokerName";
const DEFAULT_ACCOUNT_NAME = "Default Account";
const DEFAULT_EXT_ACCOUNT_XREF = "ext_account_xref";
const DEFAULT_WATCHLIST_NAME = "Default Watchlist";
const DEFAULT_ACCOUNT_TYPE = "fidelity";

async function ensurePortfolioIndexes(db) {
  await Promise.all([
    db.collection(TENANT_PORTFOLIO_COLLECTION).createIndex(
      { tenantId: 1, userId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_portfolio_per_user"
      }
    ),
    db.collection(TENANT_PORTFOLIO_COLLECTION).createIndex(
      { tenantId: 1, userId: 1, name: 1 },
      {
        unique: true,
        name: "uniq_portfolio_name_per_user"
      }
    ),
    db.collection(TENANT_PORTFOLIO_COLLECTION).createIndex(
      { tenantPortfolioOrgKey: 1, tenantId: 1 },
      { name: "idx_tenant_portfolio_org_tenant" }
    ),
    db.collection("portfolio_accounts").createIndex(
      { tenantId: 1, portfolioId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_account_per_portfolio"
      }
    ),
    db.collection("portfolio_watchlists").createIndex(
      { tenantId: 1, portfolioId: 1 },
      {
        unique: true,
        name: "uniq_watchlist_per_portfolio"
      }
    )
  ]);
}

async function provisionDefaultsForUser(db, { userId, tenantId }) {
  const now = new Date();
  const portfolios = db.collection(TENANT_PORTFOLIO_COLLECTION);
  const accounts = db.collection("portfolio_accounts");
  const watchlists = db.collection("portfolio_watchlists");

  await portfolios.updateOne(
    { tenantId, userId, isDefault: true },
    {
      $setOnInsert: {
        tenantId,
        userId,
        createdAt: now
      },
      $set: {
        name: DEFAULT_PORTFOLIO_NAME,
        isDefault: true,
        ext_broker_ref: DEFAULT_EXT_BROKER_REF,
        tenantPortfolioOrgKey: DEFAULT_TENANT_PORTFOLIO_ORG_KEY,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  const portfolio = await portfolios.findOne({ tenantId, userId, isDefault: true });
  if (!portfolio?._id) {
    throw new Error(`Failed to upsert portfolio for user ${String(userId)}`);
  }

  const extAccountId = DEFAULT_EXT_ACCOUNT_XREF;
  await accounts.updateOne(
    { tenantId, userId, portfolioId: portfolio._id, isDefault: true },
    {
      $setOnInsert: {
        tenantId,
        userId,
        portfolioId: portfolio._id,
        createdAt: now
      },
      $set: {
        name: DEFAULT_ACCOUNT_NAME,
        type: DEFAULT_ACCOUNT_TYPE,
        extAccountId,
        isDefault: true,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  await watchlists.updateOne(
    { tenantId, userId, portfolioId: portfolio._id },
    {
      $setOnInsert: {
        tenantId,
        userId,
        portfolioId: portfolio._id,
        createdAt: now
      },
      $set: {
        name: DEFAULT_WATCHLIST_NAME,
        isDefault: true,
        updatedAt: now
      }
    },
    { upsert: true }
  );
}

async function run() {
  const client = new MongoClient(resolveMongoUri());
  await client.connect();
  const db = client.db(DB_NAME);

  try {
    await ensurePortfolioIndexes(db);

    const approvedUserIds = await db
      .collection("admin_access_requests")
      .distinct("userId", { status: "approved" });
    const adminUsers = await db
      .collection("core_users")
      .find({ roles: "global_admin" }, { projection: { _id: 1 } })
      .toArray();

    const userIds = Array.from(
      new Set([
        ...approvedUserIds.map((value) => String(value)),
        ...adminUsers.map((user) => String(user._id))
      ])
    );

    let processed = 0;
    let skippedWithoutTenant = 0;
    for (const userId of userIds) {
      if (!ObjectId.isValid(userId)) {
        skippedWithoutTenant += 1;
        continue;
      }
      const membership = await db.collection("core_tenant_memberships").findOne({
        userId: new ObjectId(userId),
        isDefaultTenant: true
      });
      if (!membership?.tenantId) {
        skippedWithoutTenant += 1;
        continue;
      }
      await provisionDefaultsForUser(db, {
        userId,
        tenantId: membership.tenantId
      });
      processed += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          candidates: userIds.length,
          processed,
          skippedWithoutTenant
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
