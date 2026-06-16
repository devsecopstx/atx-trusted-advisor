/**
 * Spot-aware filtering + desk ranking for xChat `options_scan` (CSP / covered-call ideas).
 * Keeps strikes near current price (or cost basis / entry when supplied) instead of far OTM lottery legs.
 */

import { STRIKE_SPOT_BAND_PCT } from "@/lib/xoptions/xoptions-chain-helpers";

export type OptionsScanDeskLeg = {
  expiration: string;
  dte: number;
  strike: number;
  optionType: "call" | "put";
  bid: number;
  ask: number;
  mid: number;
  ivPct: number;
  openInterest: number;
  deltaAbs: number | null;
  deltaRaw: number | null;
};

export type OptionsScanDeskContext = {
  spot: number | null;
  /** Cost basis, watchlist entry, or other desk anchor; defaults to spot when unset. */
  referencePrice?: number | null;
  /** Max cash collateral per contract (strike × 100), e.g. 15_000 for "fits 15k". */
  maxCollateralUsd?: number | null;
  /** Max OTM distance below reference for CSP puts (fraction, default 0.15). */
  maxPutOtmPct?: number;
  /** Max OTM distance above reference for covered calls (fraction, default 0.15). */
  maxCallOtmPct?: number;
};

const DEFAULT_MIN_MID_PREMIUM = 0.08;
const CSP_TARGET_DELTA = 0.28;

export function parseMaxCollateralUsdFromText(text: string): number | null {
  const q = text.trim().toLowerCase();
  if (!q) {
    return null;
  }
  const kMatch = q.match(/\b(?:fits?|under|<=|<|max|budget|collateral)\s*(?:\$?\s*)?(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) {
    const n = Number.parseFloat(kMatch[1]!);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 1000);
    }
  }
  const usdMatch = q.match(
    /\b(?:fits?|under|<=|<|max|budget|collateral)\s*(?:\$?\s*)?(\d{1,3}(?:,\d{3})+|\d{4,})\b/
  );
  if (usdMatch) {
    const n = Number.parseFloat(usdMatch[1]!.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 500) {
      return Math.round(n);
    }
  }
  return null;
}

export function resolveOptionsScanReferencePrice(input: {
  spot: number | null;
  referencePrice?: number | null;
}): number | null {
  const spot =
    typeof input.spot === "number" && Number.isFinite(input.spot) && input.spot > 0
      ? input.spot
      : null;
  const ref =
    typeof input.referencePrice === "number" &&
    Number.isFinite(input.referencePrice) &&
    input.referencePrice > 0
      ? input.referencePrice
      : null;
  return ref ?? spot;
}

function putOtmPct(strike: number, reference: number): number {
  if (reference <= 0) {
    return 0;
  }
  return strike < reference ? ((reference - strike) / reference) * 100 : 0;
}

function callOtmPct(strike: number, reference: number): number {
  if (reference <= 0) {
    return 0;
  }
  return strike > reference ? ((strike - reference) / reference) * 100 : 0;
}

export function annualizedRocOnCollateral(leg: OptionsScanDeskLeg): number {
  const collateral = leg.optionType === "put" ? leg.strike : leg.strike;
  if (collateral <= 0 || leg.mid <= 0) {
    return 0;
  }
  return (leg.mid / collateral) * (365 / Math.max(1, leg.dte)) * 100;
}

export function annualizedRocOnSpot(leg: OptionsScanDeskLeg, spot: number): number {
  if (spot <= 0 || leg.mid <= 0) {
    return 0;
  }
  return (leg.mid / spot) * (365 / Math.max(1, leg.dte)) * 100;
}

function riskRewardScore(leg: OptionsScanDeskLeg): number {
  const roc = annualizedRocOnCollateral(leg);
  const delta = leg.deltaAbs ?? CSP_TARGET_DELTA;
  const deltaPenalty = Math.abs(delta - CSP_TARGET_DELTA) * 120;
  const oiBoost = Math.min(20, Math.log10(Math.max(1, leg.openInterest)) * 4);
  return roc - deltaPenalty + oiBoost;
}

