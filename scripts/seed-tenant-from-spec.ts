#!/usr/bin/env node
/**
 * Upsert `core_tenants` from a tenant spec YAML (see tenant-specs/README.md).
 * Uses `upsertTenantFromParsedSpecV1` (rental profile + default rental persona when `tenant.rentalProfile` is set).
 *
 *   npm run seed:tenant -- --file tenant-specs/acme.yaml
 *
 * Env: MONGODB_URI + DB name (same resolution as seed:admin via resolve-mongo-uri / resolveSeedDbName).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { MongoClient } from "mongodb";
import { parse as parseYaml } from "yaml";

import { parseTenantSpecV1Document } from "@/lib/tenant-spec-v1-parse";
import { upsertTenantFromParsedSpecV1 } from "@/modules/platform/tenant-spec-apply";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

function printHelp() {
  console.log(`seed-tenant-from-spec — upsert core_tenants from YAML

Usage:
  node --env-file=.env --import tsx scripts/seed-tenant-from-spec.ts --file tenant-specs/<slug>.yaml

Options:
  --file <path>   Tenant spec YAML (required)
  -h, --help      Show this help
`);
}

function resolveSpecPath(flag: string): string {
  const p = flag.trim();
  if (p.startsWith("/")) {
    return p;
  }
  return join(REPO_ROOT, p);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (values.help || !values.file?.trim()) {
    printHelp();
    if (!values.help) {
      process.exit(1);
    }
    return;
  }

  const specPath = resolveSpecPath(values.file);
  let text: string;
  try {
    text = readFileSync(specPath, "utf8");
  } catch (e) {
    console.error(`Cannot read file: ${specPath}`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (e) {
    console.error("YAML parse error:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const parsed = parseTenantSpecV1Document(doc);
  const mongoUri = resolveMongoUri();
  const dbName = resolveSeedDbName();
  console.log(`[seed:tenant] Mongo DB: ${dbName}`);
  console.log(`[seed:tenant] Spec: ${specPath}`);
  console.log(`[seed:tenant] Tenant slug: ${parsed.slug}`);
  if (parsed.rentalProfile) {
    console.log(`[seed:tenant] Rental tier: ${parsed.rentalProfile.tier} (bias=${parsed.rentalProfile.strategyBias})`);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const result = await upsertTenantFromParsedSpecV1(db, parsed);
    console.log(`[seed:tenant] OK — tenantId=${result.tenantId}`);

    if (parsed.initialTenantAdmin) {
      const u = await db
        .collection("core_users")
        .findOne({ email: parsed.initialTenantAdmin.email });
      console.log(
        `[seed:tenant] initialTenantAdmin — userId=${u?._id?.toHexString() ?? "?"} email=${parsed.initialTenantAdmin.email} platformRole=${parsed.initialTenantAdmin.platformRole} membership=tenant_admin`
      );
    } else {
      console.log(
        `[seed:tenant] Next: add tenant.initialTenantAdmin to the spec or assign via Admin → Access (tenantId above).`
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("[seed:tenant] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
