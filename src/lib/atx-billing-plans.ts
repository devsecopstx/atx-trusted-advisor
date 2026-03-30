/**
 * ATX retail subscription tiers (Account → Billing). Stripe Price IDs come from env — see `stripe-config.ts`.
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
  bullets: string[];
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
    tagline:
      "HNWI-focused entry — workspace users, portfolios, accounts (risk & outlook), portfolio scoring factors",
    priceLabel: "$9",
    periodNote: "per month",
    bullets: [
      "Built for high-net-worth individual workflows and daily options context",
      "Manage workspace users, portfolios, accounts (risk & outlook), and portfolio-level scoring factors (within your role and plan limits)",
      "xStrategyBuilder includes entry-level weekly range coverage plus core article context",
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
      "User defined, Complex portfolios: listed equities & options, and multi-account context",
      "Generous posture with fair per-hour caps on xChat and xStrategyBuilder (scenario builder)",
      "Expanded weekly range coverage and broader article context for strategy preparation",
      "Power-user tier — meaningful Feedback on real scenarios helps us prioritize caps, tools, and roadmap"
    ]
  },
  {
    id: "premium_plus_monthly",
    name: "Premium+",
    tagline: "Dedicated instance — private, white-glove posture, account trade recomendations and rationale with automated verification",
    priceLabel: "$299",
    periodNote: "per month",
    bullets: [
      "White-glove for ultra-complex and family-office books; direct line for structured product input",
      "Dedicated enterprise-grade instance sized for your workflow",
      "Top-tier weekly range coverage and extended article context",
      "Interactive Brokers automated trades and verification (roadmap)",
      "Private deployment — your data is not used for provider training; compliance-minded engagement expected"
    ]
  }
] as const;
