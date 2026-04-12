#!/usr/bin/env node
/**
 * Local / test Mongo cleanup (plain `mongodb` driver — avoids loading the Next/tsx graph).
 *
 * - Dedupes legacy `portfolio_watchlists` where `tenantId` is null/absent when the same user already has a
 *   tenant-scoped (ObjectId) row.
 * - Optional `--purge-user-email-regex=…` / `--purge-tenant-slug-regex=…` (skips `ADMIN_SEED_EMAIL`, all
 *   `global_admin` users, and the default `core_tenants` row; use `--keep-tenant-ids=hex,hex` to pin more tenants).
 *
 * Default: dry-run. Mutations: `--apply --accept-test-db-risk`.
 *
 * Usage:
 *   node --env-file=.env scripts/ops/cleanup-test-mongo.mjs
 *   node --env-file=.env scripts/ops/cleanup-test-mongo.mjs --apply --accept-test-db-risk
 *   node --env-file=.env scripts/ops/cleanup-test-mongo.mjs --file=.env.local --purge-tenant-slug-regex='^test-' --apply --accept-test-db-risk
 *
 * @see `npm run migrate:merge-user-watchlists` for merging multiple real rows per (tenantId, userId).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient, ObjectId } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "../lib/resolve-mongo-uri.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "../..");

const TENANT_PORTFOLIO = "tenant_portfolio";
const ACCOUNTS = "portfolio_accounts";
const POSITIONS = "portfolio_positions";
const RECS = "portfolio_recommendations";
const ALERTS = "portfolio_alerts";
const PF_DELIVERY = "portfolio_delivery_channels";
const WATCHLISTS = "portfolio_watchlists";

const CORE_USERS = "core_users";
const CORE_TENANTS = "core_tenants";
const MEMBERSHIPS = "core_tenant_memberships";

const ADMIN_SCHEDULED_TASKS = "admin_scheduled_tasks";
const ADMIN_TASK_RUNS = "admin_task_runs";
const ADMIN_DELIVERY_CHANNELS = "admin_delivery_channels";
const ADMIN_ACCESS_REQUESTS = "admin_access_requests";
const ADMIN_USER_SETTINGS = "admin_user_settings";
const ADMIN_DEPLOY_NOTE_CONFIGS = "admin_deploy_note_configs";

const XAI_MANAGEMENT_BASE_URL_DEFAULT = "https://management-api.x.ai/v1";

function loadEnvFromFile(filePath) {
  const abs = filePath.startsWith("/") ? filePath : join(REPO_ROOT, filePath);
  const raw = readFileSync(abs, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) {
      process.env[key] = val;
    }
  }
}

function extractEnvFilePath(argv) {
  for (const arg of argv) {
    const m = arg.match(/^--(?:file|env-file)=(.+)$/);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  return null;
}

function parseRegexFlag(argv, name) {
  const prefix = `${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      const raw = arg.slice(prefix.length);
      try {
        return new RegExp(raw);
      } catch {
        throw new Error(`Invalid regex for ${name}: ${raw}`);
      }
    }
  }
  return null;
}

function parseKeepTenantIds(argv) {
  const prefix = "--keep-tenant-ids=";
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      return new Set(
        arg
          .slice(prefix.length)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      );
    }
  }
  return new Set();
}

function userKey(raw) {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (raw instanceof ObjectId) {
    return raw.toHexString();
  }
  if (typeof raw === "object" && raw !== null && typeof raw.toHexString === "function") {
    try {
      return raw.toHexString();
    } catch {
      /* ignore */
    }
  }
  return String(raw);
}

function normEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function mongoUserIdQuery(userId) {
  if (ObjectId.isValid(userId)) {
    return { userId: { $in: [userId, new ObjectId(userId)] } };
  }
  return { userId };
}

