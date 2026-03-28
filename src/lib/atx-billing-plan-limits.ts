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
    premium: "$29/mo",
    premiumPlus: "$99/mo"
  },
  {
    metric: "xstrategybuilder / day",
    basic: "10",
    premium: "Unlimited capped per hr (TBD)",
    premiumPlus: "Unlimited"
  },
  {
    metric: "xChat prompts / day",
    basic: "1",
    premium: "Unlimited capped per hr (TBD)",
    premiumPlus: "Unlimited"
  },
  {
    metric: "Portfolios per user",
    basic: "1",
    premium: "Unlimited",
    premiumPlus: "Same as Premium"
  },
  {
    metric: "Accounts per portfolio",
    basic: "1",
    premium: "Unlimited",
    premiumPlus: "Same as Premium"
  }
] as const;