export function filterOptionsScanLegsForDesk(
  legs: OptionsScanDeskLeg[],
  optionType: "put" | "call",
  ctx: OptionsScanDeskContext
): OptionsScanDeskLeg[] {
  const reference = resolveOptionsScanReferencePrice(ctx);
  if (reference == null || reference <= 0) {
    return legs.filter((leg) => leg.mid >= DEFAULT_MIN_MID_PREMIUM);
  }

  const maxPutOtm = ctx.maxPutOtmPct ?? STRIKE_SPOT_BAND_PCT;
  const maxCallOtm = ctx.maxCallOtmPct ?? STRIKE_SPOT_BAND_PCT;
  const maxCollateral = ctx.maxCollateralUsd ?? null;

  return legs.filter((leg) => {
    if (leg.optionType !== optionType) {
      return false;
    }
    if (leg.mid < DEFAULT_MIN_MID_PREMIUM) {
      return false;
    }
    if (maxCollateral != null && leg.strike * 100 > maxCollateral + 1e-6) {
      return false;
    }

    if (optionType === "put") {
      if (leg.strike > reference * 1.02 + 1e-6) {
        return false;
      }
      const otm = putOtmPct(leg.strike, reference) / 100;
      if (otm > maxPutOtm + 1e-6) {
        return false;
      }
      return true;
    }

    if (leg.strike < reference * 0.99 - 1e-6) {
      return false;
    }
    const otm = callOtmPct(leg.strike, reference) / 100;
    return otm <= maxCallOtm + 1e-6;
  });
}

export function rankOptionsScanLegsForDesk(
  legs: OptionsScanDeskLeg[],
  optionType: "put" | "call",
  ctx: OptionsScanDeskContext
): OptionsScanDeskLeg[] {
  const reference = resolveOptionsScanReferencePrice(ctx) ?? 0;
  return [...legs].sort((a, b) => {
    if (a.dte !== b.dte) {
      return a.dte - b.dte;
    }
    if (optionType === "put") {
      const distA = reference > 0 ? Math.abs(a.strike - reference * 0.92) : 0;
      const distB = reference > 0 ? Math.abs(b.strike - reference * 0.92) : 0;
      if (Math.abs(distA - distB) > 0.05) {
        return distA - distB;
      }
      const rocDiff = annualizedRocOnCollateral(b) - annualizedRocOnCollateral(a);
      if (Math.abs(rocDiff) > 0.5) {
        return rocDiff > 0 ? 1 : -1;
      }
    } else {
      const rocDiff = annualizedRocOnSpot(b, reference) - annualizedRocOnSpot(a, reference);
      if (Math.abs(rocDiff) > 0.5) {
        return rocDiff > 0 ? 1 : -1;
      }
    }
    if (b.openInterest !== a.openInterest) {
      return b.openInterest - a.openInterest;
    }
    return b.mid - a.mid;
  });
}

export function pickOptionsScanTopIdeas(
  legs: OptionsScanDeskLeg[],
  optionType: "put" | "call"
): Array<{ tag: string; leg: OptionsScanDeskLeg }> {
  if (legs.length === 0) {
    return [];
  }
  const tags =
    optionType === "put"
      ? (["Best Yield", "Best Liquidity", "Best Risk/Reward"] as const)
      : (["Best Yield", "Best Liquidity", "Best Upside/Income Balance"] as const);

  const candidatesByTag: Array<{ tag: string; sorted: OptionsScanDeskLeg[] }> = [
    {
      tag: tags[0],
      sorted: [...legs].sort(
        (a, b) => annualizedRocOnCollateral(b) - annualizedRocOnCollateral(a)
      )
    },
    { tag: tags[1], sorted: [...legs].sort((a, b) => b.openInterest - a.openInterest) },
    {
      tag: tags[2],
      sorted: [...legs].sort((a, b) => riskRewardScore(b) - riskRewardScore(a))
    }
  ];

  const picks: Array<{ tag: string; leg: OptionsScanDeskLeg }> = [];
  const seen = new Set<string>();
  const legKey = (leg: OptionsScanDeskLeg) => `${leg.strike}:${leg.dte}:${leg.expiration}`;

  for (const bucket of candidatesByTag) {
    const leg = bucket.sorted.find((row) => !seen.has(legKey(row))) ?? bucket.sorted[0];
    if (!leg) {
      continue;
    }
    seen.add(legKey(leg));
    picks.push({ tag: bucket.tag, leg });
  }

  return picks;
}
