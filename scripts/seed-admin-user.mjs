import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import { buildSuperAgentXapiTools, dedupeTrimmedIds } from "./lib/persona-xapi-tools.mjs";
import { resolveAdminSeedDbName, resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";
import { runSeedXaiRagIngest } from "./lib/seed-xai-rag-ingest.mjs";
import { loadSeedTenantContext, pickFirstNonEmpty } from "./lib/tenant-defaults-seed.mjs";

const SEED_SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SEED_SCRIPT_DIR, "..");
const seedTenant = loadSeedTenantContext(REPO_ROOT);

function runPostSeedXaiHelloVerify() {
  const s = String(process.env.SKIP_XAI_POST_SEED_VERIFY ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log("[seed:admin] SKIP_XAI_POST_SEED_VERIFY set — skipping xAI hello verify");
    return;
  }
  const script = join(SEED_SCRIPT_DIR, "verify-xai-hello.mjs");
  const r = spawnSync(process.execPath, [script], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit"
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

/** Upsert YAML/MD xPersona specs from `atx-rag-collection/xpersonas` into `xchat_personas` (separate from xAI collection ingest). */
function runPostSeedXpersonasFromDisk() {
  const s = String(process.env.SKIP_SEED_XPERSONAS ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log("[seed:admin] SKIP_SEED_XPERSONAS set — skipping disk → Mongo xPersona upsert");
    return;
  }
  const script = join(SEED_SCRIPT_DIR, "sync-xpersonas-from-yaml.ts");
  console.log("[seed:admin] syncing xPersonas from atx-rag-collection/xpersonas → Mongo (npm run seed:xpersonas)…");
  const r = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit"
  });
  if (r.status !== 0 && r.status != null) {
    console.error(
      "[seed:admin] seed:xpersonas failed — fix specs under atx-rag-collection/xpersonas or set SKIP_SEED_XPERSONAS=1"
    );
    process.exit(r.status ?? 1);
  }
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

const ADMIN_SEED_RAW = pickFirstNonEmpty(process.env.ADMIN_SEED_EMAIL, seedTenant.merged.adminSeedEmail);
if (!ADMIN_SEED_RAW) {
  console.error(
    "ADMIN_SEED_EMAIL is required for seed:admin — set in .env or initial_seed.settings.admin_seed_email in tenant_defaults.yaml."
  );
  process.exit(1);
}
const ADMIN_EMAIL = normalizeEmail(ADMIN_SEED_RAW);

/** X API `users/me` numeric id (`data.id`), not @handle — optional pre-link when X OAuth omits email. */
const ADMIN_SEED_X_USER_ID = (process.env.ADMIN_SEED_X_USER_ID ?? "").trim();
const ADMIN_SEED_X_USERNAME = (process.env.ADMIN_SEED_X_USERNAME ?? "").trim();
const ADMIN_SEED_X_DISPLAY_NAME = (process.env.ADMIN_SEED_X_DISPLAY_NAME ?? "").trim();

function xPrelinkSetFields(now) {
  if (!ADMIN_SEED_X_USER_ID) {
    return {};
  }
  const fields = {
    "xAccount.xUserId": ADMIN_SEED_X_USER_ID,
    "xAccount.linkedAt": now
  };
  if (ADMIN_SEED_X_USERNAME) {
    fields["xAccount.username"] = ADMIN_SEED_X_USERNAME;
  }
  if (ADMIN_SEED_X_DISPLAY_NAME) {
    fields["xAccount.displayName"] = ADMIN_SEED_X_DISPLAY_NAME;
  }
  return fields;
}

const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "atxfinance-core";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "atxFinance Core";
const DB_NAME = resolveAdminSeedDbName();
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
/** Default `portfolio_accounts.extAccountId` — matches `provisionDefaultPortfolioForUser` / Spring provision. */
const DEFAULT_EXT_ACCOUNT_XREF = "ext_account_xref";
const DEFAULT_WATCHLIST_NAME = "DefaultWatchlist";
const DEFAULT_ACCOUNT_TYPE = "fidelity";
const DEFAULT_WATCHLIST_SYMBOLS = ["TSLA"];
const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;
const DEFAULT_COLLECTION_NAME = "Finance";

function shouldSkipSeedXaiRagIngest() {
  const s = String(process.env.SKIP_SEED_XAI_RAG_INGEST ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Team UUID for strategy-template collections; empty when `XAI_TEAM_ID` is a literal `collection_*` id. */
function teamUuidForXaiIngest(teamIdMerged) {
  const raw = (teamIdMerged || "").trim();
  if (!raw || XAI_KB_COLLECTION_RE.test(raw)) {
    return "";
  }
  return raw;
}

const TENANT_PORTFOLIO_COLLECTION = "tenant_portfolio";
const DEFAULT_TENANT_PORTFOLIO_ORG_KEY =
  (process.env.TENANT_PORTFOLIO_ORG_KEY || "").trim() || "org-atx-finance";

/** Matches `UserAdminSettings` defaults used in admin manage-users tests / UI. */
const DEFAULT_SEED_ADMIN_USER_SETTINGS = {
  broker: { provider: "paper", accountRef: "paper-main", enabled: true },
  portfolio: {
    riskProfile: "balanced",
    investmentStrategy: "balanced",
    baseCurrency: "USD",
    rebalanceFrequencyDays: 14
  },
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
    ),
    db.collection("admin_access_requests").createIndex(
      { userId: 1, requestedRole: 1 },
      {
        unique: true,
        name: "uniq_admin_access_requests_user_requestedRole_actionable",
        partialFilterExpression: { status: { $in: ["new", "triaged", "pending"] } }
      }
    )
  ]);
}

