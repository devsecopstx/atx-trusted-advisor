import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import { buildAdvisorXapiTools, dedupeTrimmedIds } from "./lib/persona-xapi-tools.mjs";
import {
    resolveAdminSeedDbName,
    resolveMongoUri,
    resolveSeedDbName
} from "./lib/resolve-mongo-uri.mjs";
import { loadSeedTenantContext, pickFirstNonEmpty } from "./lib/tenant-defaults-seed.mjs";

const SEED_SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SEED_SCRIPT_DIR, "..");
const ADMIN_LOG_PATH = join(REPO_ROOT, "admin.log");
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

/** Env for post-seed TS sync children: same Mongo DB as this `seed:admin` run (`resolveAdminSeedDbName`). */
function childEnvWithSeedParentMongoDb() {
  return {
    ...process.env,
    SEED_PARENT_MONGODB_DB_NAME: resolveAdminSeedDbName(),
    SEED_SYNC_SUMMARY_JSON: "1"
  };
}

function parseSeedSummaryMarker(output) {
  return parseJsonMarker(output, "SEED_SUMMARY_JSON=");
}

function parseJsonMarker(output, marker) {
  const lines = String(output ?? "").split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (!line || !line.startsWith(marker)) {
      continue;
    }
    try {
      return JSON.parse(line.slice(marker.length));
    } catch {
      return null;
    }
  }
  return null;
}

function appendAdminSeedLog({ summaryLine, summaryJson }) {
  const ts = new Date().toISOString();
  const chunks = [`[${ts}] ${summaryLine}`];
  if (summaryJson) {
    chunks.push(JSON.stringify(summaryJson));
  }
  appendFileSync(ADMIN_LOG_PATH, `${chunks.join("\n")}\n`, "utf8");
}

/** Upsert YAML/MD xPersona specs from `atx-docs/rag-collection/xpersonas` into `xchat_personas` (separate from xAI collection ingest). */
function runPostSeedXpersonasFromDisk() {
  const s = String(process.env.SKIP_SEED_XPERSONAS ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log("[seed:admin] SKIP_SEED_XPERSONAS set — skipping disk → Mongo xPersona upsert");
    return { skipped: true };
  }
  const script = join(SEED_SCRIPT_DIR, "sync-xpersonas-from-yaml.ts");
  console.log("[seed:admin] syncing xPersonas from atx-docs/rag-collection/xpersonas → Mongo (npm run seed:xpersonas)…");
  const r = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: REPO_ROOT,
    env: childEnvWithSeedParentMongoDb(),
    encoding: "utf8"
  });
  if (r.stdout) {
    process.stdout.write(r.stdout);
  }
  if (r.stderr) {
    process.stderr.write(r.stderr);
  }
  if (r.status !== 0 && r.status != null) {
    console.error(
      "[seed:admin] seed:xpersonas failed — fix specs under atx-docs/rag-collection/xpersonas or set SKIP_SEED_XPERSONAS=1"
    );
    process.exit(r.status ?? 1);
  }
  return parseSeedSummaryMarker(r.stdout);
}

/** Upsert options strategy preference docs from `atx-rag-collection/options-strategy` (one row per subfolder .md). */
function runPostSeedOptionsStrategyPreferencesFromDisk() {
  const s = String(process.env.SKIP_SEED_OPTIONS_STRATEGY_PREFS ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log(
      "[seed:admin] SKIP_SEED_OPTIONS_STRATEGY_PREFS set — skipping disk → Mongo options_strategy_preferences upsert"
    );
    return { skipped: true };
  }
  const script = join(SEED_SCRIPT_DIR, "sync-options-strategy-preferences-from-disk.ts");
  console.log(
    "[seed:admin] syncing options strategy preferences from atx-rag-collection/options-strategy → Mongo…"
  );
  const r = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: REPO_ROOT,
    env: childEnvWithSeedParentMongoDb(),
    encoding: "utf8"
  });
  if (r.stdout) {
    process.stdout.write(r.stdout);
  }
  if (r.stderr) {
    process.stderr.write(r.stderr);
  }
  if (r.status !== 0 && r.status != null) {
    console.error(
      "[seed:admin] options-strategy-prefs sync failed — fix markdown under atx-rag-collection/options-strategy or set SKIP_SEED_OPTIONS_STRATEGY_PREFS=1"
    );
    process.exit(r.status ?? 1);
  }
  return parseSeedSummaryMarker(r.stdout);
}

