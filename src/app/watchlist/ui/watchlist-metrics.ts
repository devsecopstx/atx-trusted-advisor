import { getSymbolSectorLabel } from "@/modules/watchlist/symbol-sector";

/** Heuristic IV percentile for badge display (not a market data percentile). */
export function heuristicIvPercentile(iv: number): number {
  if (!Number.isFinite(iv)) {
    return 50;
  }
  if (iv < 25) {
    return 18;
  }
  if (iv < 45) {
    return 38;
  }
  if (iv < 65) {
    return 58;
  }
  if (iv < 85) {
    return 74;
  }
  if (iv < 110) {
    return 88;
  }
  if (iv < 140) {
    return 94;
  }
  return 99;
}

export type WatchlistMetricRow = {
  symbol: string;
  targetEntryNotional: number | null;
  ivPercent: number | null;
};

export type WatchlistExecutiveMetrics = {
  legCount: number;
  weightedAvgIv: number | null;
  concentrationSummary: string;
  concentrationTopPct: number;
  capitalAtRiskDisplay: string;
  capitalAtRiskSum: number;
  highIvAllOver150: boolean;
  hasIvData: boolean;
};

export function computeExecutiveMetrics(rows: WatchlistMetricRow[]): WatchlistExecutiveMetrics {
  const legCount = rows.length;
  let ivSum = 0;
  let ivW = 0;
  let capitalSum = 0;
  let hasIv = false;
  let allOver150 = legCount > 0;

  const sectorWeight = new Map<string, number>();

  for (const r of rows) {
    if (r.targetEntryNotional != null && Number.isFinite(r.targetEntryNotional)) {
      capitalSum += r.targetEntryNotional;
      const sec = getSymbolSectorLabel(r.symbol);
      sectorWeight.set(sec, (sectorWeight.get(sec) ?? 0) + r.targetEntryNotional);
    }
    if (r.ivPercent != null && Number.isFinite(r.ivPercent)) {
      hasIv = true;
      const notion = r.targetEntryNotional;
      const w =
        notion != null && Number.isFinite(notion) && notion > 0 ? Math.max(1, notion / 1000) : 1;
      ivSum += r.ivPercent * w;
      ivW += w;
      if (r.ivPercent <= 150) {
        allOver150 = false;
      }
    } else {
      allOver150 = false;
    }
  }

  const weightedAvgIv = ivW > 0 ? ivSum / ivW : null;

  let concentrationTopPct = 0;
  let topLabel = "";
  if (capitalSum > 0 && sectorWeight.size > 0) {
    let best = 0;
    for (const [label, v] of sectorWeight) {
      const pct = (v / capitalSum) * 100;
      if (pct > best) {
        best = pct;
        topLabel = label;
      }
    }
    concentrationTopPct = best;
  }

  const hasTsla = rows.some((r) => r.symbol.trim().toUpperCase() === "TSLA");
  const concentrationSummary =
    capitalSum > 0 && topLabel
      ? `${concentrationTopPct.toFixed(0)}% ${topLabel}${hasTsla ? " · incl. TSLA" : ""}`
      : "—";

  return {
    legCount,
    weightedAvgIv,
    concentrationSummary,
    concentrationTopPct,
    capitalAtRiskDisplay:
      capitalSum > 0
        ? capitalSum.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        : "—",
    capitalAtRiskSum: capitalSum,
    highIvAllOver150: hasIv && allOver150 && legCount > 0,
    hasIvData: hasIv
  };
}

export function formatPortfolioRiskPct(targetNotional: number | null, portfolioTotal: number): string {
  if (
    targetNotional == null ||
    !Number.isFinite(targetNotional) ||
    !Number.isFinite(portfolioTotal) ||
    portfolioTotal <= 0
  ) {
    return "—";
  }
  return `${((targetNotional / portfolioTotal) * 100).toFixed(1)}%`;
}

/** Numeric % book for desk coloring (same guards as `formatPortfolioRiskPct`). */
export function targetEntryRiskPctNumeric(targetNotional: number | null, portfolioTotal: number): number | null {
  if (
    targetNotional == null ||
    !Number.isFinite(targetNotional) ||
    !Number.isFinite(portfolioTotal) ||
    portfolioTotal <= 0
  ) {
    return null;
  }
  return (targetNotional / portfolioTotal) * 100;
}

/** CSS classes for compact watchlist % book risk (`watchlist.css`). */
export function targetEntryRiskPctToneClass(pct: number | null): string {
  if (pct == null) {
    return "";
  }
  if (pct >= 8) {
    return "xf-watchlist-risk-pct--high";
  }
  if (pct >= 4) {
    return "xf-watchlist-risk-pct--mid";
  }
  return "xf-watchlist-risk-pct--low";
}

export type WatchlistLegAccentInput = {
  lineType?: string;
  chainGlance?: { contractType?: "call" | "put" } | null;
};

/** Mobile card left border: put / call / equity (`watchlist.css`). */
export function watchlistMobileLegAccentClass(row: WatchlistLegAccentInput): string {
  const lt = (row.lineType ?? "").toLowerCase();
  if (lt.includes("put")) {
    return "xf-watchlist-mobile-card--put";
  }
  if (lt.includes("call")) {
    return "xf-watchlist-mobile-card--call";
  }
  const cg = row.chainGlance?.contractType;
  if (cg === "put") {
    return "xf-watchlist-mobile-card--put";
  }
  if (cg === "call") {
    return "xf-watchlist-mobile-card--call";
  }
  return "xf-watchlist-mobile-card--equity";
}

export type WatchlistRsiToneInput = {
  technicals?: { rsi14?: number | null } | null;
};

export function watchlistRsiToneClass(row: WatchlistRsiToneInput): string {
  const rsi = row.technicals?.rsi14;
  if (rsi == null || !Number.isFinite(rsi)) {
    return "";
  }
  if (rsi < 30) {
    return "xf-watchlist-rsi--oversold";
  }
  if (rsi > 70) {
    return "xf-watchlist-rsi--overbought";
  }
  return "";
}

export type WatchlistDayPctToneInput = {
  quote?: { changePercent?: number } | null;
};

/** Underlying session % change (Yahoo `regularMarketChangePercent`); e.g. +1.25 = +1.25%. */
export function formatWatchlistDayChangePercent(changePercent: number | null | undefined): string {
  if (changePercent == null || !Number.isFinite(changePercent)) {
    return "—";
  }
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(2)}%`;
}

/** Tone classes for desk / mobile (`watchlist.css`). */
export function watchlistDayPctToneClass(row: WatchlistDayPctToneInput): string {
  const p = row.quote?.changePercent;
  if (p == null || !Number.isFinite(p)) {
    return "";
  }
  if (p > 0) {
    return "xf-watchlist-day-pct--up";
  }
  if (p < 0) {
    return "xf-watchlist-day-pct--down";
  }
  return "xf-watchlist-day-pct--flat";
}
