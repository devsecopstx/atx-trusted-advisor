/**
 * Account → Billing: per-card price + workspace quota rows + preference rows (tenant merge or guest catalog).
 * @see atx-docs/sre-ops/tenant-workspace-limits.md — App user surfacing
 * @see atx-docs/sre-ops/stripe-billing-setup.md — Billing page vs admin list price
 */
import { ATX_BILLING_PLAN_LIMIT_ROWS, catalogListPriceUsdForPlan } from "@/lib/atx-billing-plan-limits";
import type { AtxBillingPlan, AtxBillingPlanId } from "@/lib/atx-billing-plans";
import {
    applyTenantPlanRowToBase,
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
/** Effective tenant + plan `userChatLimit` (base + `planOverrides`) for `/account/billing` xChat day row. */
export const BILLING_WORKSPACE_LABEL_XCHAT_DAILY = "xChat prompts / day (UTC)";
export const BILLING_WORKSPACE_LABEL_CHANGE_PERSONA = "Change persona";
export const BILLING_WORKSPACE_LABEL_CHAT_HISTORY = "Chat history max (turns)";

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

/** Column in `ATX_BILLING_PLAN_LIMIT_ROWS` for each retail plan. */
const PLAN_ID_TO_LIMIT_COLUMN: Record<AtxBillingPlanId, "basic" | "premium" | "premiumPlus"> = {
  basic: "basic",
  premium_monthly: "premium",
  premium_plus_monthly: "premiumPlus"
};

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
  return {
    priceAmount: `$${catalogListPriceUsdForPlan(plan.id)}`,
    periodNote: plan.periodNote
  };
}

/**
 * Workspace limits block: quota rows + Change persona + Chat history max; list price uses tenant `planOverrides.<tier>.price` when set.
 * Guests use the published catalog matrix (`ATX_BILLING_PLAN_LIMIT_ROWS`).
 */
/** Up to three scan-line chips derived from resolved quota rows (guest catalog or tenant-effective). */
export function billingPlanSummaryChips(limitRows: readonly { label: string; value: string }[]): string[] {
  const byLabel = (needle: string) => limitRows.find((r) => r.label === needle)?.value;
  const xo = byLabel(BILLING_WORKSPACE_LABEL_XOPTIONS);
  const xd = byLabel(BILLING_WORKSPACE_LABEL_XCHAT_DAILY);
  const portfolios = limitRows.find((r) => r.label === "Portfolios per user")?.value;
  const chips: string[] = [];
  if (xo !== undefined) {
    chips.push(`${xo} xOptions views/hr`);
  }
  if (xd !== undefined) {
    chips.push(`${xd} xChat prompts/day`);
  }
  if (portfolios !== undefined) {
    chips.push(`${portfolios} portfolio${portfolios === "1" ? "" : "s"}/user`);
  }
  return chips.slice(0, 3);
}

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
      return {
        label: spec.label,
        value: catalogRow?.[col] ?? "—"
      };
    });
    const guestBase = mergeTenantWorkspaceLimits(null);
    const prefRows = BILLING_WORKSPACE_PREFERENCE_SPECS.map((spec) => {
      if (spec.kind === "boolean") {
        return { label: spec.label, value: formatChangePersonaEnabled(guestBase.changePersonaEnabled) };
      }
      return {
        label: spec.label,
        value: formatWorkspaceLimitScalar(guestBase.chatHistoryMax)
      };
    });
    return { priceParts, limitRows: [...quotaRows, ...prefRows] };
  }

  const base = mergeTenantWorkspaceLimits(tenant.workspaceLimits ?? null);
  const effective = applyTenantPlanRowToBase(base, planOverrides, plan.id);
  const quotaRows = BILLING_WORKSPACE_LIMIT_SPECS.map((spec) => {
    const forLimits = effective;
    return {
      label: spec.label,
      value:
        spec.limitKey === "userChatHourlyLimit"
          ? formatOptionalWorkspaceHourlyCap(forLimits.userChatHourlyLimit)
          : formatWorkspaceLimitScalar(forLimits[spec.limitKey] as number)
    };
  });
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
