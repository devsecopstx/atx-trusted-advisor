/**
 * Published plan matrix for Account → Billing (list prices + caps).
 * Source of truth doc: `atx-docs/resouces/atx-limits.txt.tsv` — keep in sync when tiers change.
 */
import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";

export type AtxBillingPlanLimitRow = {
  metric: string;
  basic: string;
  premium: string;
  premiumPlus: string;
};

export const ATX_BILLING_PLAN_LIMIT_ROWS: readonly AtxBillingPlanLimitRow[] = [
  {
    metric: "Price",
    basic: "$5/mo",
    premium: "$15/mo",
    premiumPlus: "$30/mo"
  },
  {
    metric: "xstrategybuilder / hr",
    basic: "10",
    premium: "Unlimited capped per hr (TBD)",
    premiumPlus: "Unlimited"
  },
  {
    metric: "xStrategyBuilder ranges / week",
    basic: "Up to 70 (10/hr)",
    premium: "Expanded range (hourly caps apply)",
    premiumPlus: "Unlimited"
  },
  {
    metric: "Research articles / week",
    basic: "Core context set",
    premium: "Broader context set",
    premiumPlus: "Extended context set"
  },
  {
    metric: "xChat research/prompts / hr",
    basic: "1",
    premium: "Unlimited capped per hr (TBD)",
    premiumPlus: "Unlimited"
  },
  {
    metric: "xChat prompts / day (UTC)",
    basic: "10",
    premium: "200",
    premiumPlus: "2000"
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

const PLAN_ID_TO_PRICE_COLUMN: Record<AtxBillingPlanId, keyof Pick<AtxBillingPlanLimitRow, "basic" | "premium" | "premiumPlus">> = {
  basic: "basic",
  premium_monthly: "premium",
  premium_plus_monthly: "premiumPlus"
};

const CATALOG_PRICE_FALLBACK_USD = 10;

/**
 * List price USD (whole units) from the **Price** row of {@link ATX_BILLING_PLAN_LIMIT_ROWS} — aligns with Stripe list
 * defaults when `workspaceLimits.planOverrides.<tier>.price` is unset on the resolved tenant.
 */
export function catalogListPriceUsdForPlan(planId: AtxBillingPlanId): number {
  const col = PLAN_ID_TO_PRICE_COLUMN[planId];
  const priceRow = ATX_BILLING_PLAN_LIMIT_ROWS.find((r) => r.metric === "Price");
  const cell = priceRow?.[col]?.trim() ?? "";
  const m = cell.match(/^\$(\d+)/);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 1) {
      return n;
    }
  }
  return CATALOG_PRICE_FALLBACK_USD;
}