/** Upsert canonical options strategies from `atx-rag-collection/options-strategy` (mirrors prefs, sets filters on insert). */
function runPostSeedOptionsStrategyFromDisk() {
  const s = String(process.env.SKIP_SEED_OPTIONS_STRATEGY ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log(
      "[seed:admin] SKIP_SEED_OPTIONS_STRATEGY set — skipping disk → Mongo options_strategy upsert"
    );
    return;
  }
  const script = join(SEED_SCRIPT_DIR, "sync-options-strategy-from-disk.ts");
  console.log("[seed:admin] syncing options strategy (canonical) from atx-rag-collection/options-strategy → Mongo…");
  const r = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: REPO_ROOT,
    env: childEnvWithSeedParentMongoDb(),
    stdio: "inherit"
  });
  if (r.status !== 0 && r.status != null) {
    console.error(
      "[seed:admin] options-strategy sync failed — fix markdown under atx-rag-collection/options-strategy or set SKIP_SEED_OPTIONS_STRATEGY=1"
    );
    process.exit(r.status ?? 1);
  }
}

/**
 * Ensures `admin_scheduled_tasks` tenant-level rows exist for `/admin/tasks` (same logic as
 * `npm run ops:scheduled-tasks:sync -- --apply --tenant=…`).
 */
