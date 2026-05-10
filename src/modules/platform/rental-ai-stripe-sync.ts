import { ObjectId } from "mongodb";
import type Stripe from "stripe";

import { getDb } from "@/lib/mongodb";
import { getRentalAiStripeBasePriceId } from "@/lib/stripe-config";
import type { Tenant } from "@/modules/identity/types";

export function subscriptionIncludesRentalBasePrice(subscription: Stripe.Subscription): boolean {
  const priceId = getRentalAiStripeBasePriceId()?.trim();
  if (!priceId) {
    return false;
  }
  return subscription.items.data.some((item) => item.price?.id === priceId);
}

function normalizeTenantHexFromMetadata(raw: string | null | undefined): string | null {
  const id = raw?.trim();
  if (!id || !ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id).toHexString();
}

function tenantHexFromStripeMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  return (
    normalizeTenantHexFromMetadata(meta?.atx_rental_tenant_id) ??
    normalizeTenantHexFromMetadata(meta?.atx_tenant_id)
  );
}

function resolveRentalExpiresAt(subscription: Stripe.Subscription): Date {
  const periodEndSec = subscription.current_period_end;
  const periodEnd =
    typeof periodEndSec === "number" && Number.isFinite(periodEndSec)
      ? new Date(periodEndSec * 1000)
      : new Date();
  const terminal = new Set<Stripe.Subscription.Status>(["canceled", "unpaid", "incomplete_expired"]);
  if (terminal.has(subscription.status)) {
    return new Date();
  }
  return periodEnd;
}

/**
 * When the subscription includes the configured rental base price, updates `core_tenants`
 * `rentalStripeSubscriptionId`, `rentalStripeSubscriptionStatus`, `rentalExpiresAt`, and
 * `rentalProfile.expiresAt`. Tenant resolution: subscription metadata
 * `atx_rental_tenant_id` (preferred) or `atx_tenant_id`, else existing `rentalStripeSubscriptionId`
 * on the tenant row, else optional `fallbackTenantHex` (e.g. Checkout session metadata).
 */
export async function syncCoreTenantRentalFromStripeSubscription(
  subscription: Stripe.Subscription,
  options?: { fallbackTenantHex?: string | null }
): Promise<{ updated: boolean; tenantIdHex?: string }> {
  if (!subscriptionIncludesRentalBasePrice(subscription)) {
    return { updated: false };
  }

  let tenantHex = tenantHexFromStripeMetadata(subscription.metadata);
  if (!tenantHex && options?.fallbackTenantHex) {
    tenantHex = normalizeTenantHexFromMetadata(options.fallbackTenantHex);
  }

  const db = await getDb();
  if (!tenantHex) {
    const subId = subscription.id?.trim();
    if (subId) {
      const hit = await db.collection<Tenant>("core_tenants").findOne(
        { rentalStripeSubscriptionId: subId },
        { projection: { _id: 1 } }
      );
      const mapped = hit?._id?.toHexString();
      if (mapped) {
        tenantHex = mapped;
      }
    }
  }

  if (!tenantHex) {
    console.warn("[webhooks/stripe] rental SKU subscription missing tenant mapping", {
      subscriptionId: subscription.id
    });
    return { updated: false };
  }

  const tenantId = new ObjectId(tenantHex);
  const tenant = await db.collection<Tenant>("core_tenants").findOne({ _id: tenantId });
  if (!tenant?.rentalProfile) {
    console.warn("[webhooks/stripe] rental webhook: tenant has no rentalProfile", {
      tenantId: tenantHex,
      subscriptionId: subscription.id
    });
    return { updated: false };
  }

  const expiresAt = resolveRentalExpiresAt(subscription);
  const status = subscription.status;

  await db.collection<Tenant>("core_tenants").updateOne(
    { _id: tenantId },
    {
      $set: {
        rentalStripeSubscriptionId: subscription.id,
        rentalStripeSubscriptionStatus: status,
        rentalExpiresAt: expiresAt,
        "rentalProfile.expiresAt": expiresAt
      }
    }
  );

  return { updated: true, tenantIdHex: tenantHex };
}