async function seed() {
  console.log(
    `[seed:admin] Mongo database name: ${DB_NAME} — Next/Spring must use the same logical DB ` +
      `(set MONGODB_DB_NAME or the database path in MONGODB_URI in Secret Manager / .env). ` +
      `When MONGODB_DB_NAME is unset, ATX_DEPLOY_TARGET=stage|deploy|prod defaults the base to atxfinance-<target> (see src/lib/env.ts). ` +
      `Legacy single-DB local dev: ADMIN_SEED_DB_VERSION_SUFFIX=off.`
  );
  const mongoUri = resolveMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();

  try {
    await ensureIndexes(db);

    if (seedTenant.yamlLoaded) {
      console.log(
        "[seed:admin] tenant_defaults.yaml present — unset seed keys were filled from repo defaults (.env overrides yaml)."
      );
    }
    const m = seedTenant.merged;
    let teamKbCollectionId = "";

    let strategyCollectionIds = [];
    let ragIngest = {
      ragUploaded: 0,
      ragFileCandidates: 0,
      strategyCollectionsDetail: [],
      strategyFilesUploaded: 0,
      warnings: []
    };
    if (!shouldSkipSeedXaiRagIngest()) {
      const mgmtBase = m.xaiMgmtBaseUrl.replace(/\/$/, "");
      const xaiBaseUrl = m.xaiBaseUrl.replace(/\/$/, "");
      ragIngest = await runSeedXaiRagIngest({
        repoRoot: REPO_ROOT,
        teamId: teamUuidForXaiIngest(m.xaiTeamId),
        xaiApiKey: m.xaiApiKey,
        xaiBaseUrl,
        mgmtKey: m.xaiMgmtKey,
        mgmtBase,
        trustedAdvisorDeploySlug: seedTenant.trustedAdvisorDeploySlug
      });
      strategyCollectionIds = ragIngest.strategyCollectionIds ?? [];
      teamKbCollectionId = ragIngest.tenantTrustedAdvisorRootCollectionId || "";
      for (const w of ragIngest.warnings ?? []) {
        console.warn("[seed:admin] xai RAG ingest:", w);
      }
      console.log(
        `[seed:admin] xAI RAG ingest done (files uploaded: ${ragIngest.ragUploaded}; tenant collections: ${strategyCollectionIds.length})`
      );
    } else {
      console.log("[seed:admin] SKIP_SEED_XAI_RAG_INGEST set — skipping atx-rag-collection / strategy-template upload");
    }

    const xaiTeamIdUsed = (m.xaiTeamId || "").trim();
    const teamUuidForStrategy = teamUuidForXaiIngest(m.xaiTeamId);
    const envAtxRootOverride = (process.env.ATX_INSTANCE_COLLECTION_ROOT || "").trim();
    const strategyCollectionsDetail = ragIngest.strategyCollectionsDetail ?? [];
    const strategyFilesUploaded = ragIngest.strategyFilesUploaded ?? 0;
    const ragFileCandidates = ragIngest.ragFileCandidates ?? 0;

    const collectionsSearchIds = dedupeTrimmedIds(strategyCollectionIds);
    const superAgentTools = buildSuperAgentXapiTools(collectionsSearchIds);

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
            ...(teamKbCollectionId ? { collectionId: teamKbCollectionId } : {}),
            collectionName: DEFAULT_COLLECTION_NAME
          },
          model: "grok-4-1-fast-reasoning",
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

    const seedUserIdHex = user._id.toHexString();
    const adminAccessRequests = "admin_access_requests";
    const seedPaper = await db.collection(adminAccessRequests).findOne({
      userId: seedUserIdHex,
      requestedRole: "global_admin"
    });
    let accessRequestInserted = false;
    if (!seedPaper) {
      await db.collection(adminAccessRequests).insertOne({
        tenantId: tenant._id,
        userId: seedUserIdHex,
        contactEmail: email,
        requestedRole: "global_admin",
        requestedPlan: "enterprise",
        reason:
          "Bootstrap global_admin via npm run seed:admin (ADMIN_SEED_EMAIL); approved paper trail for elevated platform role.",
        status: "approved",
        requestedAt: now,
        reviewedBy: seedUserIdHex,
        reviewedAt: now
      });
      accessRequestInserted = true;
    }

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

    const extAccountId = DEFAULT_EXT_ACCOUNT_XREF;
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

    const payload = {
      ok: true,
      adminEmail: email,
      xUserIdLinked: ADMIN_SEED_X_USER_ID || undefined,
      xchatUserHistory:
        "Deferred to first xChat session (GET /api/xchat/collections → resolveOrCreateUserBootstrapCollection)",
      ragIngestRagFilesUploaded: ragIngest.ragUploaded,
      ragIngestRagFileCandidates: ragFileCandidates,
      ragIngestStrategyCollectionCount: strategyCollectionIds.length,
      ragIngestStrategyFilesUploaded: strategyFilesUploaded,
      ragIngestStrategyCollectionsDetail: strategyCollectionsDetail,
      collectionsSearchCollectionIds: collectionsSearchIds,
      atxInstanceCollectionRoot: seedTenant.atxInstanceCollectionRoot,
      atxInstanceCollectionRootEnvOverride: envAtxRootOverride || undefined,
      teamRagCollectionDisplayName: seedTenant.ragKbDisplayName || undefined,
      xaiTeamIdUsed: xaiTeamIdUsed || undefined,
      xaiTeamUuidForStrategyCollections: teamUuidForStrategy || undefined,
      teamKbCollectionId: teamKbCollectionId || undefined,
      atxInstanceEnvHint: seedTenant.atxInstanceCollectionRoot
        ? `Trusted-advisor xAI tenant: \`atx-trusted-advisor-${seedTenant.trustedAdvisorDeploySlug}\` + segment collections (see seed JSON). Instance prefix ATX_INSTANCE_COLLECTION_ROOT=${JSON.stringify(seedTenant.atxInstanceCollectionRoot)} drives per-user xChat history display names \`{root}-chat-<mongoUserId>\` (separate from team KB). Persona primary collection id = tenant root.`
        : "No atxInstanceCollectionRoot from tenant_defaults — set ATX_INSTANCE_COLLECTION_ROOT manually if you use instance-scoped xChat collections.",
      userId: String(user._id),
      tenantId: String(tenant._id),
      tenantSlug: tenant.slug,
      defaultPersonaId: String(persona._id),
      defaultPersonaName: persona.name,
      defaultPortfolioId: String(portfolio._id),
      defaultAccountId: String(account._id),
      defaultWatchlistId: String(watchlist._id),
      xPrelinked: Object.keys(xPre).length > 0,
      mongo: {
        database: DB_NAME,
        accessRequestInserted,
        note: "Upserted core_tenants, xchat_personas (Super-Agent), core_users, core_tenant_memberships, tenant_portfolio + portfolio_accounts + portfolio_watchlists, admin_user_settings; then invokes seed:xpersonas from atx-rag-collection/xpersonas unless SKIP_SEED_XPERSONAS. See accessRequestInserted for admin_access_requests."
      }
    };

    console.log(
      [
        "",
        "======== seed:admin summary ==============================================",
        `Mongo database:              ${DB_NAME}`,
        "Mongo writes:                tenant, Super-Agent persona, admin user, membership, default portfolio/account/watchlist, admin_user_settings (upsert)",
        String(process.env.SKIP_SEED_XPERSONAS ?? "").match(/^(1|true|yes)$/i)
          ? "xPersonas from disk:       skipped (SKIP_SEED_XPERSONAS)"
          : "xPersonas from disk:       seed:xpersonas (atx-rag-collection/xpersonas → xchat_personas) after this summary",
        `                             admin_access_requests: ${accessRequestInserted ? "inserted approved paper row" : "already present — skipped"}`,
        `ATX_INSTANCE_COLLECTION_ROOT (effective): ${seedTenant.atxInstanceCollectionRoot || "(none)"}`,
        `  .env override:             ${envAtxRootOverride || "(unset — computed from ATX_DEPLOY_TARGET / site_name / tenant_defaults)"}`,
        `XAI_TEAM_ID (merged):        ${xaiTeamIdUsed || "(unset)"}`,
        `Team UUID for strategies:   ${teamUuidForStrategy || "(n/a — literal collection_* id or no team)"}`,
        `Trusted advisor root id:     ${teamKbCollectionId || "(none)"}`,
        `Team RAG display name:     ${seedTenant.ragKbDisplayName || "(legacy — not used for ingest)"}`,
        shouldSkipSeedXaiRagIngest()
          ? [
              "xAI RAG ingest:            skipped (SKIP_SEED_XAI_RAG_INGEST)",
              `collections_search ids:    ${collectionsSearchIds.length} (${collectionsSearchIds.join(", ") || "—"})`
            ].join("\n")
          : [
              `xAI RAG files:              ${ragIngest.ragUploaded} uploaded / ${ragFileCandidates} file candidates (walked dirs)`,
              `xAI tenant collections:     ${strategyCollectionsDetail.length} buckets, ${strategyFilesUploaded} docs linked total`,
              ...strategyCollectionsDetail.map(
                (s) => `    • ${s.displayName} → ${s.collectionId} (${s.filesUploaded} docs)`
              ),
              `collections_search ids:    ${collectionsSearchIds.length} (${collectionsSearchIds.join(", ") || "—"})`
            ].join("\n"),
        "=========================================================================",
        ""
      ].join("\n")
    );

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await client.close();
  }
  runPostSeedXpersonasFromDisk();
  runPostSeedXaiHelloVerify();
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