/** Mirrors `mongoPortfolioFamilyUserScope(..., allowLegacyUserScope)` for watchlist/portfolio family. */
function portfolioFamilyUserScope(userId, tenantHex) {
  const base = mongoUserIdQuery(userId);
  const oid = tenantHex && ObjectId.isValid(tenantHex) ? new ObjectId(tenantHex) : null;
  if (!oid) {
    return base;
  }
  return {
    ...base,
    $or: [{ tenantId: oid }, { tenantId: { $type: "null" } }, { tenantId: { $exists: false } }]
  };
}

function portfolioOwnerHex(userId) {
  return typeof userId === "string" ? userId : userId.toHexString();
}

function portfolioTenantHex(doc) {
  return doc.tenantId instanceof ObjectId ? doc.tenantId.toHexString() : undefined;
}

async function adminDeletePortfolio(db, portfolioIdHex) {
  if (!ObjectId.isValid(portfolioIdHex)) {
    return false;
  }
  const pid = new ObjectId(portfolioIdHex);
  const portfolio = await db.collection(TENANT_PORTFOLIO).findOne({ _id: pid });
  if (!portfolio?._id) {
    return false;
  }
  const ownerHex = portfolioOwnerHex(portfolio.userId);
  const tenantStr = portfolioTenantHex(portfolio);
  const uid = mongoUserIdQuery(ownerHex);
  const baseFilter = { portfolioId: pid, ...uid };

  await db.collection(POSITIONS).deleteMany(baseFilter);
  await db.collection(RECS).deleteMany(baseFilter);
  await db.collection(ALERTS).deleteMany(baseFilter);
  await db.collection(PF_DELIVERY).deleteMany(baseFilter);
  await db.collection(ACCOUNTS).deleteMany(baseFilter);

  const res = await db.collection(TENANT_PORTFOLIO).deleteOne({ _id: pid });
  const deleted = (res.deletedCount ?? 0) === 1;
  if (deleted) {
    const remaining = await db.collection(TENANT_PORTFOLIO).countDocuments(portfolioFamilyUserScope(ownerHex, tenantStr));
    if (remaining === 0) {
      await db.collection(WATCHLISTS).deleteMany(portfolioFamilyUserScope(ownerHex, tenantStr));
    }
  }
  return deleted;
}

async function deleteAllPortfoliosOwnedByUser(db, userIdHex) {
  const rows = await db
    .collection(TENANT_PORTFOLIO)
    .find({ ...mongoUserIdQuery(userIdHex) })
    .project({ _id: 1 })
    .toArray();
  let n = 0;
  for (const row of rows) {
    if (row._id && (await adminDeletePortfolio(db, row._id.toHexString()))) {
      n += 1;
    }
  }
  return n;
}

async function purgeCoreUserAssociatedData(db, userIdHex, emailNormalizedForKeys) {
  if (!ObjectId.isValid(userIdHex)) {
    return;
  }
  const oid = new ObjectId(userIdHex);
  const uidQ = mongoUserIdQuery(userIdHex);

  await deleteAllPortfoliosOwnedByUser(db, userIdHex);

  await db.collection(MEMBERSHIPS).deleteMany({ userId: oid });
  await db.collection(ADMIN_ACCESS_REQUESTS).deleteMany({ userId: userIdHex });
  await db.collection(ADMIN_USER_SETTINGS).deleteMany({ userId: userIdHex });
  await db.collection("options_strategy_preferences").deleteMany(uidQ);
  await db.collection("app_user_recommendations").deleteMany(uidQ);
  await db.collection("xchat_logs").deleteMany({
    $or: [{ userId: oid }, { userId: userIdHex }]
  });
  await db.collection("xchat_user_preferences").deleteMany({ userId: oid });
  await db.collection("app_feature_daily_usage").deleteMany({ userId: userIdHex });
  await db.collection("strategy_jobs").deleteMany(uidQ);

  const em = emailNormalizedForKeys?.trim() ? normEmail(emailNormalizedForKeys) : "";
  if (em) {
    await db.collection("audit_login").deleteMany({
      $or: [{ userId: userIdHex }, { email: em }]
    });
    await db.collection("admin_user_bootstrap_profiles").deleteMany({
      $or: [{ userId: userIdHex }, { emailNormalized: em }]
    });
    await db.collection(ADMIN_SCHEDULED_TASKS).deleteMany({
      name: `access-request-bootstrap:${em}`
    });
  } else {
    await db.collection("audit_login").deleteMany({ userId: userIdHex });
    await db.collection("admin_user_bootstrap_profiles").deleteMany({ userId: userIdHex });
  }
}

