#!/usr/bin/env node
/**
 * Optional verification for trusted-advisor RAG collections (xAI management API).
 *
 * Reads the latest `admin.log` JSON line with `ragIngest` (counts are zero after `seed:admin` unless you populated KB elsewhere).
 * Validates root + segment collections exist and linked-document counts meet expectations when summaries are non-empty.
 *
 * Exit 0 when verification passes or is explicitly skipped.
 * Exit 1 on missing collections/doc links or API failures.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
    collectionIdFromEntry,
    collectionNameFromEntry,
    managementListCollectionsRaw
} from "./lib/seed-xai-rag-ingest.mjs";
import { loadSeedTenantContext } from "./lib/tenant-defaults-seed.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const ADMIN_LOG_PATH = join(REPO_ROOT, "admin.log");

const skipFlag = String(process.env.SKIP_XAI_POST_SEED_RAG_VERIFY ?? "").toLowerCase();
if (skipFlag === "1" || skipFlag === "true" || skipFlag === "yes") {
  console.log("[verify-xai-seed-rag] skip (SKIP_XAI_POST_SEED_RAG_VERIFY)");
  process.exit(0);
}

function readLatestSeedSummaryFromAdminLog() {
  const text = readFileSync(ADMIN_LOG_PATH, "utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith("{") || !line.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed?.ragIngest && typeof parsed.ragIngest === "object") {
        return parsed;
      }
    } catch {
      // ignore malformed JSON lines and continue scanning backwards
    }
  }
  return null;
}

async function listCollectionDocumentsRaw({ mgmtBase, mgmtKey, teamId, collectionId }) {
  const base = String(mgmtBase || "").replace(/\/$/, "");
  const cid = encodeURIComponent(collectionId);
  const candidates = [];
  if (teamId) {
    candidates.push(`${base}/collections/${cid}/documents?team_id=${encodeURIComponent(teamId)}`);
  }
  candidates.push(`${base}/collections/${cid}/documents`);

  let lastError = "";
  for (const url of candidates) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${mgmtKey}` }
    });
    const bodyText = await res.text();
    let payload = {};
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = {};
    }
    if (!res.ok) {
      const errorBody =
        payload && Object.keys(payload).length > 0 ? (payload.error ?? payload) : bodyText.slice(0, 500);
      lastError = `HTTP ${res.status} ${JSON.stringify(errorBody)}`;
      continue;
    }
    const rows = [payload.data, payload.results, payload.documents, payload.items].find(Array.isArray);
    return Array.isArray(rows) ? rows : [];
  }

  throw new Error(
    `failed listing documents for collection ${collectionId}: ${lastError || "unknown error"}`
  );
}

function normalizeExpectedCollections({ latestSummary, trustedAdvisorDeploySlug }) {
  const details = latestSummary?.ragIngest?.strategyCollectionsDetail;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((row) => ({
        collectionId: String(row?.collectionId ?? "").trim(),
        displayName: String(row?.displayName ?? "").trim(),
        minDocs: Number.isFinite(row?.filesUploaded) ? Number(row.filesUploaded) : 0
      }))
      .filter((row) => row.collectionId && row.displayName);
  }

  // Fallback path when admin.log is missing old lines.
  const root = `atx-trusted-advisor-${trustedAdvisorDeploySlug}`;
  const names = [
    root,
    `${root}/xchat-history`,
    `${root}/finance-core`,
    `${root}/xpersonas`,
    `${root}/example-prompts`,
    `${root}/options-strategy`
  ];
  return names.map((name) => ({ collectionId: "", displayName: name, minDocs: 1 }));
}

async function main() {
  const seedTenant = loadSeedTenantContext(REPO_ROOT);
  const mgmtKey = String(seedTenant.merged.xaiMgmtKey ?? "").trim();
  const mgmtBase = String(seedTenant.merged.xaiMgmtBaseUrl ?? "").trim();
  const teamId = String(seedTenant.merged.xaiTeamId ?? "").trim();

  if (!mgmtKey) {
    console.warn("[verify-xai-seed-rag] skip: XAI_MANAGEMENT_API_KEY unset");
    process.exit(0);
  }
  if (!mgmtBase) {
    console.error("[verify-xai-seed-rag] XAI_MANAGEMENT_BASE_URL is empty");
    process.exit(1);
  }

  const latestSummary = readLatestSeedSummaryFromAdminLog();
  const expected = normalizeExpectedCollections({
    latestSummary,
    trustedAdvisorDeploySlug: seedTenant.trustedAdvisorDeploySlug
  });
  if (expected.length === 0) {
    console.error("[verify-xai-seed-rag] no expected collections to verify");
    process.exit(1);
  }

  const collectionRows = await managementListCollectionsRaw(mgmtKey, mgmtBase, teamId);
  const byId = new Map();
  const byName = new Map();
  for (const row of collectionRows) {
    const id = collectionIdFromEntry(row);
    const name = collectionNameFromEntry(row);
    if (id) {
      byId.set(id, row);
    }
    if (name) {
      byName.set(name.toLowerCase(), row);
    }
  }

  const failures = [];
  const passes = [];
  for (const item of expected) {
    const fromId = item.collectionId ? byId.get(item.collectionId) : undefined;
    const fromName = byName.get(item.displayName.toLowerCase());
    const resolved = fromId ?? fromName;
    if (!resolved) {
      failures.push(`missing collection: ${item.displayName}${item.collectionId ? ` (${item.collectionId})` : ""}`);
      continue;
    }

    const resolvedId = collectionIdFromEntry(resolved);
    const resolvedName = collectionNameFromEntry(resolved) || item.displayName;
    if (!resolvedId) {
      failures.push(`collection has no id: ${resolvedName}`);
      continue;
    }

    let docCount = -1;
    try {
      const docs = await listCollectionDocumentsRaw({
        mgmtBase,
        mgmtKey,
        teamId,
        collectionId: resolvedId
      });
      docCount = docs.length;
    } catch (error) {
      failures.push(`${resolvedName} (${resolvedId}) document-list check failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }

    if (docCount < item.minDocs) {
      failures.push(
        `${resolvedName} (${resolvedId}) has ${docCount} docs; expected >= ${item.minDocs}`
      );
      continue;
    }
    passes.push(`${resolvedName} (${resolvedId}) docs=${docCount} expected>=${item.minDocs}`);
  }

  if (failures.length > 0) {
    console.error("[verify-xai-seed-rag] FAILED");
    for (const line of failures) {
      console.error(` - ${line}`);
    }
    if (passes.length > 0) {
      console.error("[verify-xai-seed-rag] partial pass:");
      for (const line of passes) {
        console.error(` + ${line}`);
      }
    }
    process.exit(1);
  }

  console.log("[verify-xai-seed-rag] PASS");
  for (const line of passes) {
    console.log(` + ${line}`);
  }
}

main().catch((error) => {
  console.error("[verify-xai-seed-rag]", error instanceof Error ? error.message : error);
  process.exit(1);
});
