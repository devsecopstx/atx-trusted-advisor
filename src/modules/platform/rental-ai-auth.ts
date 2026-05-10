import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password-crypto";
import type { Tenant } from "@/modules/identity/types";
import type {
    TenantRentalAiKeyStored,
    TenantRentalApiKeyScope,
    TenantRentalProfile
} from "@/modules/platform/tenant-rental-types";

const BEARER_RE = /^Bearer\s+(\S+)\s*$/i;
/** Public id + secret — plaintext shown once at key issuance (admin rotation path — future). */
const KEY_RE = /^atxr_([0-9a-f]{16})_([0-9a-f]{64})$/i;

export type RentalAiAuthContext = {
  tenantId: ObjectId;
  tenantSlug: string;
  rentalProfile: TenantRentalProfile;
  apiKeyId: string;
  scopes: TenantRentalApiKeyScope[];
};

function normalizeScopes(raw: unknown): TenantRentalApiKeyScope[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const allowed: TenantRentalApiKeyScope[] = [];
  for (const x of raw) {
    if (x === "chat" || x === "strategy" || x === "analyze") {
      allowed.push(x);
    }
  }
  return allowed.length > 0 ? allowed : null;
}

export async function authenticateRentalAiApiKey(
  authorizationHeader: string | null,
  requiredScope: TenantRentalApiKeyScope
): Promise<
  | { ok: true; ctx: RentalAiAuthContext; matchedKey: TenantRentalAiKeyStored }
  | { ok: false; status: number; code: string; message: string }
> {
  const raw = authorizationHeader?.trim() ?? "";
  const m = BEARER_RE.exec(raw);
  if (!m?.[1]) {
    return { ok: false, status: 401, code: "missing_authorization", message: "Authorization Bearer token required" };
  }
  const fullKey = m[1].trim();
  const km = KEY_RE.exec(fullKey);
  if (!km) {
    return { ok: false, status: 401, code: "invalid_key_format", message: "Malformed rental API key" };
  }
  const keyId = km[1].toLowerCase();

  const db = await getDb();
  const tenant = await db.collection<Tenant>("core_tenants").findOne({
    apiKeys: { $elemMatch: { id: keyId } }
  });
  if (!tenant?._id || !tenant.slug) {
    return { ok: false, status: 401, code: "unknown_key", message: "Invalid credentials" };
  }

  const rentalProfile = tenant.rentalProfile ?? null;
  if (!rentalProfile || !(rentalProfile.expiresAt instanceof Date)) {
    return { ok: false, status: 403, code: "rental_inactive", message: "Rental profile not configured" };
  }

  if (rentalProfile.apiKeyEnabled === false) {
    return { ok: false, status: 403, code: "api_keys_disabled", message: "Rental API keys disabled for tenant" };
  }

  const expiresAt = rentalProfile.expiresAt.getTime();
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return { ok: false, status: 403, code: "rental_expired", message: "Rental subscription expired" };
  }

  const keys = Array.isArray(tenant.apiKeys) ? tenant.apiKeys : [];
  const matched = keys.find((k) => k.id === keyId);
  if (!matched?.keyHash) {
    return { ok: false, status: 401, code: "unknown_key", message: "Invalid credentials" };
  }
  if (matched.revokedAt instanceof Date) {
    return { ok: false, status: 401, code: "key_revoked", message: "API key revoked" };
  }

  const scopes = normalizeScopes(matched.scopes);
  if (!scopes?.includes(requiredScope)) {
    return { ok: false, status: 403, code: "insufficient_scope", message: "API key scope denied for this route" };
  }

  const valid = await verifyPassword(fullKey, matched.keyHash);
  if (!valid) {
    return { ok: false, status: 401, code: "invalid_credentials", message: "Invalid credentials" };
  }

  return {
    ok: true,
    matchedKey: matched,
    ctx: {
      tenantId: tenant._id as ObjectId,
      tenantSlug: tenant.slug,
      rentalProfile,
      apiKeyId: matched.id,
      scopes
    }
  };
}
