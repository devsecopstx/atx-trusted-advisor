/**
 * Mint a rental API key for a tenant: prints the plaintext `atxr_*` key **once** and appends a hashed row to `core_tenants.apiKeys`.
 *
 * Usage (repo root, Mongo in env):
 *   node --env-file=.env.prod --import tsx scripts/ops/mint-rental-api-key.ts --tenant=<slug>
 *   node --env-file=.env --import tsx scripts/ops/mint-rental-api-key.ts --tenantId=<24-hex>
 *
 * Options:
 *   --tenant=<slug>        Resolve tenant by `core_tenants.slug`
 *   --tenantId=<objectId>  Resolve tenant by `_id`
 *   --scopes=chat,strategy,analyze   Default: all three
 *   --label=<string>       Optional label on the key row
 *
 * Requires: valid `rentalProfile` with `expiresAt` in the future and `apiKeyEnabled` !== false.
 */

import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";

import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password-crypto";
import type { Tenant } from "@/modules/identity/types";
import type { TenantRentalApiKeyScope } from "@/modules/platform/tenant-rental-types";

function parseArgs(argv: string[]): {
  tenantSlug?: string;
  tenantId?: string;
  scopes: TenantRentalApiKeyScope[];
  label?: string;
} {
  let tenantSlug: string | undefined;
  let tenantId: string | undefined;
  let label: string | undefined;
  let scopeStr = "chat,strategy,analyze";

  for (const a of argv) {
    if (a.startsWith("--tenant=")) {
      tenantSlug = a.slice("--tenant=".length).trim();
    } else if (a.startsWith("--tenantId=")) {
      tenantId = a.slice("--tenantId=".length).trim().toLowerCase();
    } else if (a.startsWith("--scopes=")) {
      scopeStr = a.slice("--scopes=".length).trim();
    } else if (a.startsWith("--label=")) {
      label = a.slice("--label=".length).trim();
    }
  }

  const rawScopes = scopeStr.split(/[\s,]+/).filter(Boolean);
  const allowed: TenantRentalApiKeyScope[] = [];
  for (const s of rawScopes) {
    const x = s as TenantRentalApiKeyScope;
    if (x === "chat" || x === "strategy" || x === "analyze") {
      allowed.push(x);
    }
  }
  if (allowed.length === 0) {
    throw new Error("At least one scope required: chat, strategy, analyze");
  }

  return { tenantSlug, tenantId, scopes: allowed, label };
}

async function main(): Promise<void> {
  const { tenantSlug, tenantId, scopes, label } = parseArgs(process.argv.slice(2));

  if (!tenantSlug && !tenantId) {
    console.error(
      "Usage: mint-rental-api-key.ts --tenant=<slug> | --tenantId=<24-hex> [--scopes=chat,strategy,analyze] [--label=name]"
    );
    process.exit(1);
  }
  if (tenantSlug && tenantId) {
    console.error("Pass only one of --tenant or --tenantId");
    process.exit(1);
  }

  const db = await getDb();
  const query =
    tenantId !== undefined
      ? { _id: new ObjectId(tenantId) }
      : { slug: tenantSlug!.trim().toLowerCase() };

  const tenant = await db.collection<Tenant>("core_tenants").findOne(query);
  if (!tenant?._id) {
    console.error("Tenant not found for query:", query);
    process.exit(1);
  }

  const rp = tenant.rentalProfile;
  if (!rp || !(rp.expiresAt instanceof Date)) {
    console.error("Tenant has no rentalProfile / expiresAt. Add rentalProfile (e.g. seed:tenant with YAML) first.");
    process.exit(1);
  }
  if (rp.apiKeyEnabled === false) {
    console.error("rentalProfile.apiKeyEnabled is false; enable keys before minting.");
    process.exit(1);
  }
  if (rp.expiresAt.getTime() < Date.now()) {
    console.error("rentalProfile.expiresAt is in the past; renew before minting keys.");
    process.exit(1);
  }

  const keyId = randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const fullKey = `atxr_${keyId}_${secret}`;
  const keyHash = await hashPassword(fullKey);
  const now = new Date();

  const newKey = {
    id: keyId,
    keyHash,
    scopes,
    createdAt: now,
    ...(label?.trim() ? { label: label.trim() } : {})
  };

  const res = await db.collection("core_tenants").updateOne(
    { _id: tenant._id },
    { $push: { apiKeys: newKey as never } }
  );

  if (!res.matchedCount) {
    console.error("Update failed (tenant vanished)");
    process.exit(1);
  }

  console.log("");
  console.log("=== Rental API key minted (save now; cannot be retrieved later) ===");
  console.log(`tenant: ${tenant.slug} (${tenant._id.toHexString()})`);
  console.log(`scopes: ${scopes.join(", ")}`);
  console.log(`key id: ${keyId}`);
  console.log("");
  console.log(`export KEY='${fullKey}'`);
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
