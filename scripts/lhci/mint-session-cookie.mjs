#!/usr/bin/env node
/**
 * Mint a signed `xf_core_session` cookie value for Lighthouse CI authenticated runs.
 *
 * Reads the same secret + payload format as `src/lib/auth.ts` so an LHCI run can
 * collect signed-in metrics for `/xchat`, `/portfolio`, `/portfolios`, `/xoptions`.
 *
 * Usage:
 *   # mint from `.env` (or `.env.stage` / `.env.prod`)
 *   node scripts/lhci/mint-session-cookie.mjs --env-file=.env --user-id=<userId> --tenant-id=<tenantId>
 *
 *   When **user-id / tenant-id are omitted** but **MONGODB_URI** is set, the script looks up
 *   **core_users** by **ADMIN_SEED_EMAIL** (or **LHCI_AUTH_EMAIL**) and fills ids automatically
 *   (requires `npm run seed:admin` + reachable Mongo).
 *
 *   # print as full cookie header (default): `xf_core_session=<value>`
 *   node scripts/lhci/mint-session-cookie.mjs ... --format=cookie
 *
 *   # print just the signed value (no `xf_core_session=` prefix)
 *   node scripts/lhci/mint-session-cookie.mjs ... --format=value
 *
 *   # use as env source for LHCI:
 *   export LHCI_AUTH_COOKIE="$(node scripts/lhci/mint-session-cookie.mjs --env-file=.env)"
 *   npx @lhci/cli@latest autorun --config=./.lighthouseci/config.auth.cjs
 *
 * Env (any of these are accepted; CLI flags override env):
 *   AUTH_SECRET                   (required) — same secret used by Next runtime
 *   LHCI_AUTH_USER_ID             userId for SessionPayload.userId
 *   LHCI_AUTH_TENANT_ID           tenantId
 *   LHCI_AUTH_EMAIL               email   (default: ADMIN_SEED_EMAIL)
 *   LHCI_AUTH_X_USER_ID           xUserId (default: "lhci_test")
 *   LHCI_AUTH_USERNAME            username (default: "lhci_test")
 *   LHCI_AUTH_TENANT_ROLE         (default: "tenant_admin")
 *   LHCI_AUTH_ROLES               comma-list (default: "global_admin,advisor")
 *   LHCI_AUTH_TTL_HOURS           lifetime (default: 12)
 *
 * Notes:
 * - Never commit minted cookies; treat output like a password.
 * - Pair with `.lighthouseci/config.auth.cjs` (sets `Cookie` via `extraHeaders`).
 * - For prod runs against live origin, mint with the **prod** AUTH_SECRET (e.g. `--env-file=.env.prod`).
 */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";

import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "../lib/resolve-mongo-uri.mjs";

function parseArgs(input) {
  const out = {};
  for (const raw of input.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw.slice(2)] = true;
    } else {
      out[raw.slice(2, eq)] = raw.slice(eq + 1);
    }
  }
  return out;
}

function loadEnvFile(path) {
  if (!path) return;
  const abs = resolve(path);
  if (!existsSync(abs)) {
    stderr.write(`mint-session-cookie: env file not found: ${abs}\n`);
    exit(2);
  }
  const text = readFileSync(abs, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function pickFirst(...values) {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function fail(msg) {
  stderr.write(`mint-session-cookie: ${msg}\n`);
  exit(1);
}

function escapeRegexLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * When ids are omitted, resolve seeded admin user from Mongo (same DB as Next `getDb`).
 * @returns {Promise<{ userId: string; tenantId: string } | null>}
 */
async function tryResolveUserTenantFromMongo(email) {
  const raw = process.env.MONGODB_URI?.trim() || process.env.MONGODB_URI_B64?.trim();
  if (!raw || !email?.trim()) {
    return null;
  }
  let mongoUri;
  try {
    mongoUri = resolveMongoUri();
  } catch {
    return null;
  }

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(resolveSeedDbName());
    const user = await db.collection("core_users").findOne({
      email: new RegExp(`^${escapeRegexLiteral(email.trim())}$`, "i")
    });
    if (!user?._id || user.tenantId == null || String(user.tenantId).trim() === "") {
      return null;
    }
    return { userId: String(user._id), tenantId: String(user.tenantId) };
  } catch (err) {
    stderr.write(
      `mint-session-cookie: Mongo lookup skipped (${err instanceof Error ? err.message : String(err)})\n`
    );
    return null;
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(argv);
  loadEnvFile(args["env-file"]);

  const secret = pickFirst(args.secret, process.env.AUTH_SECRET, process.env.X_OAUTH_CLIENT_SECRET);
  if (!secret || secret.length < 16) {
    fail("AUTH_SECRET (or --secret) must be set and ≥16 chars");
  }

  const email = pickFirst(
    args.email,
    process.env.LHCI_AUTH_EMAIL,
    process.env.ADMIN_SEED_EMAIL,
    "lhci@local.test"
  );

  let userId = pickFirst(args["user-id"], process.env.LHCI_AUTH_USER_ID);
  let tenantId = pickFirst(args["tenant-id"], process.env.LHCI_AUTH_TENANT_ID);
  if (!userId || !tenantId) {
    const resolved = await tryResolveUserTenantFromMongo(email);
    if (resolved) {
      userId = resolved.userId;
      tenantId = resolved.tenantId;
    }
  }
  if (!userId || !tenantId) {
    fail(
      "userId + tenantId required (pass --user-id / --tenant-id, set LHCI_AUTH_USER_ID / LHCI_AUTH_TENANT_ID, " +
        "or ensure MONGODB_URI + ADMIN_SEED_EMAIL / LHCI_AUTH_EMAIL so the seed admin row can be loaded from Mongo)"
    );
  }
  const xUserId = pickFirst(args["x-user-id"], process.env.LHCI_AUTH_X_USER_ID, "lhci_test");
  const username = pickFirst(args.username, process.env.LHCI_AUTH_USERNAME, "lhci_test");
  const tenantRole = pickFirst(
    args["tenant-role"],
    process.env.LHCI_AUTH_TENANT_ROLE,
    "tenant_admin"
  );
  const rolesRaw = pickFirst(args.roles, process.env.LHCI_AUTH_ROLES, "global_admin,advisor");
  const roles = rolesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const ttlHours = Number(pickFirst(args["ttl-hours"], process.env.LHCI_AUTH_TTL_HOURS, "12"));
  const exp = Date.now() + Math.max(1, ttlHours) * 60 * 60 * 1000;

  const payload = {
    userId,
    email,
    roles,
    tenantId,
    tenantRole,
    xUserId,
    username,
    exp
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  const cookieValue = `${encoded}.${sig}`;

  const format = pickFirst(args.format, "cookie");
  if (format === "value") {
    stdout.write(`${cookieValue}\n`);
  } else if (format === "header") {
    stdout.write(`Cookie: xf_core_session=${cookieValue}\n`);
  } else {
    stdout.write(`xf_core_session=${cookieValue}\n`);
  }
}

main().catch((err) => {
  stderr.write(`mint-session-cookie: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  exit(1);
});
