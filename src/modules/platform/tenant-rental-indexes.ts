import type { Db } from "mongodb";

/**
 * Rental AI: query/suspension scheduling on `rentalExpiresAt` (sparse).
 * We do **not** use a Mongo TTL index on `core_tenants` — TTL deletion would remove the tenant document
 * and break memberships; see `atx-docs/sre-ops/rental-ai-platform.md`.
 */
export async function ensureCoreTenantRentalIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("core_tenants").createIndex(
      { rentalExpiresAt: 1 },
      { sparse: true, name: "idx_core_tenants_rental_expires_at" }
    ),
    db.collection("core_tenants").createIndex(
      { "apiKeys.id": 1 },
      { sparse: true, name: "idx_core_tenants_api_key_id" }
    ),
    db.collection("core_tenants").createIndex(
      { rentalStripeSubscriptionId: 1 },
      { sparse: true, name: "idx_core_tenants_rental_stripe_subscription_id" }
    ),
    db.collection("rental_ai_token_usage").createIndex(
      { tenantId: 1, dayUtc: 1 },
      { unique: true, name: "uniq_rental_ai_token_usage_tenant_day" }
    )
  ]);
}
