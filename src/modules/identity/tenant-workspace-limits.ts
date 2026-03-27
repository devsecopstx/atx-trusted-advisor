/**
 * Per-tenant workspace quotas (stored on `core_tenants.workspaceLimits`, partial override of defaults).
 * Field names mirror product language; Mongo may store camelCase.
 */
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

export function mergeTenantWorkspaceLimits(
  partial?: Partial<TenantWorkspaceLimits> | null
): TenantWorkspaceLimits {
  const out = { ...DEFAULT_TENANT_WORKSPACE_LIMITS };
  if (!partial) {
    return out;
  }
  for (const k of LIMIT_KEYS) {
    const v = partial[k];
    if (isPositiveInt(v)) {
      out[k] = v;
    }
  }
  return out;
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
