import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

const ADMIN_SEED_RAW = (process.env.ADMIN_SEED_EMAIL ?? "").trim();
if (!ADMIN_SEED_RAW) {
  console.error(
    "ADMIN_SEED_EMAIL is required in .env for seed:admin (no default — set your bootstrap admin email)."
  );
  process.exit(1);
}
const ADMIN_EMAIL = normalizeEmail(ADMIN_SEED_RAW);
<<<<<<< Current (Your changes)

/** X API `users/me` numeric id (`data.id`), not @handle — optional pre-link for OAuth before first login. */
const X_USER_ID_RAW = (process.env.ADMIN_SEED_X_USER_ID ?? "").trim();
const X_USERNAME_RAW = (process.env.ADMIN_SEED_X_USERNAME ?? "").trim();

function xPrelinkSetFields(now) {
  if (!X_USER_ID_RAW) {
    return {};
  }
  const fields = {
    "xAccount.xUserId": X_USER_ID_RAW,
    "xAccount.linkedAt": now
  };
  if (X_USERNAME_RAW) {
    fields["xAccount.username"] = X_USERNAME_RAW;
  }
  return fields;
}
=======
const ADMIN_SEED_X_USER_ID = (process.env.ADMIN_SEED_X_USER_ID ?? "").trim();
const ADMIN_SEED_X_USERNAME = (process.env.ADMIN_SEED_X_USERNAME ?? "").trim();
const ADMIN_SEED_X_DISPLAY_NAME = (process.env.ADMIN_SEED_X_DISPLAY_NAME ?? "").trim();
>>>>>>> Incoming (Background Agent changes)
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "atxfinance-core";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "atxFinance Core";
const DB_NAME = resolveSeedDbName();
const DEFAULT_PERSONA_NAME = "Super-Agent";
const DEFAULT_PERSONA_SYSTEM_PROMPT = `You are The Architect, the elite administrative agent for atxFinance global admins. You have live xAI tools — call them; do not guess time-sensitive facts from memory.

Tool discipline (use the API tool channel; do not fake tool calls in plain text):
- web_search — Current events, weather, breaking news, sports, and anything that needs the live public web. If the user asks what conditions are "right now" or "today" (e.g. weather in a city), you MUST run web_search and answer from tool results.
- x_search — Search X (Twitter) for posts, handles, and social/market chatter.
- collections_search — Query the configured xAI RAG collections for private docs and uploaded knowledge.
- yahoo_finance — Quotes and market data for tickers.
- atxfinance — This signed-in user's portfolio, watchlist, positions, and workspace data when relevant.

Prefer tool-grounded answers over unsupported claims. When tools return nothing useful, say so clearly.`;
const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_EXT_BROKER_REF = "extBrokerName";
const DEFAULT_ACCOUNT_NAME = "Default Account";
const DEFAULT_WATCHLIST_NAME = "DefaultWatchlist";
const DEFAULT_ACCOUNT_TYPE = "fidelity";
const DEFAULT_WATCHLIST_SYMBOLS = ["TSLA"];
const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;
const DEFAULT_COLLECTION_NAME = "Finance";

/**
 * Aligns with runtime `resolveTeamKbCollectionId`: literal `collection_*`, else list collections
 * for `XAI_TEAM_ID` as team UUID via management API (requires `XAI_MANAGEMENT_API_KEY` in .env).
 * `tenant_defaults.yaml` is never read here — only process.env from `--env-file=.env`.
 */
async function resolveSuperAgentCollectionIdForSeed() {
  const raw = (process.env.XAI_TEAM_ID || "").trim();
  if (!raw) {
    return "";
  }
  if (XAI_KB_COLLECTION_RE.test(raw)) {
    return raw;
  }

  const mgmtKey = (process.env.XAI_MANAGEMENT_API_KEY || "").trim();
  const base = (process.env.XAI_MANAGEMENT_BASE_URL || "https://management-api.x.ai/v1").replace(
    /\/$/,
    ""
  );
  if (!mgmtKey) {
    console.warn(
      "[seed:admin] XAI_TEAM_ID is not a collection_* id. This script only loads .env (not tenant_defaults.yaml). " +
        "Set XAI_MANAGEMENT_API_KEY to resolve a team UUID to a KB collection, or set XAI_TEAM_ID to a literal collection_* id."
    );
    return "";
  }

  try {
    let url = `${base}/collections?team_id=${encodeURIComponent(raw)}`;
    let res = await fetch(url, { headers: { Authorization: `Bearer ${mgmtKey}` } });
    if (!res.ok) {
      url = `${base}/collections`;
      res = await fetch(url, { headers: { Authorization: `Bearer ${mgmtKey}` } });
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(
        "[seed:admin] xAI management collections list failed:",
        JSON.stringify(payload?.error ?? payload)
      );
      return "";
    }
    const candidates = [payload.data, payload.results, payload.collections, payload.items].find(
      Array.isArray
    );
    if (!Array.isArray(candidates)) {
      console.warn("[seed:admin] Unexpected collections response shape; skipping collections_search.");
      return "";
    }
    for (const c of candidates) {
      if (!c || typeof c !== "object") {
        continue;
      }
      const id = String(c.id ?? c.collection_id ?? "").trim();
      if (id && XAI_KB_COLLECTION_RE.test(id)) {
        console.log(`[seed:admin] Resolved Super-Agent KB collection id for team: ${id}`);
        return id;
      }
    }
    console.warn(
      "[seed:admin] No collection_* KB id found for this team; Super-Agent seeded without collections_search."
    );
    return "";
  } catch (e) {
    console.warn("[seed:admin] collections resolve error:", e instanceof Error ? e.message : e);
    return "";
  }
}

