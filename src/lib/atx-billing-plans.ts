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
    tagline:
      "HNWI-focused entry — workspace users, portfolios, accounts (risk & outlook), portfolio scoring factors",
    priceLabel: "$10",
    periodNote: "per month",
    bullets: [
      "Built for high-net-worth individual workflows and daily options context",
      "Manage workspace users, portfolios, accounts (risk & outlook), and portfolio-level scoring factors (within your role and plan limits)",
      "Full product access with plan limits; limited-time full-access trial may apply before you subscribe"
    ]
  },
  {
    id: "premium_monthly",
    name: "Premium",
    tagline: "Complex books — xChat + xStrategyBuilder with fair per-hour caps",
    priceLabel: "$99",
    periodNote: "per month",
    highlight: true,
    bullets: [
      "Complex portfolios: international, real estate, listed equities & options, and multi-account context",
      "Generous posture with fair per-hour caps on xChat and xStrategyBuilder (scenario builder)",
      "Power-user tier — meaningful Feedback on real scenarios helps us prioritize caps, tools, and roadmap"
    ]
  },
  {
    id: "premium_plus_yearly",
    name: "Premium+",
    tagline: "Dedicated instance — private, white-glove posture",
    priceLabel: "$300",
    periodNote: "per year",
    bullets: [
      "White-glove for ultra-complex and family-office books; direct line for structured product input",
      "Dedicated enterprise-grade instance sized for your workflow",
      "Interactive Brokers automated trades and verification (roadmap)",
      "Private deployment — your data is not used for provider training; compliance-minded engagement expected"
    ]
  }
] as const;
