/**
 * Account → Billing: per-card price + workspace quota rows + preference rows (tenant merge or guest catalog).
 * @see atx-docs/sre-ops/tenant-workspace-limits.md — App user surfacing
 * @see atx-docs/sre-ops/stripe-billing-setup.md — Billing page vs admin list price
 */
import { ATX_BILLING_PLAN_LIMIT_ROWS } from "@/lib/atx-billing-plan-limits";
import type { AtxBillingPlan, AtxBillingPlanId } from "@/lib/atx-billing-plans";
import {
    applyTenantPlanRowToBase,
    DEFAULT_TENANT_WORKSPACE_LIMITS,
    mergeTenantWorkspaceLimits,
    normalizePlanOverridesFromUnknown,
    type TenantPlanWorkspaceRow
} from "@/modules/identity/tenant-workspace-limits";
import type { Tenant } from "@/modules/identity/types";

/**
 * Canonical metric labels for `/account/billing` → Workspace quota rows (xOptions + xChat hour/day + portfolio caps).
 */
export const BILLING_WORKSPACE_LABEL_XOPTIONS = "xOptions views / hr";
/** UTC clock-hour cap when tenant sets `userChatHourlyLimit` &gt; 0; otherwise billing shows Unlimited. */
export const BILLING_WORKSPACE_LABEL_XCHAT_HOURLY = "xChat prompts / hr (UTC)";
/** Matches `POST /api/xchat/ask` day bucket (`userChatLimit`). */
export const BILLING_WORKSPACE_LABEL_XCHAT_DAILY = "xChat prompts / day (UTC)";
export const BILLING_WORKSPACE_LABEL_CHANGE_PERSONA = "Change persona";
export const BILLING_WORKSPACE_LABEL_CHAT_HISTORY = "Chat history max (turns)";

/** Column in `ATX_BILLING_PLAN_LIMIT_ROWS` for each retail plan. */
const PLAN_ID_TO_LIMIT_COLUMN: Record<AtxBillingPlanId, "basic" | "premium" | "premiumPlus"> = {
  basic: "basic",
  premium_monthly: "premium",
  premium_plus_monthly: "premiumPlus"
};

type BillingWorkspaceQuotaKey =
  | "userXoptionsLimit"
  | "userChatHourlyLimit"
  | "userChatLimit"
  | "tenantPortfolioLimit"
  | "portfolioAccountLimit";

/**
 * Workspace quota rows on Account → Billing (price is rendered separately on the card).
 * Guest catalog lookup uses `catalogMetric` against `ATX_BILLING_PLAN_LIMIT_ROWS` (order here is display order).
 */
export const BILLING_WORKSPACE_LIMIT_SPECS: readonly {
  label: string;
  catalogMetric: string;
  limitKey: BillingWorkspaceQuotaKey;
}[] = [
  {
    label: BILLING_WORKSPACE_LABEL_XOPTIONS,
    catalogMetric: "xstrategybuilder / hr",
    limitKey: "userXoptionsLimit"
  },
  {
    label: BILLING_WORKSPACE_LABEL_XCHAT_DAILY,
    catalogMetric: "xChat prompts / day (UTC)",
    limitKey: "userChatLimit"
  },
  {
    label: BILLING_WORKSPACE_LABEL_XCHAT_HOURLY,
    catalogMetric: "xChat research/prompts / hr",
    limitKey: "userChatHourlyLimit"
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

/** Shown after the four quota rows on Account → Billing (tenant + per-plan effective). */
export const BILLING_WORKSPACE_PREFERENCE_SPECS: readonly {
  label: string;
  kind: "boolean" | "limit";
}[] = [
  { label: BILLING_WORKSPACE_LABEL_CHANGE_PERSONA, kind: "boolean" },
  { label: BILLING_WORKSPACE_LABEL_CHAT_HISTORY, kind: "limit" }
] as const;

const UNLIMITED_THRESHOLD = 100_000;

export function formatWorkspaceLimitScalar(n: number): string {
  if (n >= UNLIMITED_THRESHOLD) {
    return "Unlimited";
  }
  return String(n);
}

/** Tenant xChat hourly cap: unset / 0 means no hourly product limit. */
export function formatOptionalWorkspaceHourlyCap(n?: number): string {
  if (n === undefined || n === 0 || n >= UNLIMITED_THRESHOLD) {
    return "Unlimited";
  }
  return String(n);
}

export function formatChangePersonaEnabled(enabled: boolean): string {
  return enabled ? "Yes" : "No";
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
 * Workspace limits block: quota rows + Change persona + Chat history max; list price uses tenant `planOverrides.<tier>.price` when set.
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
    const quotaRows = BILLING_WORKSPACE_LIMIT_SPECS.map((spec) => {
      const catalogRow = ATX_BILLING_PLAN_LIMIT_ROWS.find((r) => r.metric === spec.catalogMetric);
      const value = catalogRow?.[col] ?? "—";
      return { label: spec.label, value };
    });
    const prefRows = BILLING_WORKSPACE_PREFERENCE_SPECS.map((spec) => {
      if (spec.kind === "boolean") {
        return { label: spec.label, value: formatChangePersonaEnabled(true) };
      }
      return {
        label: spec.label,
        value: formatWorkspaceLimitScalar(DEFAULT_TENANT_WORKSPACE_LIMITS.chatHistoryMax)
      };
    });
    return { priceParts, limitRows: [...quotaRows, ...prefRows] };
  }

  const base = mergeTenantWorkspaceLimits(tenant.workspaceLimits ?? null);
  const effective = applyTenantPlanRowToBase(base, planOverrides, plan.id);
  const quotaRows = BILLING_WORKSPACE_LIMIT_SPECS.map((spec) => ({
    label: spec.label,
    value:
      spec.limitKey === "userChatHourlyLimit"
        ? formatOptionalWorkspaceHourlyCap(effective.userChatHourlyLimit)
        : formatWorkspaceLimitScalar(effective[spec.limitKey] as number)
  }));
  const prefRows = BILLING_WORKSPACE_PREFERENCE_SPECS.map((spec) => {
    if (spec.kind === "boolean") {
      return { label: spec.label, value: formatChangePersonaEnabled(effective.changePersonaEnabled) };
    }
    return {
      label: spec.label,
      value: formatWorkspaceLimitScalar(effective.chatHistoryMax)
    };
  });
  return { priceParts, limitRows: [...quotaRows, ...prefRows] };
}
