import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { parseOccOptionSymbol, underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

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

export function rowCostBasisUsd(p: SerializablePosition): number {
  if (p.type === "cash") {
    return Math.max(0, p.amount);
  }
  if (p.type === "stock") {
    return p.shares * p.purchasePrice;
  }
  return Math.abs(p.contracts) * 100 * p.premiumPerContract;
}

export function rowQuantity(p: SerializablePosition): number {
  if (p.type === "stock") {
    return p.shares;
  }
  if (p.type === "option") {
    return p.contracts;
  }
  return 1;
}

export function rowAverageCost(p: SerializablePosition): number | null {
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
  if (p.type === "cash") {
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
