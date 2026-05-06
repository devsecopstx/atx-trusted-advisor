import { ATX_BILLING_PLAN_IDS, type AtxBillingPlanId } from "@/lib/atx-billing-plans";
import type { TenantPlanWorkspaceOverrides } from "@/modules/identity/tenant-workspace-limits";

/**
 * Publishable key is safe to expose to the browser. On Cloud Run, mount **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**
 * and **`STRIPE_PUBLIC_KEY`** from GCP Secret Manager (sync from `.env.stage` / `.env.prod` via
 * `scripts/ops/sync-stripe-publishable-secrets-from-env.sh`). `STRIPE_PUBLIC_KEY` is an alias for the same `pk_…` value.
 */
export function getStripePublishableKey(): string | undefined {
  const a = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const b = process.env.STRIPE_PUBLIC_KEY?.trim();
  return (a && a.length > 0 ? a : b && b.length > 0 ? b : undefined) ?? undefined;
}

export function getStripeSecretKey(): string | undefined {
  const s = process.env.STRIPE_SECRET_KEY?.trim();
  return s && s.length > 0 ? s : undefined;
}

const PRICE_ENV_KEYS: Record<Exclude<AtxBillingPlanId, "premium_plus_monthly">, string> = {
  basic: "STRIPE_PRICE_BASIC_MONTHLY",
  premium_monthly: "STRIPE_PRICE_PREMIUM_MONTHLY"
};

/**
 * Premium+ is billed monthly. Prefer `STRIPE_PRICE_PREMIUM_PLUS_MONTHLY`; fall back to
 * `STRIPE_PRICE_PREMIUM_PLUS_YEARLY` until Stripe Price ids / GitHub vars are renamed everywhere.
 */
export function getStripePriceIdForPlan(planId: AtxBillingPlanId): string | undefined {
  if (planId === "premium_plus_monthly") {
    const monthly = process.env.STRIPE_PRICE_PREMIUM_PLUS_MONTHLY?.trim();
    if (monthly && monthly.length > 0) {
      return monthly;
    }
    const legacyYearlyName = process.env.STRIPE_PRICE_PREMIUM_PLUS_YEARLY?.trim();
    return legacyYearlyName && legacyYearlyName.length > 0 ? legacyYearlyName : undefined;
  }
  const key = PRICE_ENV_KEYS[planId];
  const v = key ? process.env[key]?.trim() : undefined;
  return v && v.length > 0 ? v : undefined;
}

/**
 * Tenant workspace `planOverrides.*.stripePriceId` wins when set (valid `price_…`); else env `STRIPE_PRICE_*`.
 */
export function resolveStripePriceIdForCheckout(
  planId: AtxBillingPlanId,
  planOverrides: TenantPlanWorkspaceOverrides | null | undefined
): string | undefined {
  const row = planOverrides?.[planId];
  const custom = row?.stripePriceId?.trim();
  if (custom && /^price_[a-zA-Z0-9_]+$/.test(custom)) {
    return custom;
  }
  return getStripePriceIdForPlan(planId);
}

/** Secret key present and every retail tier resolves to a Price id (tenant override or env). */
export function isStripeCheckoutConfiguredForTenant(
  planOverrides: TenantPlanWorkspaceOverrides | null | undefined
): boolean {
  if (!getStripeSecretKey()) {
    return false;
  }
  return ATX_BILLING_PLAN_IDS.every((id) => Boolean(resolveStripePriceIdForCheckout(id, planOverrides)));
}

export function isStripeBillingFullyConfigured(): boolean {
  return isStripeCheckoutConfiguredForTenant(undefined);
}

/** When true and IDs are set, rental Checkout / webhooks may use the Stripe rental SKU (see `RentalAiBilling` wiring). */
export function isRentalAiBillingFlagEnabled(): boolean {
  const v = process.env.ENABLE_RENTAL_AI_BILLING?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Stripe Product id for rental AI base subscription (`prod_…`). */
export function getRentalAiStripeProductId(): string | undefined {
  const s = process.env.RENTAL_AI_PRODUCT_ID?.trim();
  return s && s.length > 0 ? s : undefined;
}

/**
 * Stripe Price id for rental AI base recurring charge (`price_…`).
 * Falls back to `STRIPE_PRICE_RENTAL_AI_MONTHLY` when `RENTAL_BASE_PRICE_ID` is unset.
 */
export function getRentalAiStripeBasePriceId(): string | undefined {
  const primary = process.env.RENTAL_BASE_PRICE_ID?.trim();
  if (primary && primary.length > 0) {
    return primary;
  }
  const legacy = process.env.STRIPE_PRICE_RENTAL_AI_MONTHLY?.trim();
  return legacy && legacy.length > 0 ? legacy : undefined;
}

export function resolveAppOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (explicit) {
    if (explicit.startsWith("http")) {
      return explicit.replace(/\/$/, "");
    }
    return `https://${explicit.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
