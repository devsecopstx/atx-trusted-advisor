/**
 * Broker holdings import: CSV → Mongo stock lots (symbol, qty, avgCost).
 * For each mapped account, the **file is the source of truth**: existing positions are cleared,
 * then stock and option legs from the CSV are upserted (symbols absent from the file are removed).
 * Cash lots are skipped. Option legs need expiration, strike, and call/put; incomplete rows are skipped.
 */

import {
    deletePositionsForPortfolioAccount,
    PositionValidationError,
    upsertPositionForAccount
} from "@/modules/core-admin/repository";

import { detectFidelityActivitiesCsv, parseFidelityActivitiesAccounts } from "./fidelity-activities-csv";
import { parseFidelityHoldingsCsv, type FidelityHoldingsPosition } from "./fidelity-holdings-csv";
import { parseMerrillHoldingsCsv, type MerrillHoldingsPosition } from "./merrill-holdings-csv";

function expirationUtcNoonFromYmd(ymd: string): Date | null {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const d = parseInt(m[3]!, 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

export type BrokerHoldingsPosition = MerrillHoldingsPosition | FidelityHoldingsPosition;

export type ParsedBrokerAccount = {
  accountRef: string;
  label: string;
  positions: BrokerHoldingsPosition[];
};

export type BrokerImportPreviewAccount = {
  accountRef: string;
  label: string;
  positionCount: number;
  stockCount: number;
  optionCount: number;
  cashCount: number;
  sampleTickers: string[];
};

export type BrokerImportApplyResult = {
  accountRef: string;
  label: string;
  imported: number;
  skippedNonStock: number;
  deletedPrior: number;
  error?: string;
};

function countByType(positions: BrokerHoldingsPosition[]) {
  let stockCount = 0;
  let optionCount = 0;
  let cashCount = 0;
  for (const p of positions) {
    if (p.type === "stock") stockCount += 1;
    else if (p.type === "option") optionCount += 1;
    else cashCount += 1;
  }
  return { stockCount, optionCount, cashCount };
}

export function parseBrokerHoldingsAccounts(
  broker: "merrill" | "fidelity",
  csv: string,
  fidelityHoldingsDefaultAccountRef: string
): { accounts: ParsedBrokerAccount[]; parseError?: string } {
  if (broker === "merrill") {
    const result = parseMerrillHoldingsCsv(csv);
    if (result.accounts.length === 0 && result.parseError) {
      return { accounts: [], parseError: result.parseError };
    }
    if (result.accounts.length === 0) {
      return { accounts: [], parseError: "No accounts parsed from Merrill Holdings CSV." };
    }
    return {
      accounts: result.accounts.map((a) => ({
        accountRef: a.accountRef,
        label: a.label,
        positions: a.positions
      }))
    };
  }

  if (detectFidelityActivitiesCsv(csv)) {
    const act = parseFidelityActivitiesAccounts(csv);
    if (act.parseError && act.accounts.length === 0) {
      return { accounts: [], parseError: act.parseError };
    }
    if (act.accounts.length === 0) {
      return {
        accounts: [],
        parseError: act.parseError ?? "No accounts parsed from Fidelity Accounts History CSV."
      };
    }
    return {
      accounts: act.accounts.map((a) => ({
        accountRef: a.accountRef,
        label: a.label,
        positions: a.positions
      }))
    };
  }

  const ref = fidelityHoldingsDefaultAccountRef.trim();
  if (!ref) {
    return {
      accounts: [],
      parseError:
        "Fidelity Positions export needs a default account ref (ext ref). For Accounts History, use a file with Run Date + Account Number columns — no default ref required."
    };
  }
  const result = parseFidelityHoldingsCsv(csv, ref);
  if (result.parseError && result.positions.length === 0) {
    return { accounts: [], parseError: result.parseError };
  }
  return {
    accounts: [
      {
        accountRef: result.accountRef || ref,
        label: result.label,
        positions: result.positions
      }
    ]
  };
}

export function previewBrokerHoldingsAccounts(accounts: ParsedBrokerAccount[]): BrokerImportPreviewAccount[] {
  return accounts.map((acc) => {
    const { stockCount, optionCount, cashCount } = countByType(acc.positions);
    const stocks = acc.positions.filter((p): p is BrokerHoldingsPosition & { type: "stock" } => p.type === "stock");
    const optU = acc.positions
      .filter((p): p is BrokerHoldingsPosition & { type: "option" } => p.type === "option")
      .map((p) => p.ticker);
    const sampleTickers = [...new Set([...stocks.map((p) => p.ticker), ...optU].filter(Boolean))].slice(0, 8);
    return {
      accountRef: acc.accountRef,
      label: acc.label,
      positionCount: acc.positions.length,
      stockCount,
      optionCount,
      cashCount,
      sampleTickers
    };
  });
}

type StockLot = { ticker: string; qty: number; avgCost: number };

function aggregateStockLots(positions: BrokerHoldingsPosition[]): StockLot[] {
  const map = new Map<string, { qty: number; costBasis: number }>();
  for (const p of positions) {
    if (p.type !== "stock") continue;
    const ticker = (p.ticker ?? "").trim().toUpperCase();
    if (!ticker) continue;
    const qty = Number(p.shares ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const price = p.purchasePrice != null && Number.isFinite(p.purchasePrice) ? Math.max(0, p.purchasePrice) : 0;
    const prev = map.get(ticker);
    if (!prev) {
      map.set(ticker, { qty, costBasis: qty * price });
    } else {
      const nextQty = prev.qty + qty;
      const nextCost = prev.costBasis + qty * price;
      map.set(ticker, { qty: nextQty, costBasis: nextCost });
    }
  }
  return [...map.entries()].map(([ticker, { qty, costBasis }]) => ({
    ticker,
    qty,
    avgCost: qty > 0 ? costBasis / qty : 0
  }));
}

export async function applyBrokerHoldingsToMappedAccounts(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
  parsedAccounts: ParsedBrokerAccount[];
  mappings: Record<string, string>;
}): Promise<BrokerImportApplyResult[]> {
  const results: BrokerImportApplyResult[] = [];

  for (const acc of input.parsedAccounts) {
    const key = acc.accountRef || acc.label || "default";
    const accountId = input.mappings[key]?.trim();
    const label = acc.label || acc.accountRef || key;

    const cashOnlySkipped = acc.positions.filter((p) => p.type === "cash").length;

    if (!accountId) {
      results.push({
        accountRef: acc.accountRef,
        label,
        imported: 0,
        skippedNonStock: cashOnlySkipped,
        deletedPrior: 0,
        error: "No app account selected for this broker account key"
      });
      continue;
    }

    let deletedPrior = 0;
    try {
      deletedPrior = await deletePositionsForPortfolioAccount({
        userId: input.userId,
        tenantId: input.tenantId,
        portfolioId: input.portfolioId,
        accountId
      });
    } catch {
      results.push({
        accountRef: acc.accountRef,
        label,
        imported: 0,
        skippedNonStock: cashOnlySkipped,
        deletedPrior: 0,
        error: "Failed to clear existing positions"
      });
      continue;
    }

    const lots = aggregateStockLots(acc.positions);
    let imported = 0;
    let skippedNonStock = cashOnlySkipped;
    try {
      for (const lot of lots) {
        await upsertPositionForAccount({
          userId: input.userId,
          tenantId: input.tenantId,
          portfolioId: input.portfolioId,
          accountId,
          symbol: lot.ticker,
          qty: lot.qty,
          avgCost: lot.avgCost,
          type: "stock"
        });
        imported += 1;
      }

      const optionRows = acc.positions.filter(
        (p): p is BrokerHoldingsPosition & { type: "option" } => p.type === "option"
      );
      for (const op of optionRows) {
        const exp = op.expiration ? expirationUtcNoonFromYmd(op.expiration) : null;
        const strike = op.strike;
        const ot = op.optionType;
        if (!exp || strike == null || !Number.isFinite(strike) || strike <= 0 || (ot !== "call" && ot !== "put")) {
          skippedNonStock += 1;
          continue;
        }
        const contracts = Math.round(Number(op.contracts ?? 0));
        if (!Number.isFinite(contracts) || contracts <= 0) {
          skippedNonStock += 1;
          continue;
        }
        const prem = op.premium != null && Number.isFinite(op.premium) ? Math.max(0, op.premium) : 0;
        await upsertPositionForAccount({
          userId: input.userId,
          tenantId: input.tenantId,
          portfolioId: input.portfolioId,
          accountId,
          symbol: op.ticker.trim().toUpperCase(),
          qty: contracts,
          avgCost: prem,
          type: "option",
          optionType: ot,
          strike,
          expiration: exp
        });
        imported += 1;
      }
    } catch (err) {
      const msg = err instanceof PositionValidationError ? err.message : "Upsert failed";
      results.push({
        accountRef: acc.accountRef,
        label,
        imported,
        skippedNonStock,
        deletedPrior,
        error: msg
      });
      continue;
    }

    results.push({
      accountRef: acc.accountRef,
      label,
      imported,
      skippedNonStock,
      deletedPrior
    });
  }

  return results;
}
