/**
 * ATX retail subscription tiers (Account → Billing). Stripe Price IDs come from env — see `stripe-config.ts`.
 */
export type AtxBillingPlanId = "basic" | "premium_monthly" | "premium_plus_yearly";

export type AtxBillingPlan = {
  id: AtxBillingPlanId;
  /** Short marketing name */
  name: string;
  /** Subline for cards */
  tagline: string;
  priceLabel: string;
  periodNote: string;
  bullets: string[];
  highlight?: boolean;
};

export const ATX_BILLING_PLANS: readonly AtxBillingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "HNWI-focused workspace",
    priceLabel: "$21",
    periodNote: "per month",
    bullets: [
      "Built for high-net-worth individual workflows",
      "Full product access with plan limits",
      "Upgrade when you need higher throughput or white-glove posture"
    ]
  },
  {
    id: "premium_monthly",
    name: "Premium",
    tagline: "Complex portfolios — generous limits, fair per-hour caps",
    priceLabel: "$250",
    periodNote: "per month",
    highlight: true,
    bullets: [
      "Complex portfolios, alts, crypto, international, real estate context",
      "Unlimited posture with fair per-hour caps on xChat and xStrategyBuilder (scenario builder)",
      "Best for power users who live in chat + scans"
    ]
  },
  {
    id: "premium_plus_yearly",
    name: "Premium+",
    tagline: "Dedicated instance — private by design",
    priceLabel: "$3,000",
    periodNote: "per year",
    bullets: [
      "White-glove for ultra-complex and family-office books",
      "Dedicated enterprise-grade instance",
      "Private deployment — your data is not used for provider training"
    ]
  }
] as const;
