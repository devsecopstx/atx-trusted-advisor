/**
 * Published plan matrix for Account → Billing (list prices + caps).
 * Source of truth doc: `atx-docs/resouces/atx-limits.txt.tsv` — keep in sync when tiers change.
 */
export type AtxBillingPlanLimitRow = {
  metric: string;
  basic: string;
  premium: string;
  premiumPlus: string;
};

export const ATX_BILLING_PLAN_LIMIT_ROWS: readonly AtxBillingPlanLimitRow[] = [
  {
    metric: "Price",
    basic: "$9/mo",
    premium: "$99/mo",
    premiumPlus: "$299/mo"
  },
  {
    metric: "xstrategybuilder / day",
    basic: "10",
    premium: "Unlimited capped (TBD)",
    premiumPlus: "Same as premium"
  },
  {
    metric: "xChat research/prompts / day",
    basic: "1",
    premium: "Unlimited capped per hr (TBD)",
    premiumPlus: "Same as Premium"
  },
  {
    metric: "Portfolios per user",
    basic: "1",
    premium: "Unlimited capped (TBD)",
    premiumPlus: "Same as Premium"
  },
  {
    metric: "Accounts per portfolio",
    basic: "1",
    premium: "Unlimited",
    premiumPlus: "Same as Premium"
  }
] as const;