async function deleteCoreUserById(db, userId) {
  const res = await db.collection(CORE_USERS).deleteOne({ _id: userId });
  return res.deletedCount === 1;
}

async function tryDeleteXaiTeamCollection(collectionId) {
  const id = collectionId?.trim?.() ?? "";
  if (!id) {
    return { ok: true, outcome: "no_collection_id" };
  }
  const key = process.env.XAI_MANAGEMENT_API_KEY?.trim() ?? "";
  const baseUrl = (process.env.XAI_MANAGEMENT_BASE_URL ?? XAI_MANAGEMENT_BASE_URL_DEFAULT).replace(/\/$/, "");
  if (!key) {
    console.warn("[cleanup-test-mongo] XAI_MANAGEMENT_API_KEY missing; skipping xAI collection delete", { id });
    return { ok: true, outcome: "skipped_no_management_key", collectionId: id };
  }
  const response = await fetch(`${baseUrl}/collections/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` }
  });
  if (response.ok) {
    return { ok: true, outcome: "deleted", collectionId: id };
  }
  const text = await response.text().catch(() => "");
  const lowered = text.toLowerCase();
  if (response.status === 404 || lowered.includes("not found")) {
    return { ok: true, outcome: "already_absent", collectionId: id };
  }
  return { ok: false, outcome: "failed", collectionId: id, message: text.slice(0, 500) };
}

async function deleteTenantIfNoMembershipsScript(db, tenantIdHex) {
  if (!ObjectId.isValid(tenantIdHex)) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const id = new ObjectId(tenantIdHex);
  const tenant = await db.collection(CORE_TENANTS).findOne({ _id: id });
  if (!tenant) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (tenant.isDefault) {
    return { ok: false, code: "PLATFORM_DEFAULT" };
  }
  const n = await db.collection(MEMBERSHIPS).countDocuments({ tenantId: id });
  if (n > 0) {
    return { ok: false, code: "HAS_MEMBERS" };
  }

  const xaiId = tenant.tenantPreferences?.xchat_team_attachments_collection_id?.trim?.() ?? "";
  const xai = await tryDeleteXaiTeamCollection(xaiId);
  if (!xai.ok) {
    return { ok: false, code: "XAI_COLLECTION_DELETE_FAILED", xaiError: xai.message };
  }

  const del = await db.collection(CORE_TENANTS).deleteOne({ _id: id });
  if (del.deletedCount !== 1) {
    return { ok: false, code: "NOT_FOUND" };
  }
  return { ok: true, xai };
}

async function dropLegacyWatchlistIndexesIfPresent(db) {
  const wl = db.collection(WATCHLISTS);
  for (const name of ["uniq_watchlist_per_portfolio", "idx_watchlists_snapshot_portfolio_user"]) {
    try {
      await wl.dropIndex(name);
    } catch {
      /* missing */
    }
  }
}

