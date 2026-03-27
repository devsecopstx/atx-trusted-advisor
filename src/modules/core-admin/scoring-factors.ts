import { z } from "zod";

/** Stable ids persisted on `Portfolio.scoringFactors`. */
export const SCORING_FACTOR_IDS = [
  "iv_rank",
  "open_interest",
  "volume",
  "liquidity",
  "portfolio_fit",
  "strategy_alignment"
] as const;

export type ScoringFactorId = (typeof SCORING_FACTOR_IDS)[number];

/** Short admin-facing category line for scoring rows (text-only UI). */
export const SCORING_FACTOR_ADMIN_KIND_LABELS: Record<ScoringFactorId, string> = {
  iv_rank: "Volatility signal",
  open_interest: "Open interest depth",
  volume: "Trading activity",
  liquidity: "Spread / execution",
  portfolio_fit: "Book alignment",
  strategy_alignment: "Outlook & risk fit"
};

export type PortfolioScoringFactor = {
  id: ScoringFactorId;
  /** Portion of composite score; must sum to 1 across selected factors (± tolerance). */
  weight: number;
};

export const SCORING_FACTOR_CATALOG: Record<
  ScoringFactorId,
  { label: string; description: string; normalization: string; defaultWeight: number }
> = {
  iv_rank: {
    label: "IV Rank",
    description: "How high is implied vol vs 1-year history (0–100)",
    normalization: "IV rank percentile mapped to 0–1 (S_IV).",
    defaultWeight: 0.3
  },
  open_interest: {
    label: "Open Interest",
    description: "Total OI on the chain (log-scaled + normalized)",
    normalization: "Log-scale OI then min–max to 0–1 (S_OI).",
    defaultWeight: 0.2
  },
  volume: {
    label: "Volume",
    description: "Daily option volume (normalized)",
    normalization: "Volume normalized to 0–1 vs cohort (S_Vol).",
    defaultWeight: 0.15
  },
  liquidity: {
    label: "Liquidity",
    description: "Average bid–ask spread % (lower = better)",
    normalization: "Spread inverted and scaled to 0–1 (S_Liq).",
    defaultWeight: 0.1
  },
  portfolio_fit: {
    label: "Portfolio Fit",
    description: "Delta match with existing holdings",
    normalization: "Delta alignment score 0–1 (S_Port).",
    defaultWeight: 0.15
  },
  strategy_alignment: {
    label: "Outlook & risk alignment",
    description: "How well the setup matches the book’s outlook and risk tolerance",
    normalization: "Outlook/risk match 0–1 (S_Align).",
    defaultWeight: 0.1
  }
};

export const DEFAULT_PORTFOLIO_SCORING_FACTORS: readonly PortfolioScoringFactor[] = SCORING_FACTOR_IDS.map(
  (id) => ({
    id,
    weight: SCORING_FACTOR_CATALOG[id].defaultWeight
  })
);

/** Composite: score = 100 * Σ (weight_i * S_i) with each S_i in [0,1]. */
export const SCORING_FORMULA_DESCRIPTION =
  "score = 100 * (0.30 * S_IV + 0.20 * S_OI + 0.15 * S_Vol + 0.10 * S_Liq + 0.15 * S_Port + 0.10 * S_Align)";

export const SCORING_WEIGHT_SUM_TOLERANCE = 0.002;

const scoringFactorRowSchema = z.object({
  id: z.enum(SCORING_FACTOR_IDS),
  weight: z.number().finite().min(0).max(1)
});

export const portfolioScoringFactorsBodySchema = z
  .array(scoringFactorRowSchema)
  .min(1)
  .max(SCORING_FACTOR_IDS.length)
  .superRefine((arr, ctx) => {
    const ids = arr.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate scoring factor id" });
    }
    const sum = arr.reduce((s, r) => s + r.weight, 0);
    if (Math.abs(sum - 1) > SCORING_WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Weights must sum to 1 (±${SCORING_WEIGHT_SUM_TOLERANCE}); got ${sum.toFixed(4)}`
      });
    }
  });

/** PATCH body: explicit factors or null to clear (defaults on read). */
export const patchPortfolioScoringFactorsSchema = z.union([z.null(), portfolioScoringFactorsBodySchema]);

/** Returns canonical order (catalog order) for stable API responses. */
export function sortScoringFactorsByCatalog(factors: PortfolioScoringFactor[]): PortfolioScoringFactor[] {
  const order = new Map(SCORING_FACTOR_IDS.map((id, i) => [id, i]));
  return [...factors].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export function parsePortfolioScoringFactorsInput(raw: unknown): PortfolioScoringFactor[] | null {
  const parsed = portfolioScoringFactorsBodySchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return sortScoringFactorsByCatalog(parsed.data);
}

/**
 * Effective factors for a portfolio: validated stored row or full defaults when missing/invalid.
 */
export function resolvePortfolioScoringFactors(
  stored: PortfolioScoringFactor[] | undefined | null | unknown
): PortfolioScoringFactor[] {
  if (stored == null) {
    return DEFAULT_PORTFOLIO_SCORING_FACTORS.map((x) => ({ ...x }));
  }
  if (!Array.isArray(stored)) {
    return DEFAULT_PORTFOLIO_SCORING_FACTORS.map((x) => ({ ...x }));
  }
  const parsed = parsePortfolioScoringFactorsInput(stored);
  if (!parsed) {
    return DEFAULT_PORTFOLIO_SCORING_FACTORS.map((x) => ({ ...x }));
  }
  return parsed;
}

export type PortfolioScoringFactorApi = PortfolioScoringFactor & {
  label: string;
  description: string;
  normalization: string;
};

export function enrichScoringFactorsForApi(factors: PortfolioScoringFactor[]): PortfolioScoringFactorApi[] {
  return factors.map((f) => {
    const c = SCORING_FACTOR_CATALOG[f.id];
    return {
      id: f.id,
      weight: f.weight,
      label: c.label,
      description: c.description,
      normalization: c.normalization
    };
  });
}

/** Admin GET/PATCH JSON: resolved defaults + catalog copy for UI. */
export function scoringFactorsPayloadForAdminApi(
  stored: PortfolioScoringFactor[] | undefined | null | unknown
): { scoringFactors: PortfolioScoringFactorApi[] } {
  return {
    scoringFactors: enrichScoringFactorsForApi(resolvePortfolioScoringFactors(stored))
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

/**
 * Weighted strategy score 0–100 from normalized sub-scores in [0,1].
 * Missing keys contribute 0.
 */
export function computeWeightedStrategyScore(
  factors: PortfolioScoringFactor[],
  subscores: Partial<Record<ScoringFactorId, number>>
): number {
  let sum = 0;
  for (const f of factors) {
    sum += f.weight * clamp01(subscores[f.id] ?? 0);
  }
  return 100 * sum;
}
