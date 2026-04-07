#!/usr/bin/env node
/**
 * Manual disk → xAI team KB upload (trusted-advisor segment collections + file ingest).
 * Not run by `npm run seed:admin` unless `SEED_ADMIN_XAI_RAG_INGEST=1`.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runSeedXaiRagIngest } from "./lib/seed-xai-rag-ingest.mjs";
import { loadSeedTenantContext } from "./lib/tenant-defaults-seed.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const seedTenant = loadSeedTenantContext(REPO_ROOT);
const RAG_SYNC_SUMMARY_MARKER = "SEED_ADMIN_RAG_SYNC_JSON=";

function shouldSkipSeedXaiRagIngest() {
  const s = String(process.env.SKIP_SEED_XAI_RAG_INGEST ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function teamUuidForXaiIngest(teamIdMerged) {
  const raw = String(teamIdMerged || "").trim();
  if (!raw || /^collection_[A-Za-z0-9_-]+$/.test(raw)) {
    return "";
  }
  return raw;
}

function runPostSeedXaiRagVerify() {
  const s = String(process.env.SKIP_XAI_POST_SEED_RAG_VERIFY ?? "").toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    console.log("[seed:admin:rag-sync] SKIP_XAI_POST_SEED_RAG_VERIFY set — skipping xAI RAG verify");
    return;
  }
  const verifyScript = join(SCRIPT_DIR, "verify-xai-seed-rag.mjs");
  const result = spawnSync(process.execPath, [verifyScript], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  if (shouldSkipSeedXaiRagIngest()) {
    console.log("[seed:admin:rag-sync] SKIP_SEED_XAI_RAG_INGEST set — skipping disk → xAI collection ingest");
    process.exit(0);
  }

  const merged = seedTenant.merged;
  const xaiBaseUrl = String(merged.xaiBaseUrl ?? "").trim().replace(/\/$/, "");
  const mgmtBase = String(merged.xaiMgmtBaseUrl ?? "").trim().replace(/\/$/, "");
  const xaiApiKey = String(merged.xaiApiKey ?? "").trim();
  const mgmtKey = String(merged.xaiMgmtKey ?? "").trim();
  const teamId = teamUuidForXaiIngest(merged.xaiTeamId);

  const summary = await runSeedXaiRagIngest({
    repoRoot: REPO_ROOT,
    teamId,
    xaiApiKey,
    xaiBaseUrl,
    mgmtKey,
    mgmtBase,
    trustedAdvisorDeploySlug: seedTenant.trustedAdvisorDeploySlug
  });

  for (const warning of summary.warnings ?? []) {
    console.warn("[seed:admin:rag-sync]", warning);
  }

  console.log(
    `[seed:admin:rag-sync] done — uploaded ${summary.ragUploaded}/${summary.ragFileCandidates} files, ` +
      `${summary.strategyCollectionIds.length} collections`
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        ragUploaded: summary.ragUploaded,
        ragFileCandidates: summary.ragFileCandidates,
        strategyCollectionIds: summary.strategyCollectionIds,
        strategyCollectionsDetail: summary.strategyCollectionsDetail,
        tenantTrustedAdvisorRootCollectionId: summary.tenantTrustedAdvisorRootCollectionId
      },
      null,
      2
    )
  );
  console.log(
    `${RAG_SYNC_SUMMARY_MARKER}${JSON.stringify({
      ragUploaded: summary.ragUploaded,
      ragFileCandidates: summary.ragFileCandidates,
      strategyCollectionIds: summary.strategyCollectionIds,
      strategyCollectionsDetail: summary.strategyCollectionsDetail,
      strategyFilesUploaded: summary.strategyFilesUploaded,
      tenantTrustedAdvisorRootCollectionId: summary.tenantTrustedAdvisorRootCollectionId,
      warnings: summary.warnings ?? []
    })}`
  );

  runPostSeedXaiRagVerify();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
