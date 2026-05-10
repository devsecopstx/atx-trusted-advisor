import { randomBytes } from "node:crypto";

import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password-crypto";
import type { Tenant } from "@/modules/identity/types";
import type {
    TenantRentalAiKeyStored,
    TenantRentalApiKeyScope
} from "@/modules/platform/tenant-rental-types";

export type ListedTenantRentalApiKey = {
  id: string;
  scopes: TenantRentalApiKeyScope[];
  label?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  status: "active" | "revoked";
};

function normalizeScopes(raw: TenantRentalApiKeyScope[]): TenantRentalApiKeyScope[] {
  const out: TenantRentalApiKeyScope[] = [];
  for (const x of raw) {
    if (x === "chat" || x === "strategy" || x === "analyze") {
      out.push(x);
    }
  }
  return out;
}

function assertMintPreconditions(
  tenant: Tenant
): { ok: true } | { ok: false; code: string; message: string } {
  const rp = tenant.rentalProfile;
  if (!rp || !(rp.expiresAt instanceof Date)) {
    return {
      ok: false,
      code: "rental_profile_missing",
      message: "Tenant has no rentalProfile with expiresAt"
    };
  }
  if (rp.apiKeyEnabled === false) {
    return { ok: false, code: "api_keys_disabled", message: "rentalProfile.apiKeyEnabled is false" };
  }
  if (rp.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: "rental_expired", message: "rentalProfile.expiresAt is in the past" };
  }
  return { ok: true };
}

function toListed(k: TenantRentalAiKeyStored): ListedTenantRentalApiKey {
  const revoked = k.revokedAt instanceof Date;
  return {
    id: k.id,
    scopes: Array.isArray(k.scopes) ? normalizeScopes(k.scopes) : [],
    ...(k.label?.trim() ? { label: k.label.trim() } : {}),
    createdAt: k.createdAt.toISOString(),
    ...(k.lastUsedAt instanceof Date ? { lastUsedAt: k.lastUsedAt.toISOString() } : {}),
    ...(revoked ? { revokedAt: k.revokedAt!.toISOString() } : {}),
    status: revoked ? "revoked" : "active"
  };
}

export async function listTenantRentalApiKeysForAdmin(tenantId: ObjectId): Promise<ListedTenantRentalApiKey[]> {
  const db = await getDb();
  const tenant = await db.collection<Tenant>("core_tenants").findOne(
    { _id: tenantId },
    { projection: { apiKeys: 1 } }
  );
  const keys = Array.isArray(tenant?.apiKeys) ? tenant.apiKeys : [];
  return keys.map(toListed);
}

export async function mintTenantRentalApiKey(input: {
  tenantId: ObjectId;
  scopes: TenantRentalApiKeyScope[];
  label?: string;
}): Promise<
  | { ok: true; plaintextKey: string; listed: ListedTenantRentalApiKey }
  | { ok: false; code: string; message: string }
> {
  const scopes = normalizeScopes(input.scopes);
  if (scopes.length === 0) {
    return { ok: false, code: "invalid_scopes", message: "At least one scope: chat, strategy, analyze" };
  }

  const db = await getDb();
  const tenant = await db.collection<Tenant>("core_tenants").findOne({ _id: input.tenantId });
  if (!tenant?._id) {
    return { ok: false, code: "tenant_not_found", message: "Tenant not found" };
  }
  const pre = assertMintPreconditions(tenant);
  if (!pre.ok) {
    return { ok: false, code: pre.code, message: pre.message };
  }

  const keyId = randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const plaintextKey = `atxr_${keyId}_${secret}`;
  const keyHash = await hashPassword(plaintextKey);
  const now = new Date();
  const newKey: TenantRentalAiKeyStored = {
    id: keyId,
    keyHash,
    scopes,
    createdAt: now,
    ...(input.label?.trim() ? { label: input.label.trim() } : {})
  };

  const res = await db.collection("core_tenants").updateOne(
    { _id: input.tenantId },
    { $push: { apiKeys: newKey as never } }
  );
  if (!res.matchedCount) {
    return { ok: false, code: "update_failed", message: "Tenant vanished during mint" };
  }

  return { ok: true, plaintextKey, listed: toListed(newKey) };
}

export async function revokeTenantRentalApiKey(input: {
  tenantId: ObjectId;
  keyId: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const keyId = input.keyId.trim().toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(keyId)) {
    return { ok: false, code: "invalid_key_id", message: "keyId must be 16 hex chars" };
  }
  const db = await getDb();
  const now = new Date();
  const res = await db.collection<Tenant>("core_tenants").updateOne(
    { _id: input.tenantId, apiKeys: { $elemMatch: { id: keyId } } },
    { $set: { "apiKeys.$.revokedAt": now } }
  );
  if (!res.matchedCount) {
    return { ok: false, code: "not_found", message: "API key not found on tenant" };
  }
  return { ok: true };
}

export async function rotateTenantRentalApiKey(input: {
  tenantId: ObjectId;
  keyId: string;
}): Promise<
  | { ok: true; plaintextKey: string; listed: ListedTenantRentalApiKey; revokedKeyId: string }
  | { ok: false; code: string; message: string }
> {
  const keyId = input.keyId.trim().toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(keyId)) {
    return { ok: false, code: "invalid_key_id", message: "keyId must be 16 hex chars" };
  }

  const db = await getDb();
  const tenant = await db.collection<Tenant>("core_tenants").findOne({ _id: input.tenantId });
  if (!tenant?._id) {
    return { ok: false, code: "tenant_not_found", message: "Tenant not found" };
  }
  const pre = assertMintPreconditions(tenant);
  if (!pre.ok) {
    return { ok: false, code: pre.code, message: pre.message };
  }

  const keys = Array.isArray(tenant.apiKeys) ? tenant.apiKeys : [];
  const existing = keys.find((k) => k.id === keyId);
  if (!existing?.keyHash) {
    return { ok: false, code: "not_found", message: "API key not found on tenant" };
  }
  if (existing.revokedAt instanceof Date) {
    return { ok: false, code: "already_revoked", message: "Cannot rotate a revoked key" };
  }

  const scopes = normalizeScopes(existing.scopes ?? []);
  if (scopes.length === 0) {
    return { ok: false, code: "invalid_key_state", message: "Key has no valid scopes" };
  }

  const newKeyId = randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const plaintextKey = `atxr_${newKeyId}_${secret}`;
  const keyHash = await hashPassword(plaintextKey);
  const now = new Date();
  const newKey: TenantRentalAiKeyStored = {
    id: newKeyId,
    keyHash,
    scopes,
    createdAt: now,
    ...(existing.label?.trim() ? { label: existing.label.trim() } : {})
  };

  await db.collection<Tenant>("core_tenants").updateOne(
    { _id: input.tenantId, apiKeys: { $elemMatch: { id: keyId } } },
    { $set: { "apiKeys.$.revokedAt": now } }
  );

  await db.collection("core_tenants").updateOne(
    { _id: input.tenantId },
    { $push: { apiKeys: newKey as never } }
  );

  return { ok: true, plaintextKey, listed: toListed(newKey), revokedKeyId: keyId };
}
