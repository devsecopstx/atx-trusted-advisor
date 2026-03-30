import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";

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

const ATX_BILLING_PLAN_IDS: AtxBillingPlanId[] = ["basic", "premium_monthly", "premium_plus_monthly"];

export function isStripeBillingFullyConfigured(): boolean {
  if (!getStripeSecretKey()) {
    return false;
  }
  return ATX_BILLING_PLAN_IDS.every((id) => Boolean(getStripePriceIdForPlan(id)));
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
