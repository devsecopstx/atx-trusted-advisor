import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import type { Position, Watchlist } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";
import { scannerCircuitAllow } from "@/modules/scanner/scanner-circuit-breaker";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

const POSITION_COLLECTION = "portfolio_positions";
const WATCHLIST_COLLECTION = "portfolio_watchlists";
const ACCOUNT_COLLECTION = "portfolio_accounts";

export function tenantScopeFilter(tenantId?: ObjectId): Record<string, unknown> {
  return tenantId ? { tenantId } : {};
}

/** Same rules as price scanner tickers — equities for corporate/risk/tax jobs. */
export function normalizeScannerSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim().toUpperCase();
  if (!s || s === "USD" || s === "CASH") {
    return null;
  }
  if (!/^[A-Z][A-Z0-9.\-]{0,10}$/.test(s)) {
    return null;
  }
  return s;
}

function isOccOptionSymbol(sym: string): boolean {
  return /^[A-Z]{1,5}\d{6}[CP]\d{8}$/.test(sym);
}

export async function loadEquitySymbolsForTenant(tenantId?: ObjectId, maxSymbols = 120): Promise<string[]> {
  const scope = tenantScopeFilter(tenantId);
  const db = await getDb();
  const [positions, watchlists] = await Promise.all([
    db
      .collection<Position>(POSITION_COLLECTION)
      .find(scope, { projection: { symbol: 1, type: 1 } })
      .limit(400)
      .toArray(),
    db
      .collection<Watchlist>(WATCHLIST_COLLECTION)
      .find(scope, { projection: { symbols: 1 } })
      .limit(120)
      .toArray()
  ]);

  const out = new Set<string>();
  for (const p of positions) {
    if (normalizePositionType(p.type) === "option") {
      continue;
    }
    const sym = normalizeScannerSymbol(p.symbol);
    if (sym && !isOccOptionSymbol(sym)) {
      out.add(sym);
    }
  }
  for (const wl of watchlists) {
    for (const e of wl.symbols ?? []) {
      const sym = normalizeScannerSymbol(e?.symbol);
      if (sym && !isOccOptionSymbol(sym)) {
        out.add(sym);
      }
    }
  }
  return Array.from(out).sort().slice(0, maxSymbols);
}

export async function loadStockPositionsWithQty(tenantId?: ObjectId): Promise<
  Array<{ symbol: string; qty: number; avgCost: number }>
> {
  const scope = tenantScopeFilter(tenantId);
  const db = await getDb();
  const rows = await db
    .collection<Position>(POSITION_COLLECTION)
    .find(scope, { projection: { symbol: 1, qty: 1, avgCost: 1, type: 1 } })
    .limit(400)
    .toArray();

  const out: Array<{ symbol: string; qty: number; avgCost: number }> = [];
  for (const p of rows) {
    if (normalizePositionType(p.type) !== "stock") {
      continue;
    }
    const sym = normalizeScannerSymbol(p.symbol);
    if (!sym) {
      continue;
    }
    out.push({
      symbol: sym,
      qty: typeof p.qty === "number" && Number.isFinite(p.qty) ? p.qty : 0,
      avgCost: typeof p.avgCost === "number" && Number.isFinite(p.avgCost) ? p.avgCost : 0
    });
  }
  return out;
}

export type QuoteMap = Map<string, number>;

export async function quotesForSymbolsWithCircuit(
  tenantId: ObjectId | undefined,
  symbols: string[]
): Promise<{ quoteBySymbol: QuoteMap; circuitOpen: boolean }> {
  const gate = await scannerCircuitAllow(tenantId, "yahoo");
  if (!gate.allowed) {
    return { quoteBySymbol: new Map(), circuitOpen: true };
  }
  if (symbols.length === 0) {
    return { quoteBySymbol: new Map(), circuitOpen: false };
  }
  const quotes = await getYahooBatchQuotes(symbols);
  const quoteBySymbol: QuoteMap = new Map();
  for (const q of quotes) {
    const sym = normalizeScannerSymbol(q.symbol);
    if (sym && typeof q.price === "number" && Number.isFinite(q.price)) {
      quoteBySymbol.set(sym, q.price);
    }
  }
  return { quoteBySymbol, circuitOpen: false };
}

/** Raw Yahoo quote batch — includes `earningsTimestamp` when present. */
export async function fetchRawYahooQuotesWithCircuit(
  tenantId: ObjectId | undefined,
  symbols: string[]
): Promise<{ rows: Record<string, unknown>[]; circuitOpen: boolean }> {
  const gate = await scannerCircuitAllow(tenantId, "yahoo");
  if (!gate.allowed) {
    return { rows: [], circuitOpen: true };
  }
  if (symbols.length === 0) {
    return { rows: [], circuitOpen: false };
  }
  const yf = getYahooFinance2();
  try {
    const raw = await yahooQuoteWithValidationFallback(yf, symbols, "phase3 batch quote");
    const rows: Record<string, unknown>[] = [];
    if (Array.isArray(raw)) {
      for (const r of raw) {
        if (r && typeof r === "object") {
          rows.push(r as Record<string, unknown>);
        }
      }
    } else if (raw && typeof raw === "object") {
      rows.push(raw as Record<string, unknown>);
    }
    return { rows, circuitOpen: false };
  } catch {
    return { rows: [], circuitOpen: false };
  }
}

export async function countTenantPortfolios(tenantId?: ObjectId): Promise<{
  portfolioCount: number;
  accountCount: number;
}> {
  const scope = tenantScopeFilter(tenantId);
  const db = await getDb();
  const [portfolioCount, accountCount] = await Promise.all([
    db.collection(TENANT_PORTFOLIO_COLLECTION).countDocuments(scope),
    db.collection(ACCOUNT_COLLECTION).countDocuments(scope)
  ]);
  return { portfolioCount, accountCount };
}
