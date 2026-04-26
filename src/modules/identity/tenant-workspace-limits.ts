/**
 * Per-tenant workspace quotas (stored on `core_tenants.workspaceLimits`, partial override of defaults).
 * Field names mirror product language; Mongo may store camelCase keys.
 * Optional `planOverrides` keyed by retail billing plan id (`basic`, `premium_monthly`, `premium_plus_monthly`).
 * Legacy key `premium_plus_yearly` is normalized to `premium_plus_monthly` on read.
 */
import {
    ATX_BILLING_PLANS,
    ATX_BILLING_PLAN_IDS,
    LEGACY_ATX_BILLING_PLAN_ID_PREMIUM_PLUS,
    type AtxBillingPlanId
} from "@/lib/atx-billing-plans";

export type TenantWorkspaceLimits = {
  /** xOptions deck / follow-up views per user — labeled **per hour** on `/account/billing` and admin workspace limits; enforced via `app_feature_daily_usage` (UTC day bucket) until hourly metering ships. */
  userXoptionsLimit: number;
  /** xChat prompts per user per **UTC calendar day** — tenant `workspaceLimits` row only for `POST /api/xchat/ask` (`tenantBaseWorkspaceLimits` in `lib/tenant-workspace-limits.ts`; `planOverrides` xChat/d does not apply). */
  userChatLimit: number;
  /**
   * xChat prompts per user per **UTC clock hour**. Omitted or `0` = no hourly product cap (daily + per-minute burst still apply).
   * Plan override rows use the same semantics (`0` clears an inherited hourly cap).
   */
  userChatHourlyLimit?: number;
  /** Max portfolios per user in this tenant workspace. */
  tenantPortfolioLimit: number;
  /** Max custodian accounts per portfolio. */
  portfolioAccountLimit: number;
  /** When false, app users cannot switch persona in xChat (picker disabled); `global_admin` sessions ignore. */
  changePersonaEnabled: boolean;
  /** Max recent user turns shown in xChat thread + history fetch (UI); default **10**. */
  chatHistoryMax: number;
  /** Max distinct users that may hold a `core_tenant_memberships` row for this tenant (enforced on assign). Default **5**. */
  maxUsersPerTenant: number;
};

/** Fallback list price (USD, whole units) when plan defaults are unavailable. */
export const DEFAULT_TENANT_PLAN_PRICE = 10;

const DEFAULT_TENANT_PLAN_PRICE_BY_ID: Record<AtxBillingPlanId, number> = ATX_BILLING_PLANS.reduce(
  (acc, plan) => {
    const parsed = Number.parseInt(plan.priceLabel.replace(/^\$/, ""), 10);
    acc[plan.id] = Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_TENANT_PLAN_PRICE;
    return acc;
  },
  {
    basic: DEFAULT_TENANT_PLAN_PRICE,
    premium_monthly: DEFAULT_TENANT_PLAN_PRICE,
    premium_plus_monthly: DEFAULT_TENANT_PLAN_PRICE
  } satisfies Record<AtxBillingPlanId, number>
);

/** Default list price for a billing plan (catalog price unless unavailable). */
export function defaultTenantPlanPriceFor(planId: AtxBillingPlanId): number {
  return DEFAULT_TENANT_PLAN_PRICE_BY_ID[planId] ?? DEFAULT_TENANT_PLAN_PRICE;
}

/** Per-plan workspace row: quota overrides plus optional admin-managed list price. */
export type TenantPlanWorkspaceRow = Partial<TenantWorkspaceLimits> & {
  /** List price in USD (whole units) for this tier in this tenant; not used for limit enforcement. */
  price?: number;
  /** Stripe Product id (`prod_…`); reference / admin only; Checkout uses `stripePriceId`. */
  stripeProductId?: string;
  /** Stripe Price id (`price_…`); when set, `POST /api/billing/checkout-session` uses this for the tier instead of `STRIPE_PRICE_*` env. */
  stripePriceId?: string;
};

/** Partial limits (and optional price) per retail plan; omitted limit fields fall back to merged tenant defaults. */
export type TenantPlanWorkspaceOverrides = Partial<Record<AtxBillingPlanId, TenantPlanWorkspaceRow>>;

export function resolvedTenantPlanPrice(
  row: TenantPlanWorkspaceRow | undefined,
  planId?: AtxBillingPlanId
): number {
  const p = row?.price;
  if (typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 1_000_000) {
    return p;
  }
  if (planId) {
    return defaultTenantPlanPriceFor(planId);
  }
  return DEFAULT_TENANT_PLAN_PRICE;
}

