/**
 * Account → Billing: per-card price + four workspace limit rows (tenant merge or guest catalog).
 * @see atx-docs/sre-ops/tenant-workspace-limits.md — App user surfacing
 * @see atx-docs/sre-ops/stripe-billing-setup.md — Billing page vs admin list price
 */
import { ATX_BILLING_PLAN_LIMIT_ROWS } from "@/lib/atx-billing-plan-limits";
import type { AtxBillingPlan, AtxBillingPlanId } from "@/lib/atx-billing-plans";
import {
    applyTenantPlanRowToBase,
    mergeTenantWorkspaceLimits,
    normalizePlanOverridesFromUnknown,
    type TenantPlanWorkspaceRow,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type { Tenant } from "@/modules/identity/types";

/**
 * Canonical metric labels for `/account/billing` → Workspace limits (first two rows).
 * Product copy is **per hour**; do not use “/ day” here — enforced by `tests/unit/billing-workspace-limit-labels.test.ts`.
 */
export const BILLING_WORKSPACE_LABEL_XOPTIONS = "xOptions views / hr";
export const BILLING_WORKSPACE_LABEL_XCHAT = "xChat prompts / hr";

/** Column in `ATX_BILLING_PLAN_LIMIT_ROWS` for each retail plan. */
const PLAN_ID_TO_LIMIT_COLUMN: Record<AtxBillingPlanId, "basic" | "premium" | "premiumPlus"> = {
  basic: "basic",
  premium_monthly: "premium",
  premium_plus_monthly: "premiumPlus"
};

/**
 * Four workspace caps shown on Account → Billing (price is rendered separately on the card).
 * Order matches `ATX_BILLING_PLAN_LIMIT_ROWS` catalog metrics used for guest display.
 */
export const BILLING_WORKSPACE_LIMIT_SPECS: readonly {
  label: string;
  catalogMetric: string;
  limitKey: keyof TenantWorkspaceLimits;
}[] = [
  {
    label: BILLING_WORKSPACE_LABEL_XOPTIONS,
    catalogMetric: "xstrategybuilder / hr",
    limitKey: "userXoptionsLimit"
  },
  {
    label: BILLING_WORKSPACE_LABEL_XCHAT,
    catalogMetric: "xChat research/prompts / hr",
    limitKey: "userChatLimit"
  },
  {
    label: "Portfolios per user",
    catalogMetric: "Portfolios per user",
    limitKey: "tenantPortfolioLimit"
  },
  {
    label: "Accounts per portfolio",
    catalogMetric: "Accounts per portfolio",
    limitKey: "portfolioAccountLimit"
  }
] as const;

const UNLIMITED_THRESHOLD = 100_000;

export function formatWorkspaceLimitScalar(n: number): string {
  if (n >= UNLIMITED_THRESHOLD) {
    return "Unlimited";
  }
  return String(n);
}

export function billingCardPriceParts(
  plan: AtxBillingPlan,
  row: TenantPlanWorkspaceRow | undefined
): { priceAmount: string; periodNote: string } {
  const p = row?.price;
  if (typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 1_000_000) {
    return { priceAmount: `$${p}`, periodNote: plan.periodNote };
  }
  return { priceAmount: plan.priceLabel, periodNote: plan.periodNote };
}

/**
 * Workspace limits block: four rows only; list price uses tenant `planOverrides.<tier>.price` when set.
 * Guests use the published catalog matrix (`ATX_BILLING_PLAN_LIMIT_ROWS`).
 */
export function billingCardWorkspaceDisplay(input: {
  tenant: Tenant | null;
  plan: AtxBillingPlan;
}): { priceParts: { priceAmount: string; periodNote: string }; limitRows: { label: string; value: string }[] } {
  const { tenant, plan } = input;
  const planOverrides = normalizePlanOverridesFromUnknown(tenant?.workspaceLimits?.planOverrides);
  const row = planOverrides[plan.id];
  const priceParts = billingCardPriceParts(plan, row);

  if (!tenant) {
    const col = PLAN_ID_TO_LIMIT_COLUMN[plan.id];
    const limitRows = BILLING_WORKSPACE_LIMIT_SPECS.map((spec) => {
      const catalogRow = ATX_BILLING_PLAN_LIMIT_ROWS.find((r) => r.metric === spec.catalogMetric);
      const value = catalogRow?.[col] ?? "—";
      return { label: spec.label, value };
    });
    return { priceParts, limitRows };
  }

  const base = mergeTenantWorkspaceLimits(tenant.workspaceLimits ?? null);
  const effective = applyTenantPlanRowToBase(base, planOverrides, plan.id);
  const limitRows = BILLING_WORKSPACE_LIMIT_SPECS.map((spec) => ({
    label: spec.label,
    value: formatWorkspaceLimitScalar(effective[spec.limitKey])
  }));
  return { priceParts, limitRows };
}
