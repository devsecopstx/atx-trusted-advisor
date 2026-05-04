import type { TenantRentalProfile, TenantRentalStrategyBias } from "@/modules/platform/tenant-rental-types";

const STRATEGY_BIAS: ReadonlySet<string> = new Set(["conservative", "balanced", "aggressive"]);

function assertDate(value: unknown, field: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`tenant.rentalProfile.${field} is an invalid Date`);
    }
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim());
    if (Number.isNaN(d.getTime())) {
      throw new Error(`tenant.rentalProfile.${field} must be a valid ISO-8601 datetime`);
    }
    return d;
  }
  throw new Error(`tenant.rentalProfile.${field} is required (ISO-8601 string or Date)`);
}

function assertEnumBias(raw: unknown, fallback: TenantRentalStrategyBias): TenantRentalStrategyBias {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  if (typeof raw !== "string") {
    throw new Error('tenant.rentalProfile.strategyBias must be "conservative" | "balanced" | "aggressive"');
  }
  const b = raw.trim().toLowerCase();
  if (!STRATEGY_BIAS.has(b)) {
    throw new Error('tenant.rentalProfile.strategyBias must be "conservative" | "balanced" | "aggressive"');
  }
  return b as TenantRentalStrategyBias;
}

function assertPositiveInt(raw: unknown, field: string, fallback: number, max: number): number {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`tenant.rentalProfile.${field} must be an integer between 1 and ${max}`);
  }
  return n;
}

function assertBool(raw: unknown, field: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  if (typeof raw !== "boolean") {
    throw new Error(`tenant.rentalProfile.${field} must be a boolean`);
  }
  return raw;
}

function assertTier(raw: unknown): string {
  if (raw === undefined || raw === null) {
    throw new Error("tenant.rentalProfile.tier is required");
  }
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("tenant.rentalProfile.tier must be a non-empty string");
  }
  const t = raw.trim();
  if (t.length > 128) {
    throw new Error("tenant.rentalProfile.tier must be at most 128 characters");
  }
  return t;
}

function assertOptionalModel(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  const m = raw.trim();
  if (m.length > 128) {
    throw new Error("tenant.rentalProfile.xaiModelOverride must be at most 128 characters");
  }
  return m;
}

/**
 * Parses `tenant.rentalProfile` from tenant spec YAML / admin payloads.
 * Defaults: strategyBias conservative, maxPortfolios 3, maxDailyTokens 100_000, apiKeyEnabled true.
 */
export function parseTenantRentalProfile(raw: unknown): TenantRentalProfile | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.rentalProfile must be an object when present");
  }
  const o = raw as Record<string, unknown>;
  const tier = assertTier(o.tier);
  const strategyBias = assertEnumBias(o.strategyBias, "conservative");
  const maxPortfolios = assertPositiveInt(o.maxPortfolios, "maxPortfolios", 3, 10_000);
  const maxDailyTokens = assertPositiveInt(o.maxDailyTokens, "maxDailyTokens", 100_000, 50_000_000);
  const xaiModelOverride = assertOptionalModel(o.xaiModelOverride);
  const expiresAt = assertDate(o.expiresAt, "expiresAt");
  const apiKeyEnabled = assertBool(o.apiKeyEnabled, "apiKeyEnabled", true);

  return {
    tier,
    strategyBias,
    maxPortfolios,
    maxDailyTokens,
    ...(xaiModelOverride ? { xaiModelOverride } : {}),
    expiresAt,
    apiKeyEnabled
  };
}