/** Mirrors `ensurePortfolioIndexes` portfolio-family subset (see `repository.ts`). */
async function ensurePortfolioIndexesLocal(db) {
  await dropLegacyWatchlistIndexesIfPresent(db);
  await Promise.all([
    db.collection(TENANT_PORTFOLIO).createIndex(
      { tenantId: 1, userId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_portfolio_per_user"
      }
    ),
    db.collection(TENANT_PORTFOLIO).createIndex(
      { tenantId: 1, userId: 1, name: 1 },
      { unique: true, name: "uniq_portfolio_name_per_user" }
    ),
    db.collection(TENANT_PORTFOLIO).createIndex(
      { tenantPortfolioOrgKey: 1, tenantId: 1 },
      { name: "idx_tenant_portfolio_org_tenant" }
    ),
    db.collection(ACCOUNTS).createIndex(
      { tenantId: 1, portfolioId: 1, isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_account_per_portfolio"
      }
    ),
    db.collection(ACCOUNTS).createIndex(
      { portfolioId: 1, userId: 1, isDefault: -1, createdAt: 1 },
      { name: "idx_accounts_snapshot_portfolio_user_default_created" }
    ),
    db.collection(WATCHLISTS).createIndex(
      { tenantId: 1, userId: 1 },
      { unique: true, name: "uniq_watchlist_per_user" }
    ),
    db.collection(WATCHLISTS).createIndex({ userId: 1, tenantId: 1 }, { name: "idx_watchlists_user_tenant" }),
    db.collection(POSITIONS).createIndex(
      { tenantId: 1, portfolioId: 1, accountId: 1, symbol: 1 },
      { name: "idx_positions_tenant_portfolio_account_symbol" }
    ),
    db.collection(POSITIONS).createIndex(
      { portfolioId: 1, accountId: 1, userId: 1, tenantId: 1, createdAt: 1 },
      { name: "idx_positions_snapshot_portfolio_account_user_tenant_created" }
    ),
    db.collection(POSITIONS).createIndex(
      { tenantId: 1, portfolioId: 1, accountId: 1, yahooRef: 1 },
      {
        unique: true,
        partialFilterExpression: {
          yahooRef: { $exists: true, $type: "string", $gt: "" }
        },
        name: "uniq_positions_account_yahoo_ref"
      }
    ),
    db.collection(RECS).createIndex(
      { tenantId: 1, portfolioId: 1, createdAt: 1 },
      { name: "idx_recommendations_tenant_portfolio_createdAt" }
    ),
    db.collection(ALERTS).createIndex(
      { tenantId: 1, portfolioId: 1, createdAt: -1 },
      { name: "idx_portfolio_alerts_tenant_portfolio_createdAt" }
    ),
    db.collection(PF_DELIVERY).createIndex(
      { tenantId: 1, portfolioId: 1, label: 1 },
      { name: "idx_portfolio_delivery_channels_tenant_portfolio_label" }
    )
  ]);
}

async function buildProtectedUserIds(db) {
  const ids = new Set();
  const seedEmail = process.env.ADMIN_SEED_EMAIL?.trim() || null;
  if (seedEmail) {
    const u = await db.collection(CORE_USERS).findOne({ email: normEmail(seedEmail) });
    if (u?._id) {
      ids.add(u._id.toHexString());
    }
  }
  const admins = await db
    .collection(CORE_USERS)
    .find({ roles: "global_admin" })
    .project({ _id: 1 })
    .toArray();
  for (const row of admins) {
    if (row._id) {
      ids.add(row._id.toHexString());
    }
  }
  return { ids, seedEmail };
}

async function membershipCountForUser(db, userId) {
  return db.collection(MEMBERSHIPS).countDocuments({ userId });
}

async function dedupeNullTenantWatchlists(db, apply) {
  const coll = db.collection(WATCHLISTS);
  const realRows = await coll
    .find({ tenantId: { $type: "objectId" } })
    .project({ userId: 1 })
    .toArray();
  const realUserKeys = new Set(realRows.map((r) => userKey(r.userId)).filter(Boolean));

  const nullDocs = await coll
    .find({
      $or: [{ tenantId: null }, { tenantId: { $exists: false } }]
    })
    .toArray();

  const idsToDelete = [];
  for (const doc of nullDocs) {
    const uk = userKey(doc.userId);
    if (!uk || !realUserKeys.has(uk)) {
      continue;
    }
    if (doc._id) {
      idsToDelete.push(doc._id);
    }
  }

  if (!apply || idsToDelete.length === 0) {
    return { wouldDelete: idsToDelete.length, deleted: 0 };
  }
  const res = await coll.deleteMany({ _id: { $in: idsToDelete } });
  return { wouldDelete: idsToDelete.length, deleted: res.deletedCount ?? 0 };
}

