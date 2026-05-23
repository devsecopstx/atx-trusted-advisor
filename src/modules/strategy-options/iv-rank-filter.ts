import type { OptionContractData } from "@/modules/strategy-options/options-chain";

/** Scheduled `options_scanner` + desk refresh default (May 2026). */
export const OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT = 45;

export type IVRankFilterInput = {
  /** Minimum IV rank percentile (0–100). Symbols below floor are excluded. */
  minIvRankPct: number;
};

export type IVRankFilterResult = {
  minIvRankPct: number;
  ivRankPct: number | null;
  passes: boolean;
};

/**
 * Desk heuristic: map ATM implied vol (decimal) to a 0–100 IV rank proxy
 * (same formula as Monte Carlo / wheel generator paths).
 */
export function estimateIvRankPercentFromAtmIv(impliedVolDecimal: number | null | undefined): number | null {
  if (impliedVolDecimal == null || !Number.isFinite(impliedVolDecimal) || impliedVolDecimal <= 0) {
    return null;
  }
  const dec = impliedVolDecimal > 3 ? impliedVolDecimal / 100 : impliedVolDecimal;
  const ivPct = dec * 100;
  return Math.min(99, Math.max(1, ((ivPct - 15) / 55) * 100));
}

export function estimateIvRankPercentFromOptionChain(
  optionChain: ReadonlyArray<{
    strike: number;
    call?: OptionContractData | null;
    put?: OptionContractData | null;
  }>,
  spot: number
): number | null {
  if (!Number.isFinite(spot) || spot <= 0 || optionChain.length === 0) {
    return null;
  }
  let bestIv: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const row of optionChain) {
    const strike = row.strike;
    if (!Number.isFinite(strike)) {
      continue;
    }
    const dist = Math.abs(strike - spot);
    for (const leg of [row.call, row.put]) {
      if (!leg) {
        continue;
      }
      const ivRaw = leg.implied_volatility;
      if (typeof ivRaw !== "number" || !Number.isFinite(ivRaw)) {
        continue;
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestIv = ivRaw;
      }
    }
  }
  return estimateIvRankPercentFromAtmIv(bestIv);
}

export function applyIVRankFilter(
  ivRankPct: number | null,
  filter: IVRankFilterInput
): IVRankFilterResult {
  const minIvRankPct = Math.max(0, Math.min(99, filter.minIvRankPct));
  if (minIvRankPct <= 0) {
    return { minIvRankPct, ivRankPct, passes: true };
  }
  if (ivRankPct == null) {
    return { minIvRankPct, ivRankPct: null, passes: true };
  }
  return {
    minIvRankPct,
    ivRankPct,
    passes: ivRankPct >= minIvRankPct
  };
}

export function mergeMinIvRankPctFromStrategyFilters(
  rows: ReadonlyArray<{ filters: Record<string, unknown> | null | undefined }>
): number | null {
  let floor: number | null = null;
  for (const row of rows) {
    const f = row.filters;
    if (!f || typeof f !== "object") {
      continue;
    }
    const raw = f.minIvRankPct ?? f.minIvRank ?? f.ivRankMinPct;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    const pct = Math.round(Math.max(1, Math.min(99, raw)));
    floor = floor === null ? pct : Math.max(floor, pct);
  }
  return floor;
}

export function resolveScannerIvRankFloor(
  strategyFilterRows: ReadonlyArray<{ filters: Record<string, unknown> | null | undefined }>
): number {
  return mergeMinIvRankPctFromStrategyFilters(strategyFilterRows) ?? OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT;
}