function buildSuperAgentXapiTools(collectionId) {
  if (collectionId) {
    return [
      { type: "web_search" },
      { type: "x_search" },
      { type: "collections_search", collection_ids: [collectionId] },
      { type: "yahoo_finance" },
      { type: "atxfinance" }
    ];
  }
  return [
    { type: "web_search" },
    { type: "x_search" },
    { type: "yahoo_finance" },
    { type: "atxfinance" }
  ];
}

const TENANT_PORTFOLIO_COLLECTION = "tenant_portfolio";
const DEFAULT_TENANT_PORTFOLIO_ORG_KEY =
  (process.env.TENANT_PORTFOLIO_ORG_KEY || "").trim() || "org-atx-finance";

/** Matches `UserAdminSettings` defaults used in admin user-settings tests / UI. */
const DEFAULT_SEED_ADMIN_USER_SETTINGS = {
  broker: { provider: "paper", accountRef: "paper-main", enabled: true },
  portfolio: { riskProfile: "balanced", baseCurrency: "USD", rebalanceFrequencyDays: 14 },
  account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
  notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 }
};

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

async function seed() {
  const mongoUri = resolveMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();

  try {
    await ensureIndexes(db);

    const superAgentCollectionId = await resolveSuperAgentCollectionIdForSeed();
    const superAgentTools = buildSuperAgentXapiTools(superAgentCollectionId);

    if (ADMIN_SEED_X_USER_ID) {
      const holder = await db.collection("core_users").findOne({
        "xAccount.xUserId": ADMIN_SEED_X_USER_ID,
        email: { $ne: email }
      });
      if (holder) {
        throw new Error(
          `[seed:admin] ADMIN_SEED_X_USER_ID ${ADMIN_SEED_X_USER_ID} is already linked to ${holder.email}; unlink that user or use a different X account.`
        );
      }
      const xSet = {
        "xAccount.xUserId": ADMIN_SEED_X_USER_ID,
        "xAccount.username": ADMIN_SEED_X_USERNAME || user.xAccount?.username || ADMIN_SEED_X_USER_ID,
        "xAccount.linkedAt": now,
        updatedAt: now
      };
      if (ADMIN_SEED_X_DISPLAY_NAME) {
        xSet["xAccount.displayName"] = ADMIN_SEED_X_DISPLAY_NAME;
      } else if (user.xAccount?.displayName) {
        xSet["xAccount.displayName"] = user.xAccount.displayName;
      }
      await db.collection("core_users").updateOne({ _id: user._id }, { $set: xSet });
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
            ...(superAgentCollectionId ? { collectionId: superAgentCollectionId } : {}),
            collectionName: DEFAULT_COLLECTION_NAME
          },
          model: "grok-4-1-fast",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global",
          xapi: {
            mode: "responses",
            toolChoice: "auto",
            maxTurns: 5,
            tools: superAgentTools
          },
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

    const email = ADMIN_EMAIL;
    const xPre = xPrelinkSetFields(now);
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
          updatedAt: now,
          ...xPre
        }
      },
      { upsert: true }
    );
    const user = await db.collection("core_users").findOne({ email });
    if (!user?._id) {
      throw new Error("Failed to create or fetch seeded admin user");
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

    await db.collection(TENANT_PORTFOLIO_COLLECTION).updateOne(
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
          ext_broker_ref: DEFAULT_EXT_BROKER_REF,
          tenantPortfolioOrgKey: DEFAULT_TENANT_PORTFOLIO_ORG_KEY,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const portfolio = await db
      .collection(TENANT_PORTFOLIO_COLLECTION)
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

    const defaultSymbolDocs = DEFAULT_WATCHLIST_SYMBOLS.map((symbol) => ({
      symbol: symbol.toUpperCase(),
      addedAt: now
    }));
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
          symbols: defaultSymbolDocs,
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

    const adminSettingsFilter = { userId: String(user._id), tenantId: tenant._id };
    const existingAdminSettings = await db.collection("admin_user_settings").findOne(adminSettingsFilter);
    if (!existingAdminSettings) {
      await db.collection("admin_user_settings").insertOne({
        ...adminSettingsFilter,
        assignedPersonaId: String(persona._id),
        ...DEFAULT_SEED_ADMIN_USER_SETTINGS,
        createdAt: now,
        updatedAt: now
      });
    } else {
      const assigned = existingAdminSettings.assignedPersonaId;
      const missingAssignment =
        assigned == null || (typeof assigned === "string" && assigned.trim() === "");
      if (missingAssignment) {
        await db.collection("admin_user_settings").updateOne(
          { _id: existingAdminSettings._id },
          { $set: { assignedPersonaId: String(persona._id), updatedAt: now } }
        );
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          adminEmail: email,
          xUserIdLinked: ADMIN_SEED_X_USER_ID || undefined,
          userId: String(user._id),
          tenantId: String(tenant._id),
          tenantSlug: tenant.slug,
          defaultPersonaId: String(persona._id),
          defaultPersonaName: persona.name,
          defaultPortfolioId: String(portfolio._id),
          defaultAccountId: String(account._id),
          defaultWatchlistId: String(watchlist._id),
          xPrelinked: Object.keys(xPre).length > 0
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