function runPostSeedScheduledTasksSync(tenantIdHex) {
  const s = String(process.env.SKIP_SEED_SCHEDULED_TASKS_SYNC ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log(
      "[seed:admin] SKIP_SEED_SCHEDULED_TASKS_SYNC set — skipping admin_scheduled_tasks sync from category spec"
    );
    return;
  }
  const script = join(SEED_SCRIPT_DIR, "ops/sync-scheduled-tasks-from-spec.ts");
  console.log(
    "[seed:admin] syncing admin_scheduled_tasks (default jobs for Admin → Tasks) from category spec…"
  );
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", script, "--apply", `--tenant=${tenantIdHex}`],
    {
      cwd: REPO_ROOT,
      env: childEnvWithSeedParentMongoDb(),
      stdio: "inherit"
    }
  );
  if (r.status !== 0 && r.status != null) {
    console.error(
      "[seed:admin] scheduled-tasks sync failed — run `npm run ops:scheduled-tasks:sync -- --dry-run` or set SKIP_SEED_SCHEDULED_TASKS_SYNC=1"
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
const ADMIN_DELIVERY_CHANNELS_COLLECTION = "admin_delivery_channels";

const SEEDED_ADMIN_DELIVERY_CHANNELS = [
  {
    name: "trusted-advisor",
    deliveryTarget: "slack",
    slackWebhookEnv: "SCHEDULED_TASKS_SYNC_TRUSTED_ADVISOR_SLACK_WEBHOOK_URL"
  },
  {
    name: "in-app-alert",
    deliveryTarget: "in_app"
  },
  {
    name: "atx-admin-channel",
    deliveryTarget: "slack",
    slackWebhookEnv: "SCHEDULED_TASKS_SYNC_ATX_ADMIN_CHANNEL_SLACK_WEBHOOK_URL"
  }
];

/** Strip userinfo from mongodb URI for logs (never print passwords). */
function redactMongoCredentialsForLog(uri) {
  return String(uri).replace(/^(mongodb(?:\+srv)?:\/\/)[^/?#]+@/i, "$1");
}

function logSeedMongoTarget() {
  const uri = resolveMongoUri();
  const redacted = redactMongoCredentialsForLog(uri);
  const baseDb = resolveSeedDbName();
  const versionNote =
    DB_NAME !== baseDb ? ` (versioned seed: base name would be ${baseDb})` : "";
  const hasExplicitUri = Boolean(
    (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) ||
      (process.env.MONGODB_URI_B64 && process.env.MONGODB_URI_B64.trim())
  );
  const host = process.env.MONGODB_HOST?.trim() || "localhost";
  const noAuth = process.env.MONGODB_NO_AUTH === "true" || process.env.MONGODB_NO_AUTH === "1";
  const uriSource = hasExplicitUri
    ? "MONGODB_URI or MONGODB_URI_B64 is set (connection string from env)."
    : `no MONGODB_URI — built URI for ${host}:27017 with path segment ${baseDb}; auth ${
        noAuth ? "off (MONGODB_NO_AUTH)" : "via MONGO_ROOT_USERNAME + MONGO_ROOT_PASSWORD"
      }.`;

  console.log(`[seed:admin] Mongo — DATABASE (collections written here): ${DB_NAME}${versionNote}`);
  console.log(`[seed:admin] Mongo — CONNECT (redacted): ${redacted}`);
  console.log(`[seed:admin] Mongo — URI source: ${uriSource}`);
  console.log(
    "[seed:admin] Mongo — Next + Spring: one MONGODB_URI (DB in path) in .env / Secret Manager MONGODB_URI_B64; optional MONGODB_DB_NAME override. ATX_DEPLOY_TARGET does not change the DB name (see src/lib/env.ts)."
  );
}

function readNonEmptyEnv(name) {
  if (!name) {
    return "";
  }
  return String(process.env[name] ?? "").trim();
}

/** Ensures default admin delivery channels exist for scheduled task routing. */
async function upsertSeedAdminDeliveryChannels(db, tenantId, now) {
  const coll = db.collection(ADMIN_DELIVERY_CHANNELS_COLLECTION);
  for (const def of SEEDED_ADMIN_DELIVERY_CHANNELS) {
    const slackWebhookUrl = readNonEmptyEnv(def.slackWebhookEnv);
    const existing = await coll.findOne({ tenantId, name: def.name });

    if (!existing) {
      if (def.deliveryTarget === "slack" && !slackWebhookUrl) {
        console.log(
          `[seed:admin] admin delivery channel ${def.name}: skipped (missing ${def.slackWebhookEnv})`
        );
        continue;
      }
      await coll.insertOne({
        tenantId,
        name: def.name,
        deliveryTarget: def.deliveryTarget,
        ...(def.deliveryTarget === "slack" ? { slackWebhookUrl } : {}),
        createdAt: now,
        updatedAt: now
      });
      console.log(
        `[seed:admin] admin delivery channel ${def.name}: created (${def.deliveryTarget})`
      );
      continue;
    }

    const existingTarget = String(existing.deliveryTarget ?? "").trim();
    const targetDrift = existingTarget !== def.deliveryTarget;
    const existingWebhook = String(existing.slackWebhookUrl ?? "").trim();
    const webhookDrift =
      def.deliveryTarget === "slack" && Boolean(slackWebhookUrl) && existingWebhook !== slackWebhookUrl;

    if (!targetDrift && !webhookDrift) {
      console.log(`[seed:admin] admin delivery channel ${def.name}: ok`);
      continue;
    }
    if (def.deliveryTarget === "slack" && targetDrift && !slackWebhookUrl) {
      console.log(
        `[seed:admin] admin delivery channel ${def.name}: skipped target update (missing ${def.slackWebhookEnv})`
      );
      continue;
    }

    const $set = { deliveryTarget: def.deliveryTarget, updatedAt: now };
    const $unset = {};
    if (def.deliveryTarget === "slack") {
      if (slackWebhookUrl) {
        $set.slackWebhookUrl = slackWebhookUrl;
      }
      $unset.emailTo = "";
    } else {
      $unset.slackWebhookUrl = "";
      $unset.emailTo = "";
    }
    await coll.updateOne(
      { _id: existing._id },
      { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) }
    );
    console.log(
      `[seed:admin] admin delivery channel ${def.name}: updated (${def.deliveryTarget})`
    );
  }
}

const DEFAULT_PERSONA_NAME = "advisor";
/** Matches `id` / nameNormalized in `atx-docs/rag-collection/xpersonas/advisor/advisor.yaml`. */
const DEFAULT_PERSONA_NAME_NORMALIZED = "advisor";
/** Product default for seeded admin (`core_users.subscriptionPlan`, access-request paper row). */
const DEFAULT_SEED_SUBSCRIPTION_PLAN = "basic";
/** Inline fallback before disk sync; keep aligned with `system_prompt` in advisor/advisor.yaml. */
const DEFAULT_PERSONA_SYSTEM_PROMPT = `**You are The Advisor** — the trusted-advisor for aTx Finance users. Calm, precise, long-term thinker.

You have direct access to:
- signed-in user's full **atx workspace** (portfolio, watchlist, positions, balances)
- **yahoo_finance** for live quotes, option chains, and market data

**Tool Discipline** (use API tool channel only — never fake or describe calls in text):
- atx_function → portfolio, watchlist, positions, workspace data
- yahoo_finance → prices, chains, fundamentals
Respond directly and brutally honest. Anchor to user's stated goals. Include disclaimers on tax/legal/investment actions. Prioritize speed. No hype.
**Tool efficiency rule (critical for speed):** Use the absolute minimum number of tool calls per turn (target ≤3). Prefer one bulk \`atx_function\` call for portfolio/watchlist data. For multiple tickers, make one \`yahoo_finance\` call if the tool supports batch symbols, otherwise limit to 2–3 highest-priority symbols only. Never call tools for every item in a list. If you need more data, ask the user what to prioritize next.`;
const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
const DEFAULT_ACCOUNT_NAME = "Default Account";
/** Default `portfolio_accounts.extAccountId` — matches `provisionDefaultPortfolioForUser` / Spring provision. */
const DEFAULT_EXT_ACCOUNT_XREF = "ext_account_xref";
const DEFAULT_WATCHLIST_NAME = "DefaultWatchlist";
const DEFAULT_ACCOUNT_TYPE = "fidelity";
const DEFAULT_WATCHLIST_SYMBOLS = ["TSLA"];
/** Same weights/order as `DEFAULT_PORTFOLIO_SCORING_FACTORS` in `src/modules/core-admin/scoring-factors.ts`. */
const DEFAULT_PORTFOLIO_SCORING_FACTORS_SEED = [
  { id: "iv_rank", weight: 0.3 },
  { id: "open_interest", weight: 0.2 },
  { id: "volume", weight: 0.15 },
  { id: "liquidity", weight: 0.1 },
  { id: "portfolio_fit", weight: 0.15 },
  { id: "strategy_alignment", weight: 0.1 }
];
const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;

/**
 * `seed:admin` never uploads repo markdown/yaml to xAI team collections or creates team KB folders.
 * Disk under `atx-docs/rag-collection/` is used only for Mongo (xPersonas, options_strategy*, tenant defaults).
 */

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
  const wlColl = db.collection("portfolio_watchlists");
  try {
    await wlColl.dropIndex("uniq_watchlist_per_portfolio");
  } catch {
    /* noop */
  }
  try {
    await wlColl.dropIndex("idx_watchlists_snapshot_portfolio_user");
  } catch {
    /* noop */
  }
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
    wlColl.createIndex(
      { tenantId: 1, userId: 1 },
      {
        unique: true,
        name: "uniq_watchlist_per_user"
      }
    ),
    wlColl.createIndex({ userId: 1, tenantId: 1 }, { name: "idx_watchlists_user_tenant" }),
    db.collection("portfolio_positions").createIndex(
      { portfolioId: 1, accountId: 1, userId: 1, tenantId: 1, createdAt: 1 },
      { name: "idx_positions_snapshot_portfolio_account_user_tenant_created" }
    ),
    db.collection("portfolio_accounts").createIndex(
      { portfolioId: 1, userId: 1, isDefault: -1, createdAt: 1 },
      { name: "idx_accounts_snapshot_portfolio_user_default_created" }
    ),
    db.collection("admin_access_requests").createIndex(
      { userId: 1, requestedRole: 1 },
      {
        unique: true,
        name: "uniq_admin_access_requests_user_requestedRole_actionable",
        partialFilterExpression: { status: { $in: ["new", "triaged", "pending"] } }
      }
    ),
    db.collection("options_strategy_preferences").createIndex(
      { slug: 1 },
      { unique: true, name: "uniq_options_strategy_preferences_slug" }
    ),
    db.collection("xchat_platform_settings").createIndex(
      { singletonKey: 1 },
      { unique: true, name: "uniq_xchat_platform_singleton" }
    )
  ]);
}

