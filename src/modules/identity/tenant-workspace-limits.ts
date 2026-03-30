/**
 * Per-tenant workspace quotas (stored on `core_tenants.workspaceLimits`, partial override of defaults).
 * Field names mirror product language; Mongo may store camelCase keys.
 * Optional `planOverrides` keyed by retail billing plan id (`basic`, `premium_monthly`, `premium_plus_yearly`).
 */
import { ATX_BILLING_PLAN_IDS, type AtxBillingPlanId } from "@/lib/atx-billing-plans";

export type TenantWorkspaceLimits = {
  /** Daily xoptions deck / follow-up views per user (calendar UTC day). */
  userXoptionsLimit: number;
  /** Daily xChat prompts per user — capped with plan limits via min(plan, tenant). */
  userChatLimit: number;
  /** Max portfolios per user in this tenant workspace. */
  tenantPortfolioLimit: number;
  /** Max custodian accounts per portfolio. */
  portfolioAccountLimit: number;
};

/** Default list price (USD, whole units) per plan when `planOverrides.*.price` is unset. */
export const DEFAULT_TENANT_PLAN_PRICE = 10;

/** Per-plan workspace row: quota overrides plus optional admin-managed list price. */
export type TenantPlanWorkspaceRow = Partial<TenantWorkspaceLimits> & {
  /** List price in USD (whole units) for this tier in this tenant; not used for limit enforcement. */
  price?: number;
};

/** Partial limits (and optional price) per retail plan; omitted limit fields fall back to merged tenant defaults. */
export type TenantPlanWorkspaceOverrides = Partial<Record<AtxBillingPlanId, TenantPlanWorkspaceRow>>;

export function resolvedTenantPlanPrice(row: TenantPlanWorkspaceRow | undefined): number {
  const p = row?.price;
  if (typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 1_000_000) {
    return p;
  }
  return DEFAULT_TENANT_PLAN_PRICE;
}

export const DEFAULT_TENANT_WORKSPACE_LIMITS: TenantWorkspaceLimits = {
  userXoptionsLimit: 10,
  userChatLimit: 10,
  tenantPortfolioLimit: 1,
  portfolioAccountLimit: 1
};

const LIMIT_KEYS = [
  "userXoptionsLimit",
  "userChatLimit",
  "tenantPortfolioLimit",
  "portfolioAccountLimit"
] as const satisfies readonly (keyof TenantWorkspaceLimits)[];

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1_000_000;
}

function parseLimitScalars(o: Record<string, unknown>): Partial<TenantWorkspaceLimits> {
  const value: Partial<TenantWorkspaceLimits> = {};
  for (const k of LIMIT_KEYS) {
    if (o[k] === undefined) {
      continue;
    }
    if (!isPositiveInt(o[k])) {
      continue;
    }
    value[k] = o[k] as number;
  }
  return value;
}

function parsePlanOverrideRowLoose(o: Record<string, unknown>): TenantPlanWorkspaceRow {
  const row: TenantPlanWorkspaceRow = { ...parseLimitScalars(o) };
  if (o.price !== undefined && o.price !== null && isPositiveInt(o.price)) {
    row.price = o.price;
  }
  return row;
}

export function mergeTenantWorkspaceLimits(
  partial?: Partial<TenantWorkspaceLimits> | null | Record<string, unknown>
): TenantWorkspaceLimits {
  const out = { ...DEFAULT_TENANT_WORKSPACE_LIMITS };
  if (!partial) {
    return out;
  }
  const o = partial as Record<string, unknown>;
  for (const k of LIMIT_KEYS) {
    const v = o[k];
    if (isPositiveInt(v)) {
      out[k] = v;
    }
  }
  return out;
}

export function normalizePlanOverridesFromUnknown(raw: unknown): TenantPlanWorkspaceOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const src = raw as Record<string, unknown>;
  const out: TenantPlanWorkspaceOverrides = {};
  for (const planId of ATX_BILLING_PLAN_IDS) {
    const row = src[planId];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const parsed = parsePlanOverrideRowLoose(row as Record<string, unknown>);
    if (Object.keys(parsed).length > 0) {
      out[planId] = parsed;
    }
  }
  return out;
}

/** Merges quota fields only; `planOverrides.*.price` is not part of enforcement. */
export function applyTenantPlanRowToBase(
  base: TenantWorkspaceLimits,
  planOverrides: TenantPlanWorkspaceOverrides,
  tier: AtxBillingPlanId
): TenantWorkspaceLimits {
  const row = planOverrides[tier];
  if (!row) {
    return { ...base };
  }
  return {
    userXoptionsLimit: row.userXoptionsLimit ?? base.userXoptionsLimit,
    userChatLimit: row.userChatLimit ?? base.userChatLimit,
    tenantPortfolioLimit: row.tenantPortfolioLimit ?? base.tenantPortfolioLimit,
    portfolioAccountLimit: row.portfolioAccountLimit ?? base.portfolioAccountLimit
  };
}

export function parseWorkspaceLimitsPayload(
  raw: unknown
): { ok: true; value: Partial<TenantWorkspaceLimits> } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "workspaceLimits must be an object" };
  }
  const o = raw as Record<string, unknown>;
  const value: Partial<TenantWorkspaceLimits> = {};
  for (const k of LIMIT_KEYS) {
    if (o[k] === undefined) {
      continue;
    }
    if (!isPositiveInt(o[k])) {
      return { ok: false, error: `Invalid ${k}: positive integer required` };
    }
    value[k] = o[k] as number;
  }
  return { ok: true, value };
}

export function parsePlanOverridesPayload(
  raw: unknown
): { ok: true; value: TenantPlanWorkspaceOverrides } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "planOverrides must be an object" };
  }
  const o = raw as Record<string, unknown>;
  const out: TenantPlanWorkspaceOverrides = {};
  for (const key of Object.keys(o)) {
    if (!ATX_BILLING_PLAN_IDS.includes(key as AtxBillingPlanId)) {
      return { ok: false, error: `Unknown planOverrides key: ${key}` };
    }
    const planId = key as AtxBillingPlanId;
    const row = o[planId];
    if (row === null || row === undefined) {
      continue;
    }
    if (typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `planOverrides.${planId} must be an object` };
    }
    const parsed: TenantPlanWorkspaceRow = {};
    for (const k of LIMIT_KEYS) {
      const cell = (row as Record<string, unknown>)[k];
      if (cell === undefined || cell === null) {
        continue;
      }
      if (!isPositiveInt(cell)) {
        return { ok: false, error: `Invalid planOverrides.${planId}.${k}: positive integer required` };
      }
      parsed[k] = cell;
    }
    const priceCell = (row as Record<string, unknown>).price;
    if (priceCell !== undefined && priceCell !== null) {
      if (!isPositiveInt(priceCell)) {
        return { ok: false, error: `Invalid planOverrides.${planId}.price: positive integer required` };
      }
      parsed.price = priceCell;
    }
    if (Object.keys(parsed).length > 0) {
      out[planId] = parsed;
    }
  }
  return { ok: true, value: out };
}
