#!/usr/bin/env node
/**
 * Upsert `core_tenants` from a tenant spec YAML (see tenant-specs/README.md).
 * Optional Phase 1 provisioning: `tenant.initialTenantAdmin` + branding in `tenant.tenantPreferences`.
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

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";
import { parseTenantSpecV1Document } from "./lib/tenant-spec-schema.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

function printHelp() {
  console.log(`seed-tenant-from-spec — upsert core_tenants from YAML

Usage:
  node --env-file=.env scripts/seed-tenant-from-spec.mjs --file tenant-specs/<slug>.yaml

Options:
  --file <path>   Tenant spec YAML (required)
  -h, --help      Show this help
`);
}

async function ensureTenantProvisionIndexes(db) {
  await Promise.all([
    db.collection("core_tenants").createIndex({ slug: 1 }, { unique: true, name: "uniq_tenant_slug" }),
    db.collection("core_tenants").createIndex(
      { isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_tenant"
      }
    ),
    db.collection("core_users").createIndex({ email: 1 }, { unique: true, name: "uniq_core_user_email" }),
    db.collection("core_users").createIndex(
      { "xAccount.xUserId": 1 },
      { unique: true, sparse: true, name: "uniq_core_user_x_user_id" }
    ),
    db.collection("core_tenant_memberships").createIndex(
      { userId: 1, tenantId: 1 },
      { unique: true, name: "uniq_membership_user_tenant" }
    )
  ]);
}

function resolveSpecPath(flag) {
  const p = flag.trim();
  if (p.startsWith("/")) {
    return p;
  }
  return join(REPO_ROOT, p);
}

/**
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').ObjectId} tenantId
 * @param {{ email: string, xUserId?: string, platformRole: string, setAsDefaultSessionTenant: boolean }} admin
 * @param {Date} now
 */
async function provisionInitialTenantAdmin(db, tenantId, admin, now) {
  const users = db.collection("core_users");
  const memberships = db.collection("core_tenant_memberships");
  const email = admin.email;

  const existing = await users.findOne({ email });
  const platformRole = admin.platformRole;
  /** @type {string[]} */
  let roles;
  if (!existing) {
    roles = [platformRole];
  } else {
    const prev = Array.isArray(existing.roles) ? existing.roles.map(String) : [];
    roles = [...new Set([...prev, platformRole])];
  }

  await users.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        createdAt: now,
        subscriptionPlan: "basic"
      },
      $set: {
        roles,
        status: "active",
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const user = await users.findOne({ email });
  if (!user?._id) {
    throw new Error("Failed to upsert core user for initialTenantAdmin");
  }

  if (admin.xUserId) {
    const holder = await users.findOne({
      "xAccount.xUserId": admin.xUserId,
      email: { $ne: email }
    });
    if (holder) {
      throw new Error(
        `[seed:tenant] initialTenantAdmin.xUserId "${admin.xUserId}" is already linked to ${holder.email}`
      );
    }
    const xSet = {
      "xAccount.xUserId": admin.xUserId,
      "xAccount.username": user.xAccount?.username || admin.xUserId,
      "xAccount.linkedAt": now,
      updatedAt: now
    };
    if (user.xAccount?.displayName) {
      xSet["xAccount.displayName"] = user.xAccount.displayName;
    }
    await users.updateOne({ _id: user._id }, { $set: xSet });
  }

  if (admin.setAsDefaultSessionTenant) {
    await memberships.updateMany(
      { userId: user._id, tenantId: { $ne: tenantId } },
      { $set: { isDefaultTenant: false, updatedAt: now } }
    );
  }

  await memberships.updateOne(
    { userId: user._id, tenantId },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        role: "tenant_admin",
        isDefaultTenant: admin.setAsDefaultSessionTenant,
        updatedAt: now
      }
    },
    { upsert: true }
  );
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
  let text;
  try {
    text = readFileSync(specPath, "utf8");
  } catch (e) {
    console.error(`Cannot read file: ${specPath}`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let doc;
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

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  try {
    await ensureTenantProvisionIndexes(db);
    const $set = {
      name: parsed.name,
      isDefault: false,
      updatedAt: now
    };
    if (parsed.workspaceLimits) {
      $set.workspaceLimits = parsed.workspaceLimits;
    }
    if (parsed.tenantPreferencesBranding) {
      for (const [k, v] of Object.entries(parsed.tenantPreferencesBranding)) {
        $set[`tenantPreferences.${k}`] = v;
      }
    }
    if (parsed.tenantXfUiTheme) {
      $set["tenantPreferences.xf_ui_theme"] = parsed.tenantXfUiTheme;
    }

    await db.collection("core_tenants").updateOne(
      { slug: parsed.slug },
      {
        $set,
        $setOnInsert: {
          slug: parsed.slug,
          createdAt: now
        }
      },
      { upsert: true }
    );

    const tenant = await db.collection("core_tenants").findOne({ slug: parsed.slug });
    if (!tenant?._id) {
      throw new Error("Upsert failed — tenant row missing after update");
    }
    console.log(`[seed:tenant] OK — tenantId=${tenant._id.toHexString()}`);

    if (parsed.initialTenantAdmin) {
      await provisionInitialTenantAdmin(db, tenant._id, parsed.initialTenantAdmin, now);
      const u = await db.collection("core_users").findOne({ email: parsed.initialTenantAdmin.email });
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