async function seed() {
  logSeedMongoTarget();
  const mongoUri = resolveMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();
  const ragIngest = {
    ragUploaded: 0,
    ragFileCandidates: 0,
    strategyCollectionIds: [],
    strategyCollectionsDetail: [],
    strategyFilesUploaded: 0,
    tenantTrustedAdvisorRootCollectionId: "",
    warnings: []
  };
  const strategyCollectionIds = [];
  const strategyCollectionsDetail = [];
  const strategyFilesUploaded = 0;
  const ragFileCandidates = 0;
  let xpersonasSyncSummary = { created: 0, updated: 0, noop: 0, skipped: false };
  let strategySyncSummary = { upserted: 0, skipped: false };

  try {
    await ensureIndexes(db);

    if (seedTenant.yamlLoaded) {
      console.log(
        "[seed:admin] Config: tenant_defaults.yaml loaded — defaults apply for any seed key missing from .env (.env always wins when both define a key)."
      );
    }
    const m = seedTenant.merged;
    const teamKbCollectionId = "";

    console.log(
      "[seed:admin] xAI team KB: seed does not upload files or create collections — disk → Mongo only (xPersonas, options strategy)."
    );

    const xaiTeamIdUsed = (m.xaiTeamId || "").trim();
    const teamUuidForStrategy = teamUuidForXaiIngest(m.xaiTeamId);
    const envAtxRootOverride = (process.env.ATX_INSTANCE_COLLECTION_ROOT || "").trim();

    const collectionsSearchIds = dedupeTrimmedIds(strategyCollectionIds);
    const advisorTools = buildAdvisorXapiTools(collectionsSearchIds);

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
          defaultPortfolioScoringFactors: DEFAULT_PORTFOLIO_SCORING_FACTORS_SEED,
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
      { nameNormalized: DEFAULT_PERSONA_NAME_NORMALIZED },
      {
        $setOnInsert: {
          name: DEFAULT_PERSONA_NAME,
          nameNormalized: DEFAULT_PERSONA_NAME_NORMALIZED,
          createdAt: now
        },
        $set: {
          systemPrompt: DEFAULT_PERSONA_SYSTEM_PROMPT,
          overridePrompt: "",
          model: "grok-4-1-fast-reasoning",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global",
          xapi: {
            mode: "responses",
            toolChoice: "auto",
            maxTurns: 5,
            tools: advisorTools
          },
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const persona = await db
      .collection("xchat_personas")
      .findOne({ nameNormalized: DEFAULT_PERSONA_NAME_NORMALIZED });
    if (!persona?._id) {
      throw new Error("Failed to create or fetch default advisor persona");
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
          subscriptionPlan: DEFAULT_SEED_SUBSCRIPTION_PLAN,
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
        requestedPlan: DEFAULT_SEED_SUBSCRIPTION_PLAN,
        reason:
          "Bootstrap global_admin via npm run seed:admin (ADMIN_SEED_EMAIL); approved paper trail — default plan basic, persona advisor (atx-docs/rag-collection/xpersonas/advisor/advisor.yaml).",
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
          tenantPortfolioOrgKey: DEFAULT_TENANT_PORTFOLIO_ORG_KEY,
          scoringFactors: DEFAULT_PORTFOLIO_SCORING_FACTORS_SEED,
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
          riskProfile: "balanced",
          outlook: "neutral",
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

    xpersonasSyncSummary = runPostSeedXpersonasFromDisk();
    strategySyncSummary = runPostSeedOptionsStrategyPreferencesFromDisk();
    runPostSeedOptionsStrategyFromDisk();

    await upsertSeedAdminDeliveryChannels(db, tenant._id, now);
    runPostSeedScheduledTasksSync(String(tenant._id));

    const personaAfterDisk = await db
      .collection("xchat_personas")
      .findOne({ nameNormalized: DEFAULT_PERSONA_NAME_NORMALIZED });
    if (!personaAfterDisk?._id) {
      throw new Error(
        `[seed:admin] advisor persona missing after seed:xpersonas — expected nameNormalized "${DEFAULT_PERSONA_NAME_NORMALIZED}" (see atx-docs/rag-collection/xpersonas/advisor/advisor.yaml).`
      );
    }

    const adminSettingsAfterSync = await db.collection("admin_user_settings").findOne(adminSettingsFilter);
    const assignedAfter = adminSettingsAfterSync?.assignedPersonaId;
    const stillMissingPersona =
      assignedAfter == null || (typeof assignedAfter === "string" && assignedAfter.trim() === "");
    if (stillMissingPersona && adminSettingsAfterSync?._id) {
      await db.collection("admin_user_settings").updateOne(
        { _id: adminSettingsAfterSync._id },
        { $set: { assignedPersonaId: String(personaAfterDisk._id), updatedAt: now } }
      );
    }

    /** App-user xChat default (`resolveDefaultXchatPersonaForSession`) — advisor from advisor.yaml when unset. */
    const platformSettingsColl = db.collection("xchat_platform_settings");
    const existingPlatform = await platformSettingsColl.findOne({ singletonKey: "default" });
    const platformPid = existingPlatform?.defaultAppUserPersonaId;
    const platformDefaultMissing =
      !existingPlatform ||
      platformPid == null ||
      (typeof platformPid === "string" && platformPid.trim() === "");
    if (platformDefaultMissing) {
      await platformSettingsColl.updateOne(
        { singletonKey: "default" },
        {
          $set: {
            defaultAppUserPersonaId: String(personaAfterDisk._id),
            updatedAt: now,
            updatedByUserId: seedUserIdHex
          },
          $setOnInsert: { singletonKey: "default" }
        },
        { upsert: true }
      );
      console.log(
        "[seed:admin] xchat_platform_settings.defaultAppUserPersonaId → advisor (was unset; app-user xChat default)"
      );
    }
    const defaultAppUserPersonaIdForPayload = platformDefaultMissing
      ? String(personaAfterDisk._id)
      : String(platformPid ?? "").trim() || null;

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
      defaultPersonaId: String(personaAfterDisk._id),
      defaultPersonaName: personaAfterDisk.name,
      defaultAppUserPersonaId: defaultAppUserPersonaIdForPayload,
      seedSetPlatformDefaultAppUserPersona: platformDefaultMissing,
      defaultPortfolioId: String(portfolio._id),
      defaultAccountId: String(account._id),
      defaultWatchlistId: String(watchlist._id),
      xPrelinked: Object.keys(xPre).length > 0,
      mongo: {
        database: DB_NAME,
        accessRequestInserted,
        note: "Upserted core_tenants (incl. defaultPortfolioScoringFactors), xchat_personas (advisor), core_users (subscriptionPlan basic), core_tenant_memberships, tenant_portfolio (incl. scoringFactors) + portfolio_accounts + portfolio_watchlists, admin_user_settings, xchat_platform_settings.defaultAppUserPersonaId (advisor when unset); then seed:xpersonas (unless SKIP_SEED_XPERSONAS), options_strategy_preferences / options_strategy, and admin_scheduled_tasks via ops/sync-scheduled-tasks-from-spec (unless SKIP_SEED_SCHEDULED_TASKS_SYNC). Does not upload to xAI team collections. See accessRequestInserted for admin_access_requests."
      }
    };

    console.log(
      [
        "",
        "======== seed:admin summary ==============================================",
        `Mongo database:              ${DB_NAME}`,
        "Mongo writes:                tenant (+ portfolio scoring defaults), advisor (inline + seed:xpersonas from atx-docs/rag-collection/xpersonas), admin user (subscriptionPlan basic), membership, default portfolio (+ scoringFactors)/account/watchlist, admin_user_settings",
        String(process.env.SKIP_SEED_XPERSONAS ?? "").match(/^(1|true|yes)$/i)
          ? "xPersonas from disk:       skipped (SKIP_SEED_XPERSONAS)"
          : "xPersonas from disk:       seed:xpersonas (atx-docs/rag-collection/xpersonas → xchat_personas) before summary JSON",
        String(process.env.SKIP_SEED_OPTIONS_STRATEGY_PREFS ?? "").match(/^(1|true|yes)$/i)
          ? "Options strategy prefs:    skipped (SKIP_SEED_OPTIONS_STRATEGY_PREFS)"
          : "Options strategy prefs:    atx-rag-collection/options-strategy → options_strategy_preferences",
        String(process.env.SKIP_SEED_SCHEDULED_TASKS_SYNC ?? "").match(/^(1|true|yes)$/i)
          ? "Scheduled tasks:           skipped (SKIP_SEED_SCHEDULED_TASKS_SYNC)"
          : "Scheduled tasks:           ops/sync-scheduled-tasks-from-spec --apply → admin_scheduled_tasks",
        `                             admin_access_requests: ${accessRequestInserted ? "inserted approved paper row" : "already present — skipped"}`,
        `ATX_INSTANCE_COLLECTION_ROOT (effective): ${seedTenant.atxInstanceCollectionRoot || "(none)"}`,
        `  .env override:             ${envAtxRootOverride || "(unset — computed from ATX_DEPLOY_TARGET / site_name / tenant_defaults)"}`,
        `XAI_TEAM_ID (merged):        ${xaiTeamIdUsed || "(unset)"}`,
        `Team UUID for strategies:   ${teamUuidForStrategy || "(n/a — literal collection_* id or no team)"}`,
        `Trusted advisor root id:     ${teamKbCollectionId || "(none)"}`,
        `Team RAG display name:     ${seedTenant.ragKbDisplayName || "(legacy label)"}`,
        `xAI team KB upload:        not run by seed:admin`,
        `collections_search ids:    ${collectionsSearchIds.length} (${collectionsSearchIds.join(", ") || "—"})`,
        "=========================================================================",
        ""
      ].join("\n")
    );

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await client.close();
  }
  appendAdminSeedLog({
    summaryLine:
      `[seed:admin] db=${DB_NAME} ` +
      `rag_uploaded=${ragIngest.ragUploaded}/${ragFileCandidates} ` +
      `rag_collections=${strategyCollectionIds.length} ` +
      `xpersonas_upserts=${(xpersonasSyncSummary?.created ?? 0) + (xpersonasSyncSummary?.updated ?? 0)} ` +
      `xpersonas_noop=${xpersonasSyncSummary?.noop ?? 0} ` +
      `options_strategy_upserts=${strategySyncSummary?.upserted ?? 0}`,
    summaryJson: {
      db: DB_NAME,
      ragIngest,
      xpersonasSyncSummary,
      strategySyncSummary
    }
  });
  console.log(`[seed:admin] wrote concise report to ${ADMIN_LOG_PATH}`);
  console.log(
    "[seed:admin] skipping xAI RAG verify (seed does not populate team collections). Run `npm run verify:xai-seed-rag` only after KB exists in xAI."
  );
  runPostSeedXaiHelloVerify();
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