async function purgeUsersByEmail(db, regex, protectedIds, apply, allowMulti) {
  const users = await db.collection(CORE_USERS).find({}).toArray();
  let candidates = 0;
  let purged = 0;
  let skipped = 0;

  for (const u of users) {
    if (!u._id || !regex.test(u.email ?? "")) {
      continue;
    }
    const hex = u._id.toHexString();
    if (protectedIds.has(hex)) {
      skipped += 1;
      console.warn(`[cleanup-test-mongo] skip user (protected): ${u.email} (${hex})`);
      continue;
    }
    const mc = await membershipCountForUser(db, u._id);
    if (mc > 1 && !allowMulti) {
      skipped += 1;
      console.warn(
        `[cleanup-test-mongo] skip user (${mc} memberships, use --allow-multi-tenant-user-purge): ${u.email}`
      );
      continue;
    }
    candidates += 1;
    if (!apply) {
      continue;
    }
    await purgeCoreUserAssociatedData(db, hex, normEmail(u.email));
    if (await deleteCoreUserById(db, u._id)) {
      purged += 1;
    }
  }

  return { candidates, purged, skipped };
}

async function deleteTenantAncillary(db, tenantId) {
  await db.collection(ADMIN_SCHEDULED_TASKS).deleteMany({ tenantId });
  await db.collection(ADMIN_TASK_RUNS).deleteMany({ tenantId });
  await db.collection(ADMIN_DELIVERY_CHANNELS).deleteMany({ tenantId });
  await db.collection(ADMIN_ACCESS_REQUESTS).deleteMany({ tenantId });
  await db.collection(ADMIN_USER_SETTINGS).deleteMany({ tenantId });
  await db.collection(ADMIN_DEPLOY_NOTE_CONFIGS).deleteMany({ tenantId });
  await db.collection(WATCHLISTS).deleteMany({ tenantId });
  await db.collection(MEMBERSHIPS).deleteMany({ tenantId });
}

async function purgeTenantsBySlug(db, slugRegex, protectedTenantIds, protectedUserIds, apply, allowMulti) {
  const tenants = await db.collection(CORE_TENANTS).find({}).toArray();
  let candidates = 0;
  let removed = 0;
  let skipped = 0;

  for (const t of tenants) {
    if (!t._id || t.isDefault) {
      continue;
    }
    const tidHex = t._id.toHexString();
    if (protectedTenantIds.has(tidHex)) {
      continue;
    }
    if (!slugRegex.test(t.slug ?? "")) {
      continue;
    }

    const memberships = await db
      .collection(MEMBERSHIPS)
      .find({ tenantId: t._id })
      .project({ userId: 1 })
      .toArray();

    let block = false;
    for (const m of memberships) {
      if (!m.userId) {
        continue;
      }
      const uhex = m.userId.toHexString();
      if (protectedUserIds.has(uhex)) {
        console.warn(
          `[cleanup-test-mongo] skip tenant ${t.slug} (${tidHex}): protected user member ${uhex}`
        );
        block = true;
        break;
      }
      const mc = await membershipCountForUser(db, m.userId);
      if (mc > 1 && !allowMulti) {
        console.warn(
          `[cleanup-test-mongo] skip tenant ${t.slug}: user ${uhex} has ${mc} memberships (use --allow-multi-tenant-user-purge)`
        );
        block = true;
        break;
      }
    }
    if (block) {
      skipped += 1;
      continue;
    }

    candidates += 1;
    if (!apply) {
      continue;
    }

    for (const m of memberships) {
      if (!m.userId) {
        continue;
      }
      const u = await db.collection(CORE_USERS).findOne({ _id: m.userId });
      if (!u?._id) {
        await db.collection(MEMBERSHIPS).deleteMany({ tenantId: t._id, userId: m.userId });
        continue;
      }
      const uhex = u._id.toHexString();
      await purgeCoreUserAssociatedData(db, uhex, normEmail(u.email));
      await deleteCoreUserById(db, u._id);
    }

    const portfolios = await db
      .collection(TENANT_PORTFOLIO)
      .find({ tenantId: t._id })
      .project({ _id: 1 })
      .toArray();
    for (const p of portfolios) {
      if (p._id) {
        await adminDeletePortfolio(db, p._id.toHexString());
      }
    }

    await deleteTenantAncillary(db, t._id);

    const delResult = await deleteTenantIfNoMembershipsScript(db, tidHex);
    if (delResult.ok) {
      removed += 1;
      console.log(`[cleanup-test-mongo] removed tenant ${t.slug} (${tidHex})`, delResult);
    } else {
      console.warn(`[cleanup-test-mongo] tenant ${t.slug} not removed:`, delResult);
      skipped += 1;
    }
  }

  return { candidates, removed, skipped };
}

