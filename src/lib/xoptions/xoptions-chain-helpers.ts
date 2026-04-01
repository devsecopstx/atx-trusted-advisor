/**
 * Pure helpers for xOptions chain scanner (expiration pick + display metrics).
 * See .cursor/plans/options_scanner_spec.md
 */

/** Calendar add in UTC to match YYYY-MM-DD option expirations. */
export function addCalendarDaysUtc(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function utcDayStartMs(yyyyMmDd: string): number {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).getTime();
}

/**
 * Closest expiration string (YYYY-MM-DD) that is on or after `target` (UTC day).
 * Returns null if `dates` is empty or every date is before target.
 */
export function pickExpirationOnOrAfter(dates: string[], target: Date): string | null {
  if (dates.length === 0) {
    return null;
  }
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const sorted = [...new Set(dates)].sort((a, b) => utcDayStartMs(a) - utcDayStartMs(b));
  for (const d of sorted) {
    if (utcDayStartMs(d) >= t) {
      return d.slice(0, 10);
    }
  }
  return null;
}

export function horizonShortLabel(days: number): string {
  if (days === 7) return "1W";
  if (days === 14) return "2W";
  if (days === 28) return "4W";
  return `${days}d`;
}

export type SpreadMetrics = {
  abs: number;
  pctMid: number | null;
};

export function spreadMetrics(bid: number, ask: number): SpreadMetrics {
  const abs = ask - bid;
  const mid = (bid + ask) / 2;
  if (!Number.isFinite(mid) || mid <= 1e-8) {
    return { abs, pctMid: null };
  }
  return { abs, pctMid: (abs / mid) * 100 };
}

/** Spec: green if ≤$0.10 or ≤5% of mid; amber if ≤$0.25 (and not green); else red. */
export function spreadQuality(
  abs: number,
  pctMid: number | null
): "ok" | "mid" | "wide" {
  const pct = pctMid ?? 999;
  if (abs <= 0.1 || pct <= 5) {
    return "ok";
  }
  if (abs <= 0.25) {
    return "mid";
  }
  return "wide";
}

export function otmPercentCall(strike: number, underlying: number): number {
  if (underlying <= 0) {
    return 0;
  }
  return strike > underlying ? ((strike - underlying) / underlying) * 100 : 0;
}

export function otmPercentPut(strike: number, underlying: number): number {
  if (underlying <= 0) {
    return 0;
  }
  return strike < underlying ? ((underlying - strike) / underlying) * 100 : 0;
}

/**
 * For compact chain views: keep strikes closest to spot (e.g. ATM window).
 * `windowSize` = max rows to show (e.g. 7).
 */
export function sliceStrikesAroundSpot<T extends { strike: number }>(
  rows: T[],
  spot: number,
  windowSize: number
): T[] {
  if (rows.length === 0) {
    return [];
  }
  if (!Number.isFinite(spot) || spot <= 0) {
    return rows.slice(0, Math.min(windowSize, rows.length));
  }
  const sorted = [...rows].sort((a, b) => a.strike - b.strike);
  let bestIdx = 0;
  let bestDist = Infinity;
  sorted.forEach((r, i) => {
    const d = Math.abs(r.strike - spot);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  const start = Math.max(
    0,
    Math.min(bestIdx - Math.floor(windowSize / 2), Math.max(0, sorted.length - windowSize))
  );
  const end = Math.min(sorted.length, start + windowSize);
  return sorted.slice(start, end);
}

/** Default strike band vs spot for xOptions contract picker (±15%). */
export const STRIKE_SPOT_BAND_PCT = 0.15;

/**
 * Keep strikes within `spot * (1 ± bandPct)`. If that would be empty, returns `rows` unchanged.
 */
export function filterStrikesBySpotBand<T extends { strike: number }>(
  rows: T[],
  spot: number,
  bandPct: number = STRIKE_SPOT_BAND_PCT
): T[] {
  if (rows.length === 0 || !Number.isFinite(spot) || spot <= 0) {
    return rows;
  }
  const lo = spot * (1 - bandPct);
  const hi = spot * (1 + bandPct);
  const eps = 1e-6;
  const filtered = rows.filter((r) => r.strike >= lo - eps && r.strike <= hi + eps);
  return filtered.length > 0 ? filtered : rows;
}

/**
 * Closest strike to spot (ATM). Tie-break: lower strike when distances are equal.
 */
export function closestStrikeToSpot(strikes: number[], spot: number): number | null {
  const uniq = [...new Set(strikes)].filter((k) => Number.isFinite(k));
  if (uniq.length === 0 || !Number.isFinite(spot) || spot <= 0) {
    return null;
  }
  uniq.sort((a, b) => a - b);
  let best = uniq[0]!;
  let bestDist = Math.abs(best - spot);
  for (const k of uniq) {
    const d = Math.abs(k - spot);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && k < best)) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

/**
 * CSS class for chain row: ATM (nearest strike) gets `--atm`; ITM gets `--itm`; OTM unchanged.
 */
export function chainRowMoneynessClass(
  strike: number,
  spot: number,
  side: "call" | "put",
  atmStrike: number | null
): string {
  if (atmStrike != null && Math.abs(strike - atmStrike) < 1e-6) {
    return "xoptions-contract-row--atm";
  }
  const itm = side === "call" ? strike < spot : strike > spot;
  return itm ? "xoptions-contract-row--itm" : "";
}

/** Implied vol from chain API is already a percentage (e.g. 35.5 = 35.5%). */
export function formatImpliedVolatilityDisplay(iv: number | null | undefined): string {
  if (iv == null || !Number.isFinite(iv)) {
    return "—";
  }
  return `${iv.toFixed(2)}%`;
}
