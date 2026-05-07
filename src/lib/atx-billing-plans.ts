/**
 * ATX retail subscription tiers (Account → Billing). Stripe Price IDs: env `STRIPE_PRICE_*` or tenant
 * `workspaceLimits.planOverrides.<tier>.stripePriceId` — see `stripe-config.ts` / admin workspace limits.
 */
export type AtxBillingPlanId = "basic" | "premium_monthly" | "premium_plus_monthly";

/** Retail tiers (Account → Billing) — use for tenant `workspaceLimits.planOverrides` keys. */
export const ATX_BILLING_PLAN_IDS: readonly AtxBillingPlanId[] = [
  "basic",
  "premium_monthly",
  "premium_plus_monthly"
] as const;

/**
 * Legacy Mongo key for Premium+ before list pricing was corrected to monthly.
 * Normalize reads to `premium_plus_monthly` (see `normalizePlanOverridesFromUnknown` / `parsePlanOverridesPayload`).
 */
export const LEGACY_ATX_BILLING_PLAN_ID_PREMIUM_PLUS = "premium_plus_yearly" as const;

export type AtxBillingPlan = {
  id: AtxBillingPlanId;
  /** Short marketing name */
  name: string;
  /** Subline for cards */
  tagline: string;
  priceLabel: string;
  periodNote: string;
  /** Collapsed billing card — one-line value prop */
  summaryValueProp: string;
  /** Shown below the limits table when the card is expanded */
  limitsExpandNote?: string;
  highlight?: boolean;
};

/** Compact period for UI that uses a slash (e.g. `/month`, `/year`). Single source with {@link ATX_BILLING_PLANS}. */
export function atxBillingPeriodSlash(plan: Pick<AtxBillingPlan, "periodNote">): string {
  const n = plan.periodNote.trim().toLowerCase();
  if (n === "per month") {
    return "/month";
  }
  if (n === "per year") {
    return "/year";
  }
  return "";
}

export const ATX_BILLING_PLANS: readonly AtxBillingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "HNWI entry — daily options context & single-portfolio workflows",
    priceLabel: "$5",
    periodNote: "per month",
    summaryValueProp: "Built for daily options context & single-portfolio HNWI workflows",
    limitsExpandNote:
      "Full workspace access within plan limits; trial posture may apply before you subscribe. Limits reflect tenant defaults and per-plan overrides when configured."
  },
  {
    id: "premium_monthly",
    name: "Premium",
    tagline: "Complex books — xChat + xStrategyBuilder with fair caps",
    priceLabel: "$15",
    periodNote: "per month",
    highlight: true,
    summaryValueProp: "Complex books + xStrategyBuilder — multi-account & generous caps",
    limitsExpandNote:
      "Power-user tier — meaningful feedback on real scenarios helps us prioritize caps, tools, and roadmap."
  },
  {
    id: "premium_plus_monthly",
    name: "Premium+",
    tagline: "Dedicated posture — family-office complexity & IB-linked verification (roadmap)",
    priceLabel: "$30",
    periodNote: "per month",
    summaryValueProp:
      "White-glove ultra-complex family-office workflows + dedicated instance + automated trade recs (roadmap)",
    limitsExpandNote:
      "Private deployment — your data is never used for provider training. Interactive Brokers verification and automated trade recommendations are roadmap commitments alongside your workspace limits."
  }
] as const;
