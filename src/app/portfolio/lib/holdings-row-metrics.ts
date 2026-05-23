import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { heuristicIvPercentile } from "@/app/watchlist/ui/watchlist-metrics";
import { europeanOptionGreeks } from "@/lib/xoptions/xoptions-bs-greeks";
import { daysToExpirationUtc } from "@/lib/xoptions/xoptions-order-preview";
import { parseOccOptionSymbol, underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

const OPTION_MULTIPLIER = 100;
const RISK_FREE_RATE = 0.045;
const DEFAULT_OPTION_IV_DECIMAL = 0.35;

export function underlyingQuoteLookupKey(p: SerializablePosition): string | null {
  if (p.type === "stock" || p.type === "option") {
    return underlyingForYahooOptionsChain(p.symbol);
  }
  return null;
}

function normalizeOptionContractQuoteKey(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  if (!upper) {
    return null;
  }
  const withoutPrefix = upper.startsWith("O:") ? upper.slice(2) : upper;
  return parseOccOptionSymbol(withoutPrefix) ? withoutPrefix : null;
}

export function optionQuoteLookupKey(p: SerializablePosition): string | null {
  if (p.type !== "option") {
    return null;
  }
  const explicitYahooRef = normalizeOptionContractQuoteKey(p.yahooRef);
  if (explicitYahooRef) {
    return explicitYahooRef;
  }
  const occInSymbol = normalizeOptionContractQuoteKey(p.symbol);
  if (occInSymbol) {
    return occInSymbol;
  }
  const upperSymbol = p.symbol.trim().toUpperCase();
  const underlying = underlyingForYahooOptionsChain(upperSymbol).trim().toUpperCase();
  if (!underlying || !/^\d{4}-\d{2}-\d{2}$/.test(p.expiration) || !Number.isFinite(p.strike) || p.strike <= 0) {
    return null;
  }
  const expCompact = p.expiration.replaceAll("-", "").slice(2);
  const typeChar = p.optionType === "put" ? "P" : "C";
  const strikeCompact = String(Math.round(p.strike * 1000)).padStart(8, "0");
  return `${underlying}${expCompact}${typeChar}${strikeCompact}`;
}

export type HoldingsRowMetrics = {
  costBasisUsd: number;
  currentValueUsd: number;
  totalGainUsd: number | null;
  totalGainPct: number | null;
  dayGainUsd: number | null;
  dayGainPct: number | null;
  lastPrice: number | null;
  lastChange: number | null;
  lastChangePct: number | null;
  qty: number;
  avgCost: number | null;
  usesOptionBookMark: boolean;
};

/** Nearest-expiry chain highlight — same shape as watchlist `chainGlance`. */
export type HoldingsChainGlance = {
  contractType: "call" | "put";
  strike: number;
  impliedVolatilityPercent: number;
  openInterest: number;
  optionVolume: number;
  expirationDate: string | null;
};

export type HoldingsRowGreeks = {
  deltaNotionalUsd: number | null;
  gammaNotionalUsd: number | null;
  thetaDailyUsd: number | null;
  vegaPerIvPtUsd: number | null;
};

export function computeIvRankPercentFromChainGlance(
  glance: HoldingsChainGlance | null | undefined
): number | null {
  const iv = glance?.impliedVolatilityPercent;
  if (iv == null || !Number.isFinite(iv)) {
    return null;
  }
  return heuristicIvPercentile(iv);
}

export function ivRankBadgeToneClass(ivRank: number | null): string {
  if (ivRank == null) {
    return "";
  }
  if (ivRank >= 85) {
    return "portfolio-consolidated-holdings__iv-rank-badge--hot";
  }
  if (ivRank >= 70) {
    return "portfolio-consolidated-holdings__iv-rank-badge--elevated";
  }
  return "";
}

export function greekHeatClass(value: number | null, kind: "delta" | "theta"): string {
  if (value == null || !Number.isFinite(value)) {
    return "portfolio-consolidated-holdings__greek--neutral";
  }
  if (kind === "theta") {
    return value < 0
      ? "portfolio-consolidated-holdings__greek--neg"
      : "portfolio-consolidated-holdings__greek--pos";
  }
  return value < 0
    ? "portfolio-consolidated-holdings__greek--neg"
    : "portfolio-consolidated-holdings__greek--pos";
}

export function formatHoldingsGreekUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

function ivDecimalFromChainGlance(glance: HoldingsChainGlance | null | undefined): number {
  const ivPct = glance?.impliedVolatilityPercent;
  if (ivPct == null || !Number.isFinite(ivPct) || ivPct <= 0) {
    return DEFAULT_OPTION_IV_DECIMAL;
  }
  return Math.min(2.5, Math.max(0.05, ivPct / 100));
}

/** Per-row Greeks (Black–Scholes desk proxy; aligns with quant-trader exposure rollup). */
export function computeHoldingsRowGreeks(
  p: SerializablePosition,
  quotes: Record<string, SymbolLookupResult | null>,
  chainGlance: HoldingsChainGlance | null | undefined
): HoldingsRowGreeks {
  if (p.type === "cash" || p.type === "real_estate") {
    return {
      deltaNotionalUsd: null,
      gammaNotionalUsd: null,
      thetaDailyUsd: null,
      vegaPerIvPtUsd: null
    };
  }

  const underlyingKey = underlyingQuoteLookupKey(p);
  const spot = underlyingKey ? quotes[underlyingKey]?.price : null;
  if (spot == null || !Number.isFinite(spot) || spot <= 0) {
    return {
      deltaNotionalUsd: null,
      gammaNotionalUsd: null,
      thetaDailyUsd: null,
      vegaPerIvPtUsd: null
    };
  }

  if (p.type === "stock") {
    const deltaNotionalUsd = p.shares * spot;
    return {
      deltaNotionalUsd,
      gammaNotionalUsd: 0,
      thetaDailyUsd: 0,
      vegaPerIvPtUsd: 0
    };
  }

  if (!p.expiration || !Number.isFinite(p.strike) || p.strike <= 0) {
    return {
      deltaNotionalUsd: null,
      gammaNotionalUsd: null,
      thetaDailyUsd: null,
      vegaPerIvPtUsd: null
    };
  }

  const dte = daysToExpirationUtc(p.expiration);
  const T = Math.max(dte, 1) / 365;
  const greeks = europeanOptionGreeks({
    spot,
    strike: p.strike,
    T,
    sigma: ivDecimalFromChainGlance(chainGlance),
    riskFreeRate: RISK_FREE_RATE,
    side: p.optionType
  });
  if (!greeks) {
    return {
      deltaNotionalUsd: null,
      gammaNotionalUsd: null,
      thetaDailyUsd: null,
      vegaPerIvPtUsd: null
    };
  }

  const sign = p.contracts < 0 ? -1 : 1;
  const mult = OPTION_MULTIPLIER * Math.abs(p.contracts) * sign;
  return {
    deltaNotionalUsd: greeks.delta * spot * mult,
    gammaNotionalUsd: greeks.gamma * spot * mult,
    thetaDailyUsd: greeks.thetaPerDay * mult,
    vegaPerIvPtUsd: greeks.vegaPerOnePercentIv * mult
  };
}

export function rowCostBasisUsd(p: SerializablePosition): number {
  if (p.type === "real_estate") {
    return p.netEquityUsd;
  }
  if (p.type === "cash") {
    return Math.max(0, p.amount);
  }
  if (p.type === "stock") {
    return p.shares * p.purchasePrice;
  }
  return Math.abs(p.contracts) * 100 * p.premiumPerContract;
}

export function rowQuantity(p: SerializablePosition): number {
  if (p.type === "real_estate") {
    const pct = p.metadata?.ownershipPct;
    return typeof pct === "number" && Number.isFinite(pct) ? pct : 100;
  }
  if (p.type === "stock") {
    return p.shares;
  }
  if (p.type === "option") {
    return p.contracts;
  }
  return 1;
}

export function rowAverageCost(p: SerializablePosition): number | null {
  if (p.type === "real_estate") {
    return p.currentValueUsd;
  }
  if (p.type === "stock") {
    return p.purchasePrice;
  }
  if (p.type === "option") {
    return p.premiumPerContract;
  }
  if (p.type === "cash") {
    return p.amount;
  }
  return null;
}

/** Mark-to-model for one row (stocks/options use live quotes when available). */
export function rowMarkUsd(
  p: SerializablePosition,
  quotes: Record<string, SymbolLookupResult | null>
): { valueUsd: number; usesOptionBookMark: boolean } {
  if (p.type === "real_estate") {
    return { valueUsd: p.netEquityUsd, usesOptionBookMark: false };
  }
  if (p.type === "cash") {
    return { valueUsd: Math.max(0, p.amount), usesOptionBookMark: false };
  }
  if (p.type === "stock") {
    const u = underlyingQuoteLookupKey(p);
    const last = u ? quotes[u]?.price : null;
    if (last != null && Number.isFinite(last)) {
      return { valueUsd: p.shares * last, usesOptionBookMark: false };
    }
    return { valueUsd: p.shares * p.purchasePrice, usesOptionBookMark: false };
  }
  const optionQuote = quotes[optionQuoteLookupKey(p) ?? ""]?.price;
  if (optionQuote != null && Number.isFinite(optionQuote)) {
    return { valueUsd: p.contracts * 100 * optionQuote, usesOptionBookMark: false };
  }
  return {
    valueUsd: Math.abs(p.contracts) * 100 * p.premiumPerContract,
    usesOptionBookMark: true
  };
}

function quoteForPosition(
  p: SerializablePosition,
  quotes: Record<string, SymbolLookupResult | null>
): SymbolLookupResult | null {
  if (p.type === "cash" || p.type === "real_estate") {
    return null;
  }
  if (p.type === "stock") {
    const u = underlyingQuoteLookupKey(p);
    return u ? quotes[u] ?? null : null;
  }
  const key = optionQuoteLookupKey(p);
  return key ? quotes[key] ?? null : null;
}

function signedGainPct(gainUsd: number, costBasisUsd: number): number | null {
  if (!Number.isFinite(gainUsd) || !Number.isFinite(costBasisUsd) || costBasisUsd <= 0) {
    return null;
  }
  return (gainUsd / costBasisUsd) * 100;
}

export function computeHoldingsRowMetrics(
  p: SerializablePosition,
  quotes: Record<string, SymbolLookupResult | null>
): HoldingsRowMetrics {
  const costBasisUsd = rowCostBasisUsd(p);
  const { valueUsd, usesOptionBookMark } = rowMarkUsd(p, quotes);
  if (p.type === "real_estate") {
    return {
      costBasisUsd,
      currentValueUsd: valueUsd,
      totalGainUsd: null,
      totalGainPct: null,
      dayGainUsd: null,
      dayGainPct: null,
      lastPrice: null,
      lastChange: null,
      lastChangePct: null,
      qty: rowQuantity(p),
      avgCost: rowAverageCost(p),
      usesOptionBookMark: false
    };
  }
  const quote = quoteForPosition(p, quotes);
  const lastPrice = quote?.price != null && Number.isFinite(quote.price) ? quote.price : null;
  const lastChange = quote?.change != null && Number.isFinite(quote.change) ? quote.change : null;
  const lastChangePct =
    quote?.changePercent != null && Number.isFinite(quote.changePercent) ? quote.changePercent : null;

  let dayGainUsd: number | null = null;
  let dayGainPct: number | null = null;
  if (p.type === "stock" && lastChange != null) {
    dayGainUsd = p.shares * lastChange;
    dayGainPct = lastChangePct;
  } else if (p.type === "option" && lastChange != null) {
    dayGainUsd = p.contracts * 100 * lastChange;
    dayGainPct = lastChangePct;
  }

  const totalGainUsd = costBasisUsd > 0 ? valueUsd - costBasisUsd : null;
  const totalGainPct = totalGainUsd != null ? signedGainPct(totalGainUsd, costBasisUsd) : null;

  return {
    costBasisUsd,
    currentValueUsd: valueUsd,
    totalGainUsd,
    totalGainPct,
    dayGainUsd,
    dayGainPct,
    lastPrice,
    lastChange,
    lastChangePct,
    qty: rowQuantity(p),
    avgCost: rowAverageCost(p),
    usesOptionBookMark
  };
}
