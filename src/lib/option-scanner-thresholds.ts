import type { PortfolioScoringFactor, ScoringFactorId } from "@/modules/core-admin/scoring-factors";

/** Desk rule inputs for `decideOptionActionFromRules` (env defaults + scoring-factor-derived nudges). */
export type OptionScannerRuleThresholds = {
  lossCutPctDefault: number;
  profitTakePctDefault: number;
  shortPutHighIvIvMinPct: number;
  shortPutHighIvLossCutPct: number;
  shortPutHighIvProfitTakePct: number;
  minOpenInterestWarn: number;
  minVolumeWarn: number;
  veryShortDteDays: number;
  shortDteGammaWatchDays: number;
  shortDteGammaWatchPnlPctMin: number;
};

export const DEFAULT_OPTION_SCANNER_THRESHOLDS: OptionScannerRuleThresholds = {
  lossCutPctDefault: -55,
  profitTakePctDefault: 85,
  shortPutHighIvIvMinPct: 70,
  shortPutHighIvLossCutPct: -40,
  shortPutHighIvProfitTakePct: 70,
  minOpenInterestWarn: 25,
  minVolumeWarn: 5,
  veryShortDteDays: 3,
  shortDteGammaWatchDays: 7,
  shortDteGammaWatchPnlPctMin: 35
};

function factorWeight(factors: PortfolioScoringFactor[], id: ScoringFactorId): number {
  return factors.find((f) => f.id === id)?.weight ?? 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Maps portfolio scoring weights into rule thresholds (proxy for risk budget / income style until
 * explicit per-book DTE, delta, and theta/day limits exist on `tenant_portfolio`).
 */
export function deriveOptionScannerThresholdsFromScoringFactors(
  factors: PortfolioScoringFactor[]
): OptionScannerRuleThresholds {
  const t = { ...DEFAULT_OPTION_SCANNER_THRESHOLDS };
  const wIv = factorWeight(factors, "iv_rank");
  const wLiq = factorWeight(factors, "liquidity");
  const wAlign = factorWeight(factors, "strategy_alignment");
  const wFit = factorWeight(factors, "portfolio_fit");

  const ivSkew = wIv - 0.3;
  t.lossCutPctDefault = clamp(t.lossCutPctDefault + ivSkew * 35, -68, -32);
  t.profitTakePctDefault = clamp(t.profitTakePctDefault - ivSkew * 22, 58, 92);
  t.shortPutHighIvIvMinPct = clamp(t.shortPutHighIvIvMinPct - ivSkew * 18, 52, 82);

  const liqSkew = wLiq - 0.1;
  t.minOpenInterestWarn = Math.round(clamp(t.minOpenInterestWarn + liqSkew * 90, 8, 140));
  t.minVolumeWarn = Math.round(clamp(t.minVolumeWarn + liqSkew * 40, 2, 80));

  const riskBlend = (wAlign + wFit) / 2 - 0.125;
  t.shortDteGammaWatchDays = Math.round(clamp(t.shortDteGammaWatchDays - riskBlend * 12, 3, 14));
  t.shortDteGammaWatchPnlPctMin = Math.round(clamp(t.shortDteGammaWatchPnlPctMin - riskBlend * 18, 18, 55));

  return t;
}

export function thresholdsAppliedRecord(t: OptionScannerRuleThresholds): Record<string, number> {
  return { ...t };
}