export const DEFAULT_TENANT_WORKSPACE_LIMITS: TenantWorkspaceLimits = {
  userXoptionsLimit: 10,
  userChatLimit: 10,
  tenantPortfolioLimit: 1,
  portfolioAccountLimit: 1,
  changePersonaEnabled: true,
  chatHistoryMax: 10,
  maxUsersPerTenant: 5
};

/** Numeric quota keys (positive integers), including chat history depth. */
const LIMIT_KEYS = [
  "userXoptionsLimit",
  "userChatLimit",
  "tenantPortfolioLimit",
  "portfolioAccountLimit",
  "chatHistoryMax",
  "maxUsersPerTenant"
] as const satisfies readonly (keyof TenantWorkspaceLimits)[];

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1_000_000;
}

/**
 * Mongo / tenant YAML sometimes stores quota scalars as strings or BSON doubles.
 * Used for base `workspaceLimits` and plan override rows on read.
 */
export function coercePositiveLimitInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 1 && n <= 1_000_000 && Math.abs(raw - n) < 1e-9) {
      return n;
    }
    return undefined;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") {
      return undefined;
    }
    const n = Number.parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 1_000_000) {
      return n;
    }
    return undefined;
  }
  const s = String(raw).trim();
  if (s === "" || s === "[object Object]") {
    return undefined;
  }
  const n = Number.parseInt(s, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 1_000_000) {
    return n;
  }
  return undefined;
}

/** Mongo / JSON may store hourly as double or string; billing + admin read paths use this. */
function coerceUserChatHourlyLimitLoose(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 0 && n <= 1_000_000 && Math.abs(raw - n) < 1e-9) {
      return n;
    }
    return undefined;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") {
      return undefined;
    }
    const n = Number.parseInt(t, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 1_000_000) {
      return n;
    }
    return undefined;
  }
  const s = String(raw).trim();
  if (s === "") {
    return undefined;
  }
  const n = Number.parseInt(s, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 1_000_000) {
    return n;
  }
  return undefined;
}

function parseLimitScalars(o: Record<string, unknown>): Partial<TenantWorkspaceLimits> {
  const value: Partial<TenantWorkspaceLimits> = {};
  for (const k of LIMIT_KEYS) {
    if (o[k] === undefined) {
      continue;
    }
    const n = coercePositiveLimitInt(o[k]);
    if (n !== undefined) {
      value[k] = n;
    }
  }
  return value;
}

function parseChangePersonaLoose(v: unknown): boolean | undefined {
  if (typeof v === "boolean") {
    return v;
  }
  if (v === "true" || v === 1) {
    return true;
  }
  if (v === "false" || v === 0) {
    return false;
  }
  return undefined;
}

/** Lenient read from Mongo: only accept well-formed Stripe ids. */
function parseStripeProductIdLoose(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const s = String(raw).trim();
  if (s === "") {
    return undefined;
  }
  return /^prod_[a-zA-Z0-9_]+$/.test(s) ? s : undefined;
}

function parseStripePriceIdLoose(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const s = String(raw).trim();
  if (s === "") {
    return undefined;
  }
  return /^price_[a-zA-Z0-9_]+$/.test(s) ? s : undefined;
}

function parsePlanOverrideRowLoose(o: Record<string, unknown>): TenantPlanWorkspaceRow {
  const row: TenantPlanWorkspaceRow = { ...parseLimitScalars(o) };
  if (Object.prototype.hasOwnProperty.call(o, "userChatHourlyLimit")) {
    const n = coerceUserChatHourlyLimitLoose(o.userChatHourlyLimit);
    if (n !== undefined) {
      row.userChatHourlyLimit = n;
    }
  }
  if (o.price !== undefined && o.price !== null && isPositiveInt(o.price)) {
    row.price = o.price;
  }
  const cp = parseChangePersonaLoose(o.changePersonaEnabled);
  if (cp !== undefined) {
    row.changePersonaEnabled = cp;
  }
  const prod = parseStripeProductIdLoose(o.stripeProductId);
  if (prod) {
    row.stripeProductId = prod;
  }
  const priceId = parseStripePriceIdLoose(o.stripePriceId);
  if (priceId) {
    row.stripePriceId = priceId;
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
    const n = coercePositiveLimitInt(o[k]);
    if (n !== undefined) {
      out[k] = n;
    }
  }
  const cp = parseChangePersonaLoose(o.changePersonaEnabled);
  if (cp !== undefined) {
    out.changePersonaEnabled = cp;
  }
  if (Object.prototype.hasOwnProperty.call(o, "userChatHourlyLimit")) {
    const n = coerceUserChatHourlyLimitLoose(o.userChatHourlyLimit);
    if (n !== undefined) {
      if (n === 0) {
        delete out.userChatHourlyLimit;
      } else {
        out.userChatHourlyLimit = n;
      }
    }
  }
  return out;
}

