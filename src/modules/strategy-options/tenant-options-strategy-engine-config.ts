import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";
import type { Tenant } from "@/modules/identity/types";
import { OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT } from "@/modules/strategy-options/iv-rank-filter";
import type { MergedScannerFilters } from "@/modules/strategy-options/options-scanner-prefs-filter";
import {
    STRADDLE_DELTA_RANGE,
    STRADDLE_DELTA_TARGET
} from "@/modules/strategy-options/strategy-options-engine";

/** JVM `OptionsStrategyEngine.DEFAULT_MIN_SCORE` parity. */
export const DEFAULT_OPTIONS_ENGINE_MIN_FIT_SCORE = 70;

export type TenantOptionsStrategyEngineScannerConfig = {
  minIvRankPct: number;
  minDte: number | null;
  maxDte: number | null;
  optionTypes: ("call" | "put")[] | null;
  sources: ("position" | "watchlist")[] | null;
  underlyingDenylist: string[];
  underlyingAllowlist: string[] | null;
};

export type TenantOptionsStrategyEngineEngineConfig = {
  straddleDeltaMin: number;
  straddleDeltaMax: number;
  straddleDeltaTarget: number;
  minFitScore: number;
};

/** Persisted on `core_tenants.tenantPreferences.options_strategy_engine`. */
export type TenantOptionsStrategyEngineConfigStored = {
  /** When true, tenant scanner fields replace catalog merge for scheduled scans. */
  overrideEnabled?: boolean;
  scanner?: Partial<{
    minIvRankPct: number;
    minDte: number | null;
    maxDte: number | null;
    optionTypes: ("call" | "put")[];
    sources: ("position" | "watchlist")[];
    underlyingDenylist: string[];
    underlyingAllowlist: string[];
  }>;
  engine?: Partial<{
    straddleDeltaMin: number;
    straddleDeltaMax: number;
    minFitScore: number;
  }>;
};

export type EffectiveOptionsStrategyEngineConfig = {
  overrideEnabled: boolean;
  hasTenantOverride: boolean;
  scanner: TenantOptionsStrategyEngineScannerConfig;
  engine: TenantOptionsStrategyEngineEngineConfig;
  productDefaults: {
    scanner: TenantOptionsStrategyEngineScannerConfig;
    engine: TenantOptionsStrategyEngineEngineConfig;
  };
};

const PRODUCT_DEFAULT_SCANNER: TenantOptionsStrategyEngineScannerConfig = {
  minIvRankPct: OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT,
  minDte: null,
  maxDte: null,
  optionTypes: null,
  sources: null,
  underlyingDenylist: [],
  underlyingAllowlist: null
};

const PRODUCT_DEFAULT_ENGINE: TenantOptionsStrategyEngineEngineConfig = {
  straddleDeltaMin: STRADDLE_DELTA_RANGE.min,
  straddleDeltaMax: STRADDLE_DELTA_RANGE.max,
  straddleDeltaTarget: STRADDLE_DELTA_TARGET,
  minFitScore: DEFAULT_OPTIONS_ENGINE_MIN_FIT_SCORE
};

function normalizeTickerList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim().toUpperCase();
    if (t) {
      out.push(t);
    }
  }
  return [...new Set(out)];
}

function normalizeOptionTypes(raw: unknown): ("call" | "put")[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const set = new Set<"call" | "put">();
  for (const t of raw) {
    if (t === "call" || t === "put") {
      set.add(t);
    }
  }
  return set.size > 0 ? [...set] : null;
}

function normalizeSources(raw: unknown): ("position" | "watchlist")[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const set = new Set<"position" | "watchlist">();
  for (const s of raw) {
    if (s === "position" || s === "watchlist") {
      set.add(s);
    }
  }
  return set.size > 0 ? [...set] : null;
}

function clampPct(n: number): number {
  return Math.round(Math.max(1, Math.min(99, n)));
}

function clampDelta(n: number): number {
  return Math.max(0.01, Math.min(0.99, Math.round(n * 1000) / 1000));
}

function parseNullableDte(raw: unknown): number | null | undefined {
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  return Math.max(0, Math.min(730, Math.round(raw)));
}

