import { MongoClient } from "mongodb";

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "atxbogart@gmail.com";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "xfinance-core";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "xFinance Core";
const DB_NAME = process.env.MONGODB_DB_NAME ?? "xfinancedb";
const DEFAULT_PERSONA_NAME = "Super-Agent";
const DEFAULT_PERSONA_SYSTEM_PROMPT =
  "You are The Architect, an elite administrative agent with full access to the xAI ecosystem. You have a multi-layered toolset including Web Search, X (Twitter) Search, a Python Code Sandbox, and Private Collection Search.";
const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_ACCOUNT_NAME = "Default Account";
const DEFAULT_WATCHLIST_NAME = "Default Watchlist";
const DEFAULT_ACCOUNT_TYPE = "robinhood";

function decodeMongoUri() {
  const encoded = process.env.MONGODB_URI_B64 ?? process.env.MONGODB_URI_B4;
  if (!encoded) {
    throw new Error("Set MONGODB_URI_B64 (or legacy alias MONGODB_URI_B4)");
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Decoded Mongo URI is invalid");
  }
  return decoded;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("core_users").createIndex({ email: 1 }, { unique: true, name: "uniq_core_user_email" }),
    db.collection("core_users").createIndex(
      { "xAccount.xUserId": 1 },
      { unique: true, sparse: true, name: "uniq_core_user_x_user_id" }
    ),
    db.collection("core_tenants").createIndex({ slug: 1 }, { unique: true, name: "uniq_tenant_slug" }),
    db.collection("core_tenants").createIndex(
      { isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_tenant"
      }
    ),
    db.collection("core_tenant_memberships").createIndex(
      { userId: 1, tenantId: 1 },
      { unique: true, name: "uniq_membership_user_tenant" }
    ),
    db.collection("xchat_personas").createIndex(
      { nameNormalized: 1 },
      { unique: true, name: "uniq_xpersona_name_normalized" }
    ),
    db.collection("portfolio_portfolios").createIndex(
      { tenantId: 1, userId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_portfolio_per_user"
      }
    ),
    db.collection("portfolio_portfolios").createIndex(
      { tenantId: 1, userId: 1, name: 1 },
      {
        unique: true,
        name: "uniq_portfolio_name_per_user"
      }
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

async function seed() {
  const mongoUri = decodeMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();
  const email = normalizeEmail(ADMIN_EMAIL);

  try {
    await ensureIndexes(db);

    await db.collection("core_users").updateOne(
      { email },
      {
        $setOnInsert: {
          email,
          createdAt: now
        },
        $set: {
          roles: ["global_admin"],
          status: "active",
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const user = await db.collection("core_users").findOne({ email });
    if (!user?._id) {
      throw new Error("Failed to create or fetch seeded admin user");
    }

    await db.collection("core_tenants").updateOne(
      { slug: DEFAULT_TENANT_SLUG },
      {
        $setOnInsert: {
          slug: DEFAULT_TENANT_SLUG,
          name: DEFAULT_TENANT_NAME,
          createdAt: now
        },
        $set: {
          isDefault: true,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const tenant = await db.collection("core_tenants").findOne({ slug: DEFAULT_TENANT_SLUG });
    if (!tenant?._id) {
      throw new Error("Failed to create or fetch default tenant");
    }

    await db.collection("core_tenant_memberships").updateOne(
      { userId: user._id, tenantId: tenant._id },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          role: "tenant_admin",
          isDefaultTenant: true,
          updatedAt: now
        }
      },
      { upsert: true }
    );

    await db.collection("xchat_personas").updateOne(
      { nameNormalized: DEFAULT_PERSONA_NAME.toLowerCase() },
      {
        $setOnInsert: {
          name: DEFAULT_PERSONA_NAME,
          nameNormalized: DEFAULT_PERSONA_NAME.toLowerCase(),
          createdAt: now
        },
        $set: {
          systemPrompt: DEFAULT_PERSONA_SYSTEM_PROMPT,
          overridePrompt: "",
          xaiCollection: {
            collectionId: "",
            collectionName: ""
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global",
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const persona = await db
      .collection("xchat_personas")
      .findOne({ nameNormalized: DEFAULT_PERSONA_NAME.toLowerCase() });
    if (!persona?._id) {
      throw new Error("Failed to create or fetch default Super-Agent persona");
    }

    await db.collection("portfolio_portfolios").updateOne(
      { tenantId: tenant._id, userId: user._id, isDefault: true },
      {
        $setOnInsert: {
          tenantId: tenant._id,
          userId: user._id,
          createdAt: now
        },
        $set: {
          name: DEFAULT_PORTFOLIO_NAME,
          isDefault: true,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const portfolio = await db
      .collection("portfolio_portfolios")
      .findOne({ tenantId: tenant._id, userId: user._id, isDefault: true });
    if (!portfolio?._id) {
      throw new Error("Failed to create or fetch default portfolio");
    }

    const extAccountId = `${DEFAULT_ACCOUNT_TYPE}-default-${String(user._id)}`;
    await db.collection("portfolio_accounts").updateOne(
      { tenantId: tenant._id, userId: user._id, portfolioId: portfolio._id, isDefault: true },
      {
        $setOnInsert: {
          tenantId: tenant._id,
          userId: user._id,
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
    const account = await db.collection("portfolio_accounts").findOne({
      tenantId: tenant._id,
      userId: user._id,
      portfolioId: portfolio._id,
      isDefault: true
    });
    if (!account?._id) {
      throw new Error("Failed to create or fetch default account");
    }

    await db.collection("portfolio_watchlists").updateOne(
      { tenantId: tenant._id, userId: user._id, portfolioId: portfolio._id },
      {
        $setOnInsert: {
          tenantId: tenant._id,
          userId: user._id,
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
    const watchlist = await db.collection("portfolio_watchlists").findOne({
      tenantId: tenant._id,
      userId: user._id,
      portfolioId: portfolio._id
    });
    if (!watchlist?._id) {
      throw new Error("Failed to create or fetch default watchlist");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          adminEmail: email,
          userId: String(user._id),
          tenantId: String(tenant._id),
          tenantSlug: tenant.slug,
          defaultPersonaId: String(persona._id),
          defaultPersonaName: persona.name,
          defaultPortfolioId: String(portfolio._id),
          defaultAccountId: String(account._id),
          defaultWatchlistId: String(watchlist._id)
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
