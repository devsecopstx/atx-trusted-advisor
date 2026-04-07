#!/usr/bin/env node
/**
 * DB-only admin bootstrap wrapper.
 *
 * Guarantees Mongo onboarding primitives:
 * - core admin user + role; `subscriptionPlan` **basic** (re-seed resets plan for `ADMIN_SEED_EMAIL`)
 * - approved admin_access_requests paper trail (`requestedPlan` **basic** when bootstrap row is inserted)
 * - tenant/account/watchlist bootstrap
 * - xPersona sync from disk -> Mongo (`atx-docs/rag-collection/xpersonas`, advisor `advisor`)
 * - admin_user_settings.assignedPersonaId -> advisor after sync
 *
 * Skips post-seed xAI network checks (`verify-xai-hello` / `verify-xai-seed-rag`) unless you unset the SKIP_* flags.
 * `seed:admin` never uploads to xAI team collections; this wrapper is for CI / headless clarity.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const seedScript = join(SCRIPT_DIR, "seed-admin-user.mjs");

const mergedEnv = {
  ...process.env,
  SKIP_XAI_POST_SEED_RAG_VERIFY: process.env.SKIP_XAI_POST_SEED_RAG_VERIFY || "1",
  SKIP_XAI_POST_SEED_VERIFY: process.env.SKIP_XAI_POST_SEED_VERIFY || "1"
};

console.log(
  "[seed:admin:db] DB-only mode (skips post-seed xAI hello/RAG verify unless SKIP_* unset). " +
    "Using ADMIN_SEED_EMAIL for first-login account association. No xAI team KB upload in any seed path."
);

const result = spawnSync(process.execPath, [seedScript], {
  cwd: REPO_ROOT,
  env: mergedEnv,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