export function parseTenantOptionsStrategyEngineConfigStored(
  raw: unknown
): { ok: true; value: TenantOptionsStrategyEngineConfigStored | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "options_strategy_engine must be an object" };
  }
  const input = raw as Record<string, unknown>;
  const out: TenantOptionsStrategyEngineConfigStored = {};

  if (input.overrideEnabled !== undefined) {
    if (typeof input.overrideEnabled !== "boolean") {
      return { ok: false, error: "overrideEnabled must be boolean" };
    }
    out.overrideEnabled = input.overrideEnabled;
  }

  if (input.scanner !== undefined) {
    if (typeof input.scanner !== "object" || input.scanner === null || Array.isArray(input.scanner)) {
      return { ok: false, error: "scanner must be an object" };
    }
    const s = input.scanner as Record<string, unknown>;
    const scanner: NonNullable<TenantOptionsStrategyEngineConfigStored["scanner"]> = {};
    if (s.minIvRankPct !== undefined) {
      if (typeof s.minIvRankPct !== "number" || !Number.isFinite(s.minIvRankPct)) {
        return { ok: false, error: "scanner.minIvRankPct must be a number" };
      }
      scanner.minIvRankPct = clampPct(s.minIvRankPct);
    }
    const minDte = parseNullableDte(s.minDte);
    if (minDte !== undefined) {
      scanner.minDte = minDte;
    }
    const maxDte = parseNullableDte(s.maxDte);
    if (maxDte !== undefined) {
      scanner.maxDte = maxDte;
    }
    if (s.minDte != null && s.maxDte != null && typeof s.minDte === "number" && typeof s.maxDte === "number") {
      if (s.minDte > s.maxDte) {
        return { ok: false, error: "scanner.minDte must be ≤ maxDte" };
      }
    }
    if (s.optionTypes !== undefined) {
      const ot = normalizeOptionTypes(s.optionTypes);
      scanner.optionTypes = ot ?? [];
    }
    if (s.sources !== undefined) {
      const src = normalizeSources(s.sources);
      scanner.sources = src ?? [];
    }
    if (s.underlyingDenylist !== undefined) {
      scanner.underlyingDenylist = normalizeTickerList(s.underlyingDenylist);
    }
    if (s.underlyingAllowlist !== undefined) {
      const allow = normalizeTickerList(s.underlyingAllowlist);
      scanner.underlyingAllowlist = allow;
    }
    out.scanner = scanner;
  }

  if (input.engine !== undefined) {
    if (typeof input.engine !== "object" || input.engine === null || Array.isArray(input.engine)) {
      return { ok: false, error: "engine must be an object" };
    }
    const e = input.engine as Record<string, unknown>;
    const engine: NonNullable<TenantOptionsStrategyEngineConfigStored["engine"]> = {};
    if (e.straddleDeltaMin !== undefined) {
      if (typeof e.straddleDeltaMin !== "number" || !Number.isFinite(e.straddleDeltaMin)) {
        return { ok: false, error: "engine.straddleDeltaMin must be a number" };
      }
      engine.straddleDeltaMin = clampDelta(e.straddleDeltaMin);
    }
    if (e.straddleDeltaMax !== undefined) {
      if (typeof e.straddleDeltaMax !== "number" || !Number.isFinite(e.straddleDeltaMax)) {
        return { ok: false, error: "engine.straddleDeltaMax must be a number" };
      }
      engine.straddleDeltaMax = clampDelta(e.straddleDeltaMax);
    }
    if (e.minFitScore !== undefined) {
      if (typeof e.minFitScore !== "number" || !Number.isFinite(e.minFitScore)) {
        return { ok: false, error: "engine.minFitScore must be a number" };
      }
      engine.minFitScore = Math.max(0, Math.min(100, Math.round(e.minFitScore)));
    }
    const minD = engine.straddleDeltaMin ?? PRODUCT_DEFAULT_ENGINE.straddleDeltaMin;
    const maxD = engine.straddleDeltaMax ?? PRODUCT_DEFAULT_ENGINE.straddleDeltaMax;
    if (minD > maxD) {
      return { ok: false, error: "engine.straddleDeltaMin must be ≤ straddleDeltaMax" };
    }
    out.engine = engine;
  }

  return { ok: true, value: out };
}

export function getTenantOptionsStrategyEngineConfigStored(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined
): TenantOptionsStrategyEngineConfigStored | null {
  const raw = tenant?.tenantPreferences?.options_strategy_engine;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  return raw as TenantOptionsStrategyEngineConfigStored;
}

