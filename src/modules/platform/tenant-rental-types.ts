import type { ObjectId } from "mongodb";

export type TenantRentalStrategyBias = "conservative" | "balanced" | "aggressive";

export type TenantRentalApiKeyScope = "chat" | "strategy" | "analyze";

/**
 * Stored on `core_tenants.rentalProfile` (YAML `tenant.rentalProfile` + runtime `defaultPersonaId`).
 * Maps to Stripe price via `tier` in billing phases (separate work).
 */
export type TenantRentalProfile = {
  tier: string;
  strategyBias: TenantRentalStrategyBias;
  maxPortfolios: number;
  maxDailyTokens: number;
  xaiModelOverride?: string;
  expiresAt: Date;
  apiKeyEnabled: boolean;
  /** Upserted persona for scoped rental xChat (see `ensureRentalAdvisorPersonaForTenant`). */
  defaultPersonaId?: ObjectId;
  /** Stable synthetic owner for sample rental workspace assets (portfolio/watchlist). */
  sampleUserId?: string;
  /** Default sample portfolio for rental chat context. */
  samplePortfolioId?: ObjectId;
};

/**
 * Per-tenant rental integration keys on `core_tenants.apiKeys`.
 * Plaintext is shown once at creation; only `keyHash` (scrypt) is stored for verification.
 */
export type TenantRentalAiKeyStored = {
  id: string;
  scopes: TenantRentalApiKeyScope[];
  keyHash: string;
  label?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  /** When set, key must not authenticate (`authenticateRentalAiApiKey`). */
  revokedAt?: Date;
};
