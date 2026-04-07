#!/usr/bin/env node
/**
 * Probe Mongo connectivity + key collection counts using a supplied env file.
 *
 * - Supports plain or base64 `MONGODB_URI` (via `resolveMongoUri()`).
 * - Resolves DB name like Next `getDb()` / `seed:admin`: `MONGODB_DB_NAME`, else path segment in `MONGODB_URI`, else `atxfinance` (`resolveSeedDbName()`); override with `--db=`.
 * - Prints redacted URI host + counts for quick staging/prod validation.
 *
 * Usage:
 *   node scripts/ops/probe-mongodb-from-env.mjs --env-file=.env.stage
 *   node scripts/ops/probe-mongodb-from-env.mjs --env-file=.env.prod --db=atxfinance-prod
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "../lib/resolve-mongo-uri.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function usage() {
  process.stdout.write(
    [
      "Usage: node scripts/ops/probe-mongodb-from-env.mjs [options]",
      "",
      "Options:",
      "  --env-file=<path>  Env file to load (default: .env.stage)",
      "  --file=<path>      Alias for --env-file",
      "  --db=<name>        Override DB name (optional)",
      "  --timeout-ms=<n>   Server selection timeout in ms (default: 8000)",
      "  -h, --help         Show this help",
      "",
      "Output: JSON with redacted URI, resolved DB name, ping status, and key counts."
    ].join("\n")
  );
}

function parseArgs(argv) {
  let envFile = ".env.stage";
  let dbNameOverride = null;
  let timeoutMs = 8000;

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }
    const envMatch = arg.match(/^--(?:env-file|file)=(.+)$/);
    if (envMatch) {
      envFile = envMatch[1].trim();
      continue;
    }
    const dbMatch = arg.match(/^--db=(.+)$/);
    if (dbMatch) {
      dbNameOverride = dbMatch[1].trim();
      continue;
    }
    const timeoutMatch = arg.match(/^--timeout-ms=(\d+)$/);
    if (timeoutMatch) {
      timeoutMs = Number(timeoutMatch[1]);
    }
  }

  return {
    help: false,
    envFile,
    dbNameOverride,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000
  };
}

function resolvePath(filePath) {
  if (existsSync(filePath)) {
    return filePath;
  }
  const fromRoot = join(ROOT_DIR, filePath);
  if (existsSync(fromRoot)) {
    return fromRoot;
  }
  throw new Error(`Env file not found: ${filePath}`);
}

function loadEnvFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
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
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function redactMongoUri(uri) {
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/)[^@]+@/i, "$1<redacted>@");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const envFileAbs = resolvePath(args.envFile);
  loadEnvFromFile(envFileAbs);

  const uri = resolveMongoUri();
  const dbName = args.dbNameOverride || resolveSeedDbName();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: args.timeoutMs });

  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });

    const [coreTenants, adminScheduledTasks, adminAccessRequests] = await Promise.all([
      db.collection("core_tenants").countDocuments(),
      db.collection("admin_scheduled_tasks").countDocuments(),
      db.collection("admin_access_requests").countDocuments()
    ]);

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          envFile: envFileAbs,
          db: dbName,
          uri: redactMongoUri(uri),
          counts: {
            core_tenants: coreTenants,
            admin_scheduled_tasks: adminScheduledTasks,
            admin_access_requests: adminAccessRequests
          }
        },
        null,
        2
      ) + "\n"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      JSON.stringify(
        {
          ok: false,
          envFile: envFileAbs,
          db: dbName,
          uri: redactMongoUri(uri),
          error: message
        },
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

main();