export function resolveEffectiveTenantOptionsStrategyEngineConfig(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined
): EffectiveOptionsStrategyEngineConfig {
  const stored = getTenantOptionsStrategyEngineConfigStored(tenant);
  const overrideEnabled = stored?.overrideEnabled === true;
  const hasTenantOverride = Boolean(stored && (overrideEnabled || stored.scanner || stored.engine));

  const scanner: TenantOptionsStrategyEngineScannerConfig = {
    ...PRODUCT_DEFAULT_SCANNER,
    minIvRankPct:
      typeof stored?.scanner?.minIvRankPct === "number"
        ? clampPct(stored.scanner.minIvRankPct)
        : PRODUCT_DEFAULT_SCANNER.minIvRankPct,
    minDte: stored?.scanner?.minDte !== undefined ? stored.scanner.minDte : PRODUCT_DEFAULT_SCANNER.minDte,
    maxDte: stored?.scanner?.maxDte !== undefined ? stored.scanner.maxDte : PRODUCT_DEFAULT_SCANNER.maxDte,
    optionTypes:
      stored?.scanner?.optionTypes !== undefined
        ? normalizeOptionTypes(stored.scanner.optionTypes)
        : PRODUCT_DEFAULT_SCANNER.optionTypes,
    sources:
      stored?.scanner?.sources !== undefined
        ? normalizeSources(stored.scanner.sources)
        : PRODUCT_DEFAULT_SCANNER.sources,
    underlyingDenylist: stored?.scanner?.underlyingDenylist
      ? normalizeTickerList(stored.scanner.underlyingDenylist)
      : PRODUCT_DEFAULT_SCANNER.underlyingDenylist,
    underlyingAllowlist: stored?.scanner?.underlyingAllowlist
      ? normalizeTickerList(stored.scanner.underlyingAllowlist)
      : PRODUCT_DEFAULT_SCANNER.underlyingAllowlist
  };

  const engine: TenantOptionsStrategyEngineEngineConfig = {
    straddleDeltaMin:
      typeof stored?.engine?.straddleDeltaMin === "number"
        ? clampDelta(stored.engine.straddleDeltaMin)
        : PRODUCT_DEFAULT_ENGINE.straddleDeltaMin,
    straddleDeltaMax:
      typeof stored?.engine?.straddleDeltaMax === "number"
        ? clampDelta(stored.engine.straddleDeltaMax)
        : PRODUCT_DEFAULT_ENGINE.straddleDeltaMax,
    straddleDeltaTarget: PRODUCT_DEFAULT_ENGINE.straddleDeltaTarget,
    minFitScore:
      typeof stored?.engine?.minFitScore === "number"
        ? Math.max(0, Math.min(100, Math.round(stored.engine.minFitScore)))
        : PRODUCT_DEFAULT_ENGINE.minFitScore
  };

  return {
    overrideEnabled,
    hasTenantOverride,
    scanner,
    engine,
    productDefaults: {
      scanner: { ...PRODUCT_DEFAULT_SCANNER },
      engine: { ...PRODUCT_DEFAULT_ENGINE }
    }
  };
}

export function effectiveScannerConfigToMergedFilters(
  scanner: TenantOptionsStrategyEngineScannerConfig
): MergedScannerFilters {
  return {
    underlyingDenylist: new Set(scanner.underlyingDenylist),
    underlyingAllowlist:
      scanner.underlyingAllowlist && scanner.underlyingAllowlist.length > 0
        ? new Set(scanner.underlyingAllowlist)
        : null,
    minDte: scanner.minDte,
    maxDte: scanner.maxDte,
    minIvRankPct: scanner.minIvRankPct,
    optionTypes: scanner.optionTypes ? new Set(scanner.optionTypes) : null,
    sources: scanner.sources ? new Set(scanner.sources) : null
  };
}

/** Resolve scanner filters: tenant override replaces catalog when enabled; else catalog merge + tenant IV floor. */
export function resolveScannerMergedFiltersForTenant(input: {
  catalogMerged: MergedScannerFilters;
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined;
}): { merged: MergedScannerFilters; effective: EffectiveOptionsStrategyEngineConfig; minIvRankPct: number } {
  const effective = resolveEffectiveTenantOptionsStrategyEngineConfig(input.tenant);
  if (effective.overrideEnabled) {
    const merged = effectiveScannerConfigToMergedFilters(effective.scanner);
    return { merged, effective, minIvRankPct: effective.scanner.minIvRankPct };
  }
  const minIvRankPct = Math.max(
    input.catalogMerged.minIvRankPct ?? effective.scanner.minIvRankPct,
    effective.scanner.minIvRankPct
  );
  return {
    merged: { ...input.catalogMerged, minIvRankPct },
    effective,
    minIvRankPct
  };
}

export type OptionsStrategyEngineConfigApiPayload = {
  overrideEnabled: boolean;
  hasTenantOverride: boolean;
  stored: TenantOptionsStrategyEngineConfigStored | null;
  effective: {
    scanner: TenantOptionsStrategyEngineScannerConfig;
    engine: TenantOptionsStrategyEngineEngineConfig;
  };
  productDefaults: EffectiveOptionsStrategyEngineConfig["productDefaults"];
  complianceNote: string;
};

export function optionsStrategyEngineConfigPayloadForApi(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined
): OptionsStrategyEngineConfigApiPayload {
  const stored = getTenantOptionsStrategyEngineConfigStored(tenant);
  const resolved = resolveEffectiveTenantOptionsStrategyEngineConfig(tenant);
  return {
    overrideEnabled: resolved.overrideEnabled,
    hasTenantOverride: resolved.hasTenantOverride,
    stored,
    effective: {
      scanner: resolved.scanner,
      engine: resolved.engine
    },
    productDefaults: resolved.productDefaults,
    complianceNote:
      "Educational decision-support only — not investment advice. Documented engine parameters support audit and firm policy review."
  };
}

export type TenantPreferencesWithOptionsEngine = TenantPreferences & {
  options_strategy_engine?: TenantOptionsStrategyEngineConfigStored | null;
};
