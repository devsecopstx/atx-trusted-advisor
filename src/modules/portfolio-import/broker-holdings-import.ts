/**
 * Broker holdings import: CSV → Mongo positions (stocks, options, sweep cash).
 * For **holdings** snapshots (Merrill, Fidelity Portfolio / legacy positions), the file replaces
 * account positions after a full clear.
 * For **Fidelity Accounts History**, activity rows are replayed **on top of** existing app holdings
 * (e.g. after a portfolio snapshot), then the merged result replaces the account — cash from
 * holdings is kept unless activities adjust modeled legs; sweep cash is not in the activity file.
 */

import { ObjectId } from "mongodb";

import {
    deletePositionsForPortfolioAccount,
    listPortfolioPositionsByAccount,
    PositionValidationError,
    upsertPositionForAccount
} from "@/modules/core-admin/repository";
import type { Position } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";

import {
    detectFidelityActivitiesCsv,
    emptyFidelityActivityReplaySeed,
    fidelityActivityReplaySeedFromBrokerPositions,
    parseFidelityActivitiesAccountsWithRows,
    replayFidelityActivityRows,
    type BrokerPositionSeedInput,
    type FidelityActivityRawRow
} from "./fidelity-activities-csv";
import {
    detectFidelityPortfolioHoldingsCsv,
    fidelityOptionExpiredOnOrBeforeAsOf,
    parseFidelityHoldingsCsv,
    parseFidelityPortfolioHoldingsCsv,
    type FidelityHoldingsPosition
} from "./fidelity-holdings-csv";
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
  /**
   * When set, import replays these Fidelity activity lines onto current DB positions, then writes
   * the merged snapshot (holdings-style imports omit this).
   */
  fidelityActivityRows?: FidelityActivityRawRow[];
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
    const structured = parseFidelityActivitiesAccountsWithRows(csv);
    if (structured.parseError && structured.accounts.length === 0) {
      return { accounts: [], parseError: structured.parseError };
    }
    if (structured.accounts.length === 0) {
      return {
        accounts: [],
        parseError: structured.parseError ?? "No accounts parsed from Fidelity Accounts History CSV."
      };
    }
    const emptySeed = emptyFidelityActivityReplaySeed();
    return {
      accounts: structured.accounts.map((a) => ({
        accountRef: a.accountRef,
        label: a.label,
        positions: replayFidelityActivityRows(a.rows, emptySeed),
        fidelityActivityRows: a.rows
      }))
    };
  }

  if (detectFidelityPortfolioHoldingsCsv(csv)) {
    const pf = parseFidelityPortfolioHoldingsCsv(csv);
    if (pf.parseError && pf.accounts.length === 0) {
      return { accounts: [], parseError: pf.parseError };
    }
    if (pf.accounts.length === 0) {
      return {
        accounts: [],
        parseError: pf.parseError ?? "No accounts parsed from Fidelity Portfolio positions CSV."
      };
    }
    return {
      accounts: pf.accounts.map((a) => ({
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
        "This Fidelity file is not recognized. Use Portfolio positions (Account Number + Symbol), Accounts History (Run Date + Account Number), or legacy Positions export with Symbol as the first column (requires default account ref)."
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
    const cashSyms = acc.positions
      .filter((p): p is BrokerHoldingsPosition & { type: "cash" } => p.type === "cash")
      .map((p) => p.ticker);
    const sampleTickers = [...new Set([...stocks.map((p) => p.ticker), ...optU, ...cashSyms].filter(Boolean))].slice(
      0,
      8
    );
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

/** USD balance for a parsed cash row (sweep / money market / `cash (...)`). */
function dbPositionToBrokerSeedInput(p: Position): BrokerPositionSeedInput | null {
  const t = normalizePositionType(p.type);
  const symbol = (p.symbol ?? "").trim();
  const qty = Number(p.qty);
  const avgCost = Number(p.avgCost);
  if (t === "cash") {
    if (!Number.isFinite(avgCost) || avgCost < 0) {
      return null;
    }
    return {
      type: "cash",
      symbol: symbol || "CASH",
      qty: Number.isFinite(qty) ? qty : 1,
      avgCost
    };
  }
  if (t === "stock") {
    if (!symbol || !Number.isFinite(qty) || qty <= 0) {
      return null;
    }
    return {
      type: "stock",
      symbol,
      qty,
      avgCost: Number.isFinite(avgCost) && avgCost >= 0 ? avgCost : 0
    };
  }
  if (!symbol || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }
  return {
    type: "option",
    symbol,
    qty,
    avgCost: Number.isFinite(avgCost) && avgCost >= 0 ? avgCost : 0,
    optionType: p.optionType ?? null,
    strike: p.strike ?? null,
    expiration: p.expiration ?? null
  };
}

function brokerCashUsd(p: BrokerHoldingsPosition & { type: "cash" }): number | null {
  const price = p.purchasePrice != null && Number.isFinite(p.purchasePrice) ? Math.max(0, p.purchasePrice) : null;
  const sh = p.shares != null && Number.isFinite(p.shares) ? Math.abs(p.shares) : null;
  if (price != null && price > 0 && sh != null && sh > 0) {
    return price * sh;
  }
  if (price != null && price > 0) {
    return price;
  }
  if (sh != null && sh > 0) {
    return sh;
  }
  return null;
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

    if (!accountId) {
      results.push({
        accountRef: acc.accountRef,
        label,
        imported: 0,
        skippedNonStock: acc.positions.length,
        deletedPrior: 0,
        error: "No app account selected for this broker account key"
      });
      continue;
    }

    let positionsForApply = acc.positions;
    if (acc.fidelityActivityRows !== undefined) {
      let existingBeforeClear: Position[] = [];
      try {
        existingBeforeClear = await listPortfolioPositionsByAccount({
          userId: input.userId,
          portfolioId: input.portfolioId,
          tenantId: input.tenantId,
          accountIds: [new ObjectId(accountId)]
        });
      } catch {
        results.push({
          accountRef: acc.accountRef,
          label,
          imported: 0,
          skippedNonStock: acc.positions.length,
          deletedPrior: 0,
          error: "Failed to load existing positions for activity merge"
        });
        continue;
      }
      const seedInputs = existingBeforeClear
        .map(dbPositionToBrokerSeedInput)
        .filter((x): x is BrokerPositionSeedInput => x != null);
      const seed = fidelityActivityReplaySeedFromBrokerPositions(seedInputs);
      positionsForApply = replayFidelityActivityRows(acc.fidelityActivityRows, seed);
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
        skippedNonStock: acc.positions.length,
        deletedPrior: 0,
        error: "Failed to clear existing positions"
      });
      continue;
    }

    const lots = aggregateStockLots(positionsForApply);
    let imported = 0;
    let skippedNonStock = 0;
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

      const optionRows = positionsForApply.filter(
        (p): p is BrokerHoldingsPosition & { type: "option" } => p.type === "option"
      );
      for (const op of optionRows) {
        if (op.expiration && fidelityOptionExpiredOnOrBeforeAsOf(op.expiration, new Date())) {
          skippedNonStock += 1;
          continue;
        }
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

      const cashRowsApply = positionsForApply.filter(
        (p): p is BrokerHoldingsPosition & { type: "cash" } => p.type === "cash"
      );
      for (const c of cashRowsApply) {
        const usd = brokerCashUsd(c);
        if (usd == null || usd <= 0) {
          skippedNonStock += 1;
          continue;
        }
        const sym = (c.ticker || "CASH").trim().toUpperCase().slice(0, 32) || "CASH";
        await upsertPositionForAccount({
          userId: input.userId,
          tenantId: input.tenantId,
          portfolioId: input.portfolioId,
          accountId,
          symbol: sym,
          qty: 1,
          avgCost: usd,
          type: "cash"
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
