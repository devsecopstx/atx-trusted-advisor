import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount
} from "@/modules/core-admin/repository";
import { normalizePositionType, realEstateNetEquityUsd } from "@/modules/core-admin/types";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";

/**
 * Live market value for a portfolio (cash + equity marked to current last price).
 * Options are excluded for now (per requirements).
 * Falls back to book value for any symbol that cannot be quoted.
 */
export async function getPortfolioLiveMarketValueUsdForSessionUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
}): Promise<number> {
  const accounts = await listPortfolioAccounts({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });

  const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));

  const positions = await listPortfolioPositionsByAccount({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId,
    accountIds
  });

  // Collect cash (face value) + stock positions that need quoting
  let cashUsd = 0;
  const stockPositions: Array<{ symbol: string; qty: number; bookValue: number }> = [];
  const symbolsToQuote = new Set<string>();

  for (const acc of accounts) {
    const bal = typeof acc.cashBalance === "number" && Number.isFinite(acc.cashBalance)
      ? acc.cashBalance
      : DEFAULT_ACCOUNT_CASH_BALANCE;
    cashUsd += bal;
  }

  for (const p of positions) {
    const t = normalizePositionType(p.type);
    if (t === "cash") {
      // Cash lots are carried at face value
      cashUsd += p.qty * p.avgCost;
    } else if (t === "stock") {
      const sym = (p.symbol || "").trim().toUpperCase();
      if (sym) {
        stockPositions.push({
          symbol: sym,
          qty: p.qty,
          bookValue: p.qty * p.avgCost
        });
        symbolsToQuote.add(sym);
      }
    } else if (t === "real_estate") {
      const gross =
        typeof p.currentValueUsd === "number" && Number.isFinite(p.currentValueUsd)
          ? p.currentValueUsd
          : p.avgCost;
      cashUsd += realEstateNetEquityUsd({ currentValueUsd: gross, metadata: p.metadata });
    }
    // Options deliberately ignored for this market value calculation
  }

  if (symbolsToQuote.size === 0) {
    return cashUsd;
  }

  const quoteMap = await lookupSymbols(Array.from(symbolsToQuote), { allowNetwork: true });

  let equityMarketUsd = 0;

  for (const pos of stockPositions) {
    const q = quoteMap.get(pos.symbol);
    const last = typeof q?.price === "number" && Number.isFinite(q.price) && q.price > 0
      ? q.price
      : null;

    if (last !== null) {
      equityMarketUsd += pos.qty * last;
    } else {
      // Fallback to book for unquoted symbols
      equityMarketUsd += pos.bookValue;
    }
  }

  return cashUsd + equityMarketUsd;
}
