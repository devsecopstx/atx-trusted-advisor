import { z } from "zod";

import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";

const digestCadenceSchema = z.enum(["unspecified", "in_app_only", "daily", "weekly"]);

export const portfolioAlertScannerMetadataV1Schema = z.object({
  v: z.literal(1),
  source: z.literal("options_scanner"),
  contractKey: z.string().min(1).max(512),
  closeKind: z.enum(["BUY_TO_CLOSE", "SELL_TO_CLOSE"]),
  fingerprint: z.string().min(1).max(512),
  snoozeKeys: z.object({
    symbolUpper: z.string().max(32),
    contractKey: z.string().max(512)
  }),
  metrics: z.object({
    dte: z.number(),
    mark: z.number(),
    pnlPct: z.number().nullable(),
    ivPct: z.number(),
    openInterest: z.number(),
    volume: z.number(),
    finalConfidence: z.number(),
    grokUsed: z.boolean(),
    /** Reserved for chain/Greeks enrichment — null until positions carry greeks. */
    deltaAbs: z.number().nullable().optional(),
    /** Reserved — null until theta/day is computed per leg. */
    thetaPerDayUsd: z.number().nullable().optional()
  }),
  thresholdsApplied: z.record(z.string(), z.number()),
  scoringFactorWeights: z.record(z.string(), z.number()),
  userGoalBinding: z
    .object({
      kind: z.enum(["portfolio_scoring_weights_proxy", "explicit_thresholds"]),
      note: z.string().max(420)
    })
    .optional(),
  delivery: z.object({
    immediateInApp: z.boolean(),
    digestEligible: z.boolean(),
    digestCadenceUser: digestCadenceSchema.optional()
  }),
  throttle: z.object({
    maxAlertsPerRun: z.number().int().nonnegative(),
    dedupeKey: z.string().max(640)
  })
});

export type PortfolioAlertScannerMetadataV1 = z.infer<typeof portfolioAlertScannerMetadataV1Schema>;

const METADATA_MAX_BYTES = 3600;

export function buildOptionsScannerAlertMetadata(input: {
  contractKey: string;
  closeKind: "BUY_TO_CLOSE" | "SELL_TO_CLOSE";
  fingerprint: string;
  underlying: string;
  metrics: Omit<PortfolioAlertScannerMetadataV1["metrics"], "deltaAbs" | "thetaPerDayUsd"> & {
    deltaAbs?: number | null;
    thetaPerDayUsd?: number | null;
  };
  thresholdsApplied: Record<string, number>;
  scoringFactors: PortfolioScoringFactor[];
  maxAlertsPerRun: number;
  dedupeKey: string;
}): PortfolioAlertScannerMetadataV1 | null {
  const scoringFactorWeights = Object.fromEntries(input.scoringFactors.map((f) => [f.id, f.weight]));
  const thresholdsApplied = input.thresholdsApplied;

  const raw: PortfolioAlertScannerMetadataV1 = {
    v: 1,
    source: "options_scanner",
    contractKey: input.contractKey.slice(0, 512),
    closeKind: input.closeKind,
    fingerprint: input.fingerprint.slice(0, 512),
    snoozeKeys: {
      symbolUpper: input.underlying.trim().toUpperCase().slice(0, 32),
      contractKey: input.contractKey.slice(0, 512)
    },
    metrics: {
      ...input.metrics,
      deltaAbs: input.metrics.deltaAbs ?? null,
      thetaPerDayUsd: input.metrics.thetaPerDayUsd ?? null
    },
    thresholdsApplied,
    scoringFactorWeights,
    userGoalBinding: {
      kind: "portfolio_scoring_weights_proxy",
      note:
        "Thresholds nudge from portfolio scoring weights (IV, liquidity, fit, alignment). Explicit DTE / |delta| / theta-per-day budgets are reserved for a future portfolio.preferences block; digest cadence and snooze prefs are not yet read here."
    },
    delivery: {
      immediateInApp: true,
      digestEligible: true,
      digestCadenceUser: "unspecified"
    },
    throttle: {
      maxAlertsPerRun: input.maxAlertsPerRun,
      dedupeKey: input.dedupeKey.slice(0, 640)
    }
  };

  const parsed = portfolioAlertScannerMetadataV1Schema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const encoded = new TextEncoder().encode(JSON.stringify(parsed.data)).length;
  if (encoded > METADATA_MAX_BYTES) {
    const trimmed: PortfolioAlertScannerMetadataV1 = {
      ...parsed.data,
      userGoalBinding: {
        kind: "portfolio_scoring_weights_proxy",
        note: "Metadata trimmed for size; see thresholdsApplied + scoringFactorWeights."
      }
    };
    const again = portfolioAlertScannerMetadataV1Schema.safeParse(trimmed);
    if (!again.success) {
      return null;
    }
    if (new TextEncoder().encode(JSON.stringify(again.data)).length > METADATA_MAX_BYTES) {
      return null;
    }
    return again.data;
  }
  return parsed.data;
}
