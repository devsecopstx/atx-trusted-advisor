import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";

export type BootstrapPlatformRole = "viewer" | "operator" | "advisor";

export type TenantBootstrapPolicyOverrideV1 = {
  role: string;
  defaultPortfolio?: boolean;
  defaultWatchlist?: boolean;
  symbols?: string[];
};

export type TenantBootstrapPolicyV1 = {
  defaultPortfolio: Record<BootstrapPlatformRole, boolean>;
  defaultWatchlist: Record<BootstrapPlatformRole, boolean>;
  overrides: TenantBootstrapPolicyOverrideV1[];
};

export const DEFAULT_TENANT_BOOTSTRAP_POLICY_V1: TenantBootstrapPolicyV1 = {
  defaultPortfolio: { viewer: false, operator: true, advisor: true },
  defaultWatchlist: { viewer: false, operator: true, advisor: true },
  overrides: []
};

const PLATFORM_ROLES: BootstrapPlatformRole[] = ["viewer", "operator", "advisor"];

function readRoleBoolMap(raw: unknown, label: string): Record<BootstrapPlatformRole, boolean> {
  if (raw === undefined || raw === null) {
    throw new Error(`bootstrapPolicy.${label} is required`);
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`bootstrapPolicy.${label} must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const out = {} as Record<BootstrapPlatformRole, boolean>;
  for (const role of PLATFORM_ROLES) {
    const v = o[role];
    if (typeof v !== "boolean") {
      throw new Error(`bootstrapPolicy.${label}.${role} must be a boolean`);
    }
    out[role] = v;
  }
  return out;
}

export function parseTenantBootstrapPolicyFromUnknown(raw: unknown): TenantBootstrapPolicyV1 {
  if (raw === undefined || raw === null) {
    return DEFAULT_TENANT_BOOTSTRAP_POLICY_V1;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bootstrapPolicy must be an object");
  }
  const o = raw as Record<string, unknown>;
  const defaultPortfolio = readRoleBoolMap(o.defaultPortfolio, "defaultPortfolio");
  const defaultWatchlist = readRoleBoolMap(o.defaultWatchlist, "defaultWatchlist");
  const overridesRaw = o.overrides;
  const overrides: TenantBootstrapPolicyOverrideV1[] = [];
  if (overridesRaw !== undefined && overridesRaw !== null) {
    if (!Array.isArray(overridesRaw)) {
      throw new Error("bootstrapPolicy.overrides must be an array");
    }
    for (const entry of overridesRaw) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new Error("bootstrapPolicy.overrides entries must be objects");
      }
      const e = entry as Record<string, unknown>;
      const role = typeof e.role === "string" ? e.role.trim() : "";
      if (!role) {
        throw new Error("bootstrapPolicy.overrides.role is required");
      }
      const patch: TenantBootstrapPolicyOverrideV1 = { role };
      if (e.defaultPortfolio !== undefined) {
        if (typeof e.defaultPortfolio !== "boolean") {
          throw new Error(`bootstrapPolicy.overrides.defaultPortfolio for ${role} must be boolean`);
        }
        patch.defaultPortfolio = e.defaultPortfolio;
      }
      if (e.defaultWatchlist !== undefined) {
        if (typeof e.defaultWatchlist !== "boolean") {
          throw new Error(`bootstrapPolicy.overrides.defaultWatchlist for ${role} must be boolean`);
        }
        patch.defaultWatchlist = e.defaultWatchlist;
      }
      if (e.symbols !== undefined) {
        if (!Array.isArray(e.symbols)) {
          throw new Error(`bootstrapPolicy.overrides.symbols for ${role} must be an array`);
        }
        patch.symbols = e.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      }
      overrides.push(patch);
    }
  }
  return { defaultPortfolio, defaultWatchlist, overrides };
}

export function pickBootstrapPlatformRole(userRoles: readonly string[]): BootstrapPlatformRole | null {
  const set = new Set(userRoles.map((r) => String(r).trim().toLowerCase()));
  if (set.has("advisor")) {
    return "advisor";
  }
  if (set.has("operator")) {
    return "operator";
  }
  if (set.has("viewer")) {
    return "viewer";
  }
  return null;
}

export function resolveBootstrapFlagsForRole(
  policy: TenantBootstrapPolicyV1,
  platformRole: BootstrapPlatformRole
): { defaultPortfolio: boolean; defaultWatchlist: boolean; overrideSymbols?: string[] } {
  let defaultPortfolio = policy.defaultPortfolio[platformRole];
  let defaultWatchlist = policy.defaultWatchlist[platformRole];
  let overrideSymbols: string[] | undefined;
  const pr = platformRole.toLowerCase();
  for (const o of policy.overrides) {
    if (String(o.role).trim().toLowerCase() === pr) {
      if (o.defaultPortfolio !== undefined) {
        defaultPortfolio = o.defaultPortfolio;
      }
      if (o.defaultWatchlist !== undefined) {
        defaultWatchlist = o.defaultWatchlist;
      }
      if (o.symbols !== undefined && o.symbols.length > 0) {
        overrideSymbols = o.symbols;
      }
    }
  }
  return { defaultPortfolio, defaultWatchlist, overrideSymbols };
}

function preferencesRecord(tp: TenantPreferences | null | undefined): Record<string, unknown> {
  if (tp == null || typeof tp !== "object") {
    return {};
  }
  return tp as Record<string, unknown>;
}

/**
 * Resolves persisted `bootstrap_policy`, else maps legacy `bootstrap_default_portfolio_watchlist`,
 * else architect defaults (viewer: no book; operator/advisor: book + desk watchlist).
 */
export function effectiveTenantBootstrapPolicy(
  tenantPreferences: TenantPreferences | null | undefined
): TenantBootstrapPolicyV1 {
  const rec = preferencesRecord(tenantPreferences);
  const embedded = rec.bootstrap_policy;
  if (embedded !== undefined && embedded !== null) {
    return parseTenantBootstrapPolicyFromUnknown(embedded);
  }
  const legacy = rec.bootstrap_default_portfolio_watchlist;
  if (legacy === false) {
    return {
      defaultPortfolio: { viewer: false, operator: false, advisor: false },
      defaultWatchlist: { viewer: false, operator: false, advisor: false },
      overrides: []
    };
  }
  if (legacy === true) {
    return {
      defaultPortfolio: { viewer: true, operator: true, advisor: true },
      defaultWatchlist: { viewer: true, operator: true, advisor: true },
      overrides: []
    };
  }
  return DEFAULT_TENANT_BOOTSTRAP_POLICY_V1;
}

export function tenantBootstrapOnApprove(
  tenantPreferences: TenantPreferences | null | undefined
): boolean {
  return preferencesRecord(tenantPreferences).bootstrap_on_approve === true;
}

export function normalizeWatchlistSeedSymbolsFromPreferences(
  tenantPreferences: TenantPreferences | null | undefined
): string[] | undefined {
  const rec = preferencesRecord(tenantPreferences);
  const raw = rec.watchlist_seed_symbols;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out = raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  return out.length > 0 ? out : undefined;
}

export function resolveWatchlistSeedSymbols(input: {
  defaultWatchlist: boolean;
  overrideSymbols?: string[];
  tenantTemplateSymbols?: string[];
  deskDefaults: readonly string[];
}): string[] | undefined {
  if (!input.defaultWatchlist) {
    return undefined;
  }
  if (input.overrideSymbols?.length) {
    return [...input.overrideSymbols];
  }
  if (input.tenantTemplateSymbols?.length) {
    return [...input.tenantTemplateSymbols];
  }
  return [...input.deskDefaults];
}

export function bootstrapPolicyToMongoShape(policy: TenantBootstrapPolicyV1): Record<string, unknown> {
  return {
    defaultPortfolio: { ...policy.defaultPortfolio },
    defaultWatchlist: { ...policy.defaultWatchlist },
    overrides: policy.overrides.map((o) => ({
      role: o.role,
      ...(o.defaultPortfolio !== undefined ? { defaultPortfolio: o.defaultPortfolio } : {}),
      ...(o.defaultWatchlist !== undefined ? { defaultWatchlist: o.defaultWatchlist } : {}),
      ...(o.symbols !== undefined && o.symbols.length > 0 ? { symbols: [...o.symbols] } : {})
    }))
  };
}
