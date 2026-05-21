import type { Account, Position } from "@/modules/core-admin/types";
import { normalizePositionType, realEstateNetEquityUsd } from "@/modules/core-admin/types";
import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

const OPTION_SHARES_PER_CONTRACT = 100;

function stockBookUsd(p: Position): number {
  return p.qty * p.avgCost;
}

function optionBookUsd(p: Position): number {
  return p.qty * OPTION_SHARES_PER_CONTRACT * p.avgCost;
}

/**
 * Portfolio-level market value: sum of account cash + quoted stock MV (Yahoo batch, same as find-options top holdings)
 * with per-symbol book fallback when price is missing, plus cash-lot and option book estimates.
 */
export async function computePortfolioTotalMarketValueUsd(
  accounts: Account[],
  positions: Position[],
  defaultCashBalance: number
): Promise<number> {
  let total = 0;

  for (const a of accounts) {
    const cash =
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance) ? a.cashBalance : defaultCashBalance;
    total += cash;
  }

  const stockBySymbol = new Map<string, { shares: number; costBasis: number }>();

  for (const p of positions) {
    const t = normalizePositionType(p.type);
    if (t === "stock") {
      const sym = p.symbol.trim().toUpperCase();
      if (!sym) {
        continue;
      }
      const agg = stockBySymbol.get(sym) ?? { shares: 0, costBasis: 0 };
      agg.shares += p.qty;
      agg.costBasis += stockBookUsd(p);
      stockBySymbol.set(sym, agg);
    } else if (t === "cash") {
      total += stockBookUsd(p);
    } else if (t === "real_estate") {
      const gross =
        typeof p.currentValueUsd === "number" && Number.isFinite(p.currentValueUsd)
          ? p.currentValueUsd
          : p.avgCost;
      total += realEstateNetEquityUsd({ currentValueUsd: gross, metadata: p.metadata });
    } else {
      total += optionBookUsd(p);
    }
  }

  const symbols = Array.from(stockBySymbol.keys());
  let quoteMap = new Map<string, SymbolLookupResult>();
  if (symbols.length > 0) {
    try {
      quoteMap = await lookupSymbols(symbols);
    } catch {
      quoteMap = new Map();
    }
  }

  for (const sym of symbols) {
    const agg = stockBySymbol.get(sym)!;
    const q = quoteMap.get(sym);
    const lastPrice = typeof q?.price === "number" && Number.isFinite(q.price) ? q.price : null;
    const perShareBook = agg.shares !== 0 ? agg.costBasis / agg.shares : 0;
    const mv =
      lastPrice != null && lastPrice > 0 ? agg.shares * lastPrice : agg.shares * perShareBook;
    total += mv;
  }

  return Math.round(total * 100) / 100;
}
