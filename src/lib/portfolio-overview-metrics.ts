import type { ObjectId } from "mongodb";

import type { Account, Position } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";

/**
 * US equity options: premium stored as avgCost is per underlying share; one contract = 100 shares.
 */
const OPTION_SHARES_PER_CONTRACT = 100;

export type AccountOverviewMetrics = {
  accountIdHex: string;
  name: string;
  isDefault: boolean;
  brokerType: string;
  extAccountId: string;
  cashBalance: number;
  /** cashBalance + stock and cash lot book (excludes option premium basis). */
  valueExcludingOptions: number;
  stockBook: number;
  cashLotBook: number;
  optionBookValue: number;
  optionLegCount: number;
  positionRowCount: number;
};

export type TopHoldingRow = {
  symbol: string;
  shares: number;
  bookValue: number;
};

export type AllocationAccountSlice = {
  accountIdHex: string;
  label: string;
  valueUsd: number;
  percent: number;
};

export type ClassAllocation = {
  stocksUsd: number;
  cashUsd: number;
  optionsUsd: number;
  totalUsd: number;
};

export type PortfolioOverviewMetrics = {
  /** Sum of account cash + stock + cash lots — headline “cost basis” without options. */
  headlineBookUsd: number;
  /** Full book including option cost basis estimate. */
  totalBookInclOptionsUsd: number;
  optionLegCount: number;
  optionBookValueUsd: number;
  byAccount: AccountOverviewMetrics[];
  topHoldings: TopHoldingRow[];
  allocationByAccount: AllocationAccountSlice[];
  classAllocation: ClassAllocation;
};

type MetricsInputAccount = Pick<
  Account,
  "name" | "type" | "extAccountId" | "cashBalance" | "isDefault"
> & { _id?: ObjectId };

function stockBookForPosition(p: Position): number {
  return p.qty * p.avgCost;
}

function optionBookForPosition(p: Position): number {
  return p.qty * OPTION_SHARES_PER_CONTRACT * p.avgCost;
}

/**
 * Computes book-style aggregates for the portfolio overview. Market quotes are not used.
 */
export function computePortfolioOverviewMetrics(
  positions: Position[],
  accounts: MetricsInputAccount[],
  defaultCashBalance: number,
  topHoldingsLimit = 6
): PortfolioOverviewMetrics {
  const accountsWithId = accounts.filter((a): a is MetricsInputAccount & { _id: ObjectId } => Boolean(a._id));

  const byAccountId = new Map<
    string,
    { stockBook: number; cashLotBook: number; optionBook: number; optionLegs: number; rows: number }
  >();

  const stockAggregates = new Map<string, { shares: number; bookValue: number }>();

  for (const p of positions) {
    const id = p.accountId.toHexString();
    const bucket =
      byAccountId.get(id) ??
      { stockBook: 0, cashLotBook: 0, optionBook: 0, optionLegs: 0, rows: 0 };
    bucket.rows += 1;
    const t = normalizePositionType(p.type);
    if (t === "stock") {
      const b = stockBookForPosition(p);
      bucket.stockBook += b;
      const sym = p.symbol.trim().toUpperCase() || "—";
      const agg = stockAggregates.get(sym) ?? { shares: 0, bookValue: 0 };
      agg.shares += p.qty;
      agg.bookValue += b;
      stockAggregates.set(sym, agg);
    } else if (t === "cash") {
      bucket.cashLotBook += stockBookForPosition(p);
    } else {
      bucket.optionBook += optionBookForPosition(p);
      bucket.optionLegs += 1;
    }
    byAccountId.set(id, bucket);
  }

  const byAccount: AccountOverviewMetrics[] = [];
  let headlineBookUsd = 0;
  let totalBookInclOptionsUsd = 0;
  let optionLegCount = 0;
  let optionBookValueUsd = 0;
  let classStocks = 0;
  let classCashBalances = 0;
  let classCashLots = 0;
  let classOptions = 0;

  for (const a of accountsWithId) {
    const hex = a._id.toHexString();
    const b = byAccountId.get(hex) ?? {
      stockBook: 0,
      cashLotBook: 0,
      optionBook: 0,
      optionLegs: 0,
      rows: 0
    };
    const cashBal =
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance) ? a.cashBalance : defaultCashBalance;
    const valueExcludingOptions = cashBal + b.stockBook + b.cashLotBook;
    const accountTotal = valueExcludingOptions + b.optionBook;
    headlineBookUsd += valueExcludingOptions;
    totalBookInclOptionsUsd += accountTotal;
    optionLegCount += b.optionLegs;
    optionBookValueUsd += b.optionBook;
    classStocks += b.stockBook;
    classCashBalances += cashBal;
    classCashLots += b.cashLotBook;
    classOptions += b.optionBook;

    byAccount.push({
      accountIdHex: hex,
      name: a.name ?? "Account",
      isDefault: Boolean(a.isDefault),
      brokerType: a.type,
      extAccountId: a.extAccountId ?? "",
      cashBalance: cashBal,
      valueExcludingOptions,
      stockBook: b.stockBook,
      cashLotBook: b.cashLotBook,
      optionBookValue: b.optionBook,
      optionLegCount: b.optionLegs,
      positionRowCount: b.rows
    });
  }

  const totalForPct = totalBookInclOptionsUsd > 0 ? totalBookInclOptionsUsd : 1;

  const allocationByAccount: AllocationAccountSlice[] = byAccount.map((row) => {
    const valueUsd = row.valueExcludingOptions + row.optionBookValue;
    return {
      accountIdHex: row.accountIdHex,
      label: row.name,
      valueUsd,
      percent: (valueUsd / totalForPct) * 100
    };
  });

  const cashUsd = classCashBalances + classCashLots;
  const classAllocation: ClassAllocation = {
    stocksUsd: classStocks,
    cashUsd,
    optionsUsd: classOptions,
    totalUsd: classStocks + cashUsd + classOptions
  };

  const topHoldings = [...stockAggregates.entries()]
    .map(([symbol, v]) => ({ symbol, shares: v.shares, bookValue: v.bookValue }))
    .sort((x, y) => y.bookValue - x.bookValue)
    .slice(0, topHoldingsLimit);

  return {
    headlineBookUsd,
    totalBookInclOptionsUsd,
    optionLegCount,
    optionBookValueUsd,
    byAccount,
    topHoldings,
    allocationByAccount,
    classAllocation
  };
}

export function formatUsdWhole(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

export function formatUsd2(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