async function main() {
  const argv = process.argv.slice(2);
  const envFile = extractEnvFilePath(argv);
  if (envFile) {
    loadEnvFromFile(envFile);
  }

  const apply = argv.includes("--apply");
  const acceptRisk = argv.includes("--accept-test-db-risk");
  const dedupeNullWatchlists = !argv.includes("--no-dedupe-watchlists");
  const purgeUserEmailRegex = parseRegexFlag(argv, "--purge-user-email-regex");
  const purgeTenantSlugRegex = parseRegexFlag(argv, "--purge-tenant-slug-regex");
  const keepTenantIds = parseKeepTenantIds(argv);
  const allowMulti = argv.includes("--allow-multi-tenant-user-purge");

  if (apply && !acceptRisk) {
    console.error(
      "[cleanup-test-mongo] Refusing --apply without --accept-test-db-risk (local/test DBs only)."
    );
    process.exitCode = 1;
    return;
  }

  const uri = resolveMongoUri();
  const dbName = resolveSeedDbName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const { ids: protectedUserIds, seedEmail } = await buildProtectedUserIds(db);
    const defaultTenant = await db.collection(CORE_TENANTS).findOne({ isDefault: true });
    const protectedTenantIds = new Set(keepTenantIds);
    if (defaultTenant?._id) {
      protectedTenantIds.add(defaultTenant._id.toHexString());
    }

    console.log("[cleanup-test-mongo] mode:", apply ? "APPLY" : "dry-run");
    console.log("[cleanup-test-mongo] db:", dbName);
    console.log("[cleanup-test-mongo] ADMIN_SEED_EMAIL:", seedEmail ?? "(unset)");
    console.log("[cleanup-test-mongo] protected user ids:", [...protectedUserIds].join(", ") || "(none)");
    console.log(
      "[cleanup-test-mongo] protected tenant ids:",
      [...protectedTenantIds].join(", ") || "(none)"
    );

    if (dedupeNullWatchlists) {
      const w = await dedupeNullTenantWatchlists(db, apply);
      console.log(
        "[cleanup-test-mongo] dedupe null-tenant watchlists:",
        apply ? `deleted ${w.deleted}` : `would delete ${w.wouldDelete}`
      );
    }

    if (purgeUserEmailRegex) {
      const u = await purgeUsersByEmail(db, purgeUserEmailRegex, protectedUserIds, apply, allowMulti);
      console.log(
        "[cleanup-test-mongo] purge users by email:",
        apply
          ? `candidates ${u.candidates}, purged ${u.purged}, skipped ${u.skipped}`
          : `would consider ${u.candidates} (skipped protected/multi-tenant: ${u.skipped})`
      );
    }

    if (purgeTenantSlugRegex) {
      const t = await purgeTenantsBySlug(
        db,
        purgeTenantSlugRegex,
        protectedTenantIds,
        protectedUserIds,
        apply,
        allowMulti
      );
      console.log(
        "[cleanup-test-mongo] purge tenants by slug:",
        apply
          ? `candidates ${t.candidates}, removed ${t.removed}, skipped ${t.skipped}`
          : `would consider ${t.candidates} (skipped: ${t.skipped})`
      );
    }

    if (apply) {
      await ensurePortfolioIndexesLocal(db);
      console.log("[cleanup-test-mongo] ensurePortfolioIndexes (local): done");
    }
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[cleanup-test-mongo] fatal:", err);
  process.exitCode = 1;
});
