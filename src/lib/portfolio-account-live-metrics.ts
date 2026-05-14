import type { ObjectId } from "mongodb";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    computeHoldingsRowMetrics,
    optionQuoteLookupKey,
    underlyingQuoteLookupKey
} from "@/app/portfolio/lib/holdings-row-metrics";
import type { Account } from "@/modules/core-admin/types";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";

export type PortfolioAccountLiveRollup = {
  marketValueUsd: number;
  /** Sum of row day P&L when Yahoo `change` is present; null when unavailable. */
  dayGainUsd: number | null;
  /** This account’s share of total portfolio market value (0–100). */
  pctOfPortfolio: number | null;
  /** Net stock shares (signed). */
  stockQty: number;
  /** Net option contracts (signed). */
  optionQty: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function collectQuoteKeysForSerializablePositions(positions: SerializablePosition[]): string[] {
  const keys = new Set<string>();
  for (const p of positions) {
    if (p.type === "stock") {
      const k = underlyingQuoteLookupKey(p);
      if (k) keys.add(k);
    } else if (p.type === "option") {
      const k = optionQuoteLookupKey(p);
      if (k) keys.add(k);
    }
  }
  return [...keys];
}

function quotesRecordFromMap(keys: string[], quoteMap: Map<string, SymbolLookupResult>): Record<string, SymbolLookupResult | null> {
  const out: Record<string, SymbolLookupResult | null> = {};
  for (const k of keys) {
    out[k] = quoteMap.get(k) ?? null;
  }
  return out;
}

type MetricsInputAccount = Pick<Account, "cashBalance"> & { _id?: ObjectId };

/**
 * Per-account market value, day P&L (when quotes carry `change`), portfolio %, and signed qty totals.
 * Uses the same mark / day rules as the Holdings table (`computeHoldingsRowMetrics`).
 */
export function aggregateAccountLiveFromQuotes(
  quotesRecord: Record<string, SymbolLookupResult | null>,
  positionsByAccount: Record<string, SerializablePosition[]>,
  accounts: MetricsInputAccount[],
  defaultCashBalance: number
): Record<string, PortfolioAccountLiveRollup> {
  const accountsWithId = accounts.filter((a): a is MetricsInputAccount & { _id: ObjectId } => Boolean(a._id));

  const perHex: Record<string, { mv: number; daySum: number; dayAny: boolean; stockQty: number; optionQty: number }> =
    {};

  for (const a of accountsWithId) {
    const hex = a._id.toHexString();
    const rows = positionsByAccount[hex] ?? [];
    const cashBal =
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance) ? a.cashBalance : defaultCashBalance;
    let mv = cashBal;
    let daySum = 0;
    let dayAny = false;
    let stockQty = 0;
    let optionQty = 0;

    for (const p of rows) {
      const m = computeHoldingsRowMetrics(p, quotesRecord);
      mv += m.currentValueUsd;
      if (p.type === "stock") {
        stockQty += p.shares;
      } else if (p.type === "option") {
        optionQty += p.contracts;
      }
      if (m.dayGainUsd != null) {
        daySum += m.dayGainUsd;
        dayAny = true;
      }
    }

    perHex[hex] = { mv, daySum, dayAny, stockQty, optionQty };
  }

  const totalMv = Object.values(perHex).reduce((s, r) => s + r.mv, 0);
  const totalForPct = totalMv > 0 ? totalMv : 0;

  const out: Record<string, PortfolioAccountLiveRollup> = {};
  for (const a of accountsWithId) {
    const hex = a._id.toHexString();
    const r = perHex[hex]!;
    const pct = totalForPct > 0 ? (r.mv / totalForPct) * 100 : null;
    const dayGainUsd = r.dayAny ? round2(r.daySum) : null;
    out[hex] = {
      marketValueUsd: round2(r.mv),
      dayGainUsd,
      pctOfPortfolio: pct != null ? round2(pct) : null,
      stockQty: r.stockQty,
      optionQty: r.optionQty
    };
  }

  return out;
}

export async function computePortfolioAccountLiveRollups(args: {
  positionsByAccount: Record<string, SerializablePosition[]>;
  accounts: Account[];
  defaultCashBalance: number;
}): Promise<Record<string, PortfolioAccountLiveRollup>> {
  const flat = Object.values(args.positionsByAccount).flat();
  const keys = collectQuoteKeysForSerializablePositions(flat);
  let quoteMap = new Map<string, SymbolLookupResult>();
  if (keys.length > 0) {
    try {
      quoteMap = await lookupSymbols(keys);
    } catch (err) {
      console.warn("[portfolio] account live rollup quote lookup failed", err);
      quoteMap = new Map();
    }
  }
  const quotesRecord = quotesRecordFromMap(keys, quoteMap);
  return aggregateAccountLiveFromQuotes(quotesRecord, args.positionsByAccount, args.accounts, args.defaultCashBalance);
}