/**
 * True when `core_tenants.workspaceLimits` has no persisted quota scalars (`null`, missing, empty object, or only `planOverrides`).
 * Runtime still uses {@link mergeTenantWorkspaceLimits}(null) defaults; this gates **Mongo** backfill so Admin shows real keys.
 */
export function tenantWorkspaceLimitsScalarsMissing(raw: unknown): boolean {
  if (raw == null) {
    return true;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return true;
  }
  const o = raw as Record<string, unknown>;
  for (const k of LIMIT_KEYS) {
    if (coercePositiveLimitInt(o[k]) !== undefined) {
      return false;
    }
  }
  if (Object.prototype.hasOwnProperty.call(o, "userChatHourlyLimit")) {
    const n = coerceUserChatHourlyLimitLoose(o.userChatHourlyLimit);
    if (n !== undefined && n > 0) {
      return false;
    }
  }
  return true;
}

/** Defaults + any valid scalars on `raw`; keeps `planOverrides` when present. Safe for `$set.workspaceLimits`. */
export function coalesceTenantWorkspaceLimitsForPersistence(raw: unknown): Record<string, unknown> {
  const src =
    raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const merged = mergeTenantWorkspaceLimits(src);
  const out: Record<string, unknown> = { ...merged };
  if (src?.planOverrides !== undefined && src?.planOverrides !== null) {
    out.planOverrides = src.planOverrides;
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
  const legacyRow = src[LEGACY_ATX_BILLING_PLAN_ID_PREMIUM_PLUS];
  if (legacyRow && typeof legacyRow === "object" && !Array.isArray(legacyRow)) {
    const parsed = parsePlanOverrideRowLoose(legacyRow as Record<string, unknown>);
    if (Object.keys(parsed).length > 0) {
      const existing = out.premium_plus_monthly ?? {};
      out.premium_plus_monthly = { ...parsed, ...existing };
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
  const hourlyFromRow = row.userChatHourlyLimit;
  const userChatHourlyLimit =
    hourlyFromRow !== undefined
      ? hourlyFromRow === 0
        ? undefined
        : hourlyFromRow
      : base.userChatHourlyLimit;

  return {
    userXoptionsLimit: row.userXoptionsLimit ?? base.userXoptionsLimit,
    userChatLimit: row.userChatLimit ?? base.userChatLimit,
    userChatHourlyLimit,
    tenantPortfolioLimit: row.tenantPortfolioLimit ?? base.tenantPortfolioLimit,
    portfolioAccountLimit: row.portfolioAccountLimit ?? base.portfolioAccountLimit,
    changePersonaEnabled: row.changePersonaEnabled ?? base.changePersonaEnabled,
    chatHistoryMax: row.chatHistoryMax ?? base.chatHistoryMax,
    maxUsersPerTenant: row.maxUsersPerTenant ?? base.maxUsersPerTenant
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
  if (o.changePersonaEnabled !== undefined) {
    const cp = parseChangePersonaLoose(o.changePersonaEnabled);
    if (cp === undefined) {
      return { ok: false, error: "Invalid changePersonaEnabled: boolean required" };
    }
    value.changePersonaEnabled = cp;
  }
  if (o.userChatHourlyLimit !== undefined) {
    const hn = coerceUserChatHourlyLimitLoose(o.userChatHourlyLimit);
    if (hn === undefined) {
      return {
        ok: false,
        error: "Invalid userChatHourlyLimit: integer 0–1000000 required (0 = no hourly cap)"
      };
    }
    value.userChatHourlyLimit = hn;
  }
  return { ok: true, value };
}

function canonicalPlanOverridesKey(key: string): AtxBillingPlanId | undefined {
  if (key === LEGACY_ATX_BILLING_PLAN_ID_PREMIUM_PLUS) {
    return "premium_plus_monthly";
  }
  if (ATX_BILLING_PLAN_IDS.includes(key as AtxBillingPlanId)) {
    return key as AtxBillingPlanId;
  }
  return undefined;
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
  type RowEntry = { legacy: boolean; parsed: TenantPlanWorkspaceRow };
  const byPlan = new Map<AtxBillingPlanId, RowEntry[]>();

  for (const key of Object.keys(o)) {
    const planId = canonicalPlanOverridesKey(key);
    if (!planId) {
      return { ok: false, error: `Unknown planOverrides key: ${key}` };
    }
    const row = o[key];
    if (row === null || row === undefined) {
      continue;
    }
    if (typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `planOverrides.${key} must be an object` };
    }
    const parsed: TenantPlanWorkspaceRow = {};
    for (const k of LIMIT_KEYS) {
      const cell = (row as Record<string, unknown>)[k];
      if (cell === undefined || cell === null) {
        continue;
      }
      if (!isPositiveInt(cell)) {
        return { ok: false, error: `Invalid planOverrides.${key}.${k}: positive integer required` };
      }
      parsed[k] = cell;
    }
    const hourlyCell = (row as Record<string, unknown>).userChatHourlyLimit;
    if (hourlyCell !== undefined && hourlyCell !== null) {
      const hourlyN = coerceUserChatHourlyLimitLoose(hourlyCell);
      if (hourlyN === undefined) {
        return {
          ok: false,
          error: `Invalid planOverrides.${key}.userChatHourlyLimit: integer 0–1000000 required`
        };
      }
      parsed.userChatHourlyLimit = hourlyN;
    }
    const changeCell = (row as Record<string, unknown>).changePersonaEnabled;
    if (changeCell !== undefined && changeCell !== null) {
      const cp = parseChangePersonaLoose(changeCell);
      if (cp === undefined) {
        return { ok: false, error: `Invalid planOverrides.${key}.changePersonaEnabled: boolean required` };
      }
      parsed.changePersonaEnabled = cp;
    }
    const priceCell = (row as Record<string, unknown>).price;
    if (priceCell !== undefined && priceCell !== null) {
      if (!isPositiveInt(priceCell)) {
        return { ok: false, error: `Invalid planOverrides.${key}.price: positive integer required` };
      }
      parsed.price = priceCell;
    }
    const stripeProductCell = (row as Record<string, unknown>).stripeProductId;
    if (stripeProductCell !== undefined && stripeProductCell !== null) {
      if (typeof stripeProductCell !== "string") {
        return { ok: false, error: `Invalid planOverrides.${key}.stripeProductId: string required` };
      }
      const tp = stripeProductCell.trim();
      if (tp !== "" && !/^prod_[a-zA-Z0-9_]+$/.test(tp)) {
        return {
          ok: false,
          error: `Invalid planOverrides.${key}.stripeProductId: use prod_… or leave empty`
        };
      }
      if (tp !== "") {
        parsed.stripeProductId = tp;
      }
    }
    const stripePriceCell = (row as Record<string, unknown>).stripePriceId;
    if (stripePriceCell !== undefined && stripePriceCell !== null) {
      if (typeof stripePriceCell !== "string") {
        return { ok: false, error: `Invalid planOverrides.${key}.stripePriceId: string required` };
      }
      const tid = stripePriceCell.trim();
      if (tid !== "" && !/^price_[a-zA-Z0-9_]+$/.test(tid)) {
        return {
          ok: false,
          error: `Invalid planOverrides.${key}.stripePriceId: use price_… or leave empty`
        };
      }
      if (tid !== "") {
        parsed.stripePriceId = tid;
      }
    }
    if (Object.keys(parsed).length > 0) {
      const list = byPlan.get(planId) ?? [];
      list.push({ legacy: key === LEGACY_ATX_BILLING_PLAN_ID_PREMIUM_PLUS, parsed });
      byPlan.set(planId, list);
    }
  }

  const out: TenantPlanWorkspaceOverrides = {};
  for (const [planId, rows] of byPlan) {
    rows.sort((a, b) => (a.legacy === b.legacy ? 0 : a.legacy ? -1 : 1));
    let merged: TenantPlanWorkspaceRow = {};
    for (const r of rows) {
      merged = { ...merged, ...r.parsed };
    }
    out[planId] = merged;
  }
  return { ok: true, value: out };
}
