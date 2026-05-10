/**
 * Fidelity "Accounts History" / activity CSV: Run Date, Account Number, Symbol, Quantity, …
 * Groups rows by Account Number, skips disclaimer/footer lines, replays chronologically into
 * net stock lots and net option legs (**signed** contract counts: positive = long, negative = short).
 *
 * **Apply / import:** activity rows are replayed **on top of existing app holdings** (portfolio
 * snapshot baseline). Preview still shows net positions from the file alone (no DB merge).
 */

import {
    parseCsvLine,
    parseFidelityOptionSymbol,
    parseNum,
    type FidelityHoldingsPosition
} from "@/modules/portfolio-import/fidelity-holdings-csv";

export type FidelityActivitiesAccount = {
  accountRef: string;
  label: string;
  positions: FidelityHoldingsPosition[];
};

/** One parsed activity line after the CSV header (chronological replay unit). */
export type FidelityActivityRawRow = {
  sortKey: number;
  lineIndex: number;
  runIsoYmd: string;
  accountNumber: string;
  accountName: string;
  action: string;
  symbol: string;
  price: number | null;
  quantity: number | null;
};

export type FidelityActivityOptMeta = {
  underlying: string;
  expiration: string;
  optionType: "call" | "put";
  strike: number;
};

/** Mutable replay state: clone before mutating when replaying CSV rows. */
export type FidelityActivityReplaySeed = {
  stockState: Map<string, { shares: number; cost: number }>;
  optNet: Map<string, number>;
  optPremNum: Map<string, number>;
  optPremDen: Map<string, number>;
  optMeta: Map<string, FidelityActivityOptMeta>;
  /** Cash bucket symbol → USD balance (sweep / imported cash positions). */
  cashBalances: Map<string, number>;
};

/** Minimal position shape to seed replay from Mongo `Position` docs (via mapper). */
export type BrokerPositionSeedInput = {
  type: "stock" | "option" | "cash";
  symbol: string;
  qty: number;
  avgCost: number;
  optionType?: "call" | "put" | null;
  strike?: number | null;
  expiration?: Date | null;
};

const RUN_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function isPlainEquityTicker(sym: string): boolean {
  const s = sym.trim().toUpperCase();
  return /^[A-Z]{1,5}$/.test(s);
}

function parseUsDateMmDdYyyy(s: string): number {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    return 0;
  }
  const mo = parseInt(m[1]!, 10);
  const d = parseInt(m[2]!, 10);
  const y = parseInt(m[3]!, 10);
  return Date.UTC(y, mo - 1, d);
}

/** MM/DD/YYYY → YYYY-MM-DD for calendar comparison with option expiration. */
function runDateToIsoYmd(runCell: string): string | null {
  const m = runCell.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    return null;
  }
  const mo = m[1]!.padStart(2, "0");
  const d = m[2]!.padStart(2, "0");
  const y = m[3]!;
  return `${y}-${mo}-${d}`;
}

/**
 * Option is treated as expired for this import when its expiration calendar day is on or before
 * the latest Run Date in the account's activity rows (Fidelity "as of" export date).
 */
function optionExpiredForActivitiesImport(expirationYmd: string, latestRunIsoYmd: string): boolean {
  if (!latestRunIsoYmd) {
    return false;
  }
  return expirationYmd <= latestRunIsoYmd;
}

function stockSignedDelta(actionUpper: string, qty: number): number {
  if (!Number.isFinite(qty) || qty === 0) {
    return 0;
  }
  const a = actionUpper;
  const q = Math.abs(qty);
  if (a.includes("YOU BOUGHT ASSIGNED PUTS")) {
    return q;
  }
  if (a.includes("YOU SOLD ASSIGNED CALLS")) {
    return -q;
  }
  if (a.includes("CALL") || a.includes("PUT")) {
    return 0;
  }
  if (a.includes("YOU BOUGHT")) {
    return q;
  }
  if (a.includes("YOU SOLD")) {
    return -q;
  }
  return 0;
}

function isFooterOrNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return true;
  }
  if (/^"the data/i.test(t) || /^"informational/i.test(t) || /^"brokerage/i.test(t)) {
    return true;
  }
  if (/^date downloaded/i.test(t)) {
    return true;
  }
  return false;
}

export function emptyFidelityActivityReplaySeed(): FidelityActivityReplaySeed {
  return {
    stockState: new Map(),
    optNet: new Map(),
    optPremNum: new Map(),
    optPremDen: new Map(),
    optMeta: new Map(),
    cashBalances: new Map()
  };
}

/**
 * Build initial replay state from current portfolio positions (stocks, options incl. shorts, cash).
 * Used so Accounts History applies **on top of** holdings from a prior portfolio snapshot import.
 */
export function fidelityActivityReplaySeedFromBrokerPositions(
  inputs: BrokerPositionSeedInput[]
): FidelityActivityReplaySeed {
  const seed = emptyFidelityActivityReplaySeed();
  for (const p of inputs) {
    if (p.type === "cash") {
      const sym = (p.symbol || "CASH").trim().toUpperCase().slice(0, 32) || "CASH";
      const usd = Number.isFinite(p.avgCost) ? Math.max(0, p.avgCost) : 0;
      if (usd <= 0) {
        continue;
      }
      seed.cashBalances.set(sym, (seed.cashBalances.get(sym) ?? 0) + usd);
      continue;
    }
    if (p.type === "stock") {
      const ticker = (p.symbol || "").trim().toUpperCase();
      if (!ticker || !Number.isFinite(p.qty) || p.qty <= 0) {
        continue;
      }
      const shares = Math.round(p.qty);
      const avg = Number.isFinite(p.avgCost) ? Math.max(0, p.avgCost) : 0;
      const prev = seed.stockState.get(ticker) ?? { shares: 0, cost: 0 };
      prev.shares += shares;
      prev.cost += shares * avg;
      seed.stockState.set(ticker, prev);
      continue;
    }
    const und = (p.symbol || "").trim().toUpperCase();
    const strike = p.strike;
    const ot = p.optionType;
    const exp = p.expiration;
    if (!und || strike == null || !Number.isFinite(strike) || strike <= 0) {
      continue;
    }
    if (ot !== "call" && ot !== "put") {
      continue;
    }
    if (!(exp instanceof Date) || Number.isNaN(exp.getTime())) {
      continue;
    }
    const ymd = exp.toISOString().slice(0, 10);
    const key = `${und}|${ymd}|${ot}|${strike}`;
    const contracts = Math.round(p.qty);
    if (contracts === 0) {
      continue;
    }
    seed.optMeta.set(key, { underlying: und, expiration: ymd, optionType: ot, strike });
    seed.optNet.set(key, (seed.optNet.get(key) ?? 0) + contracts);
    const prem = Number.isFinite(p.avgCost) ? Math.max(0, p.avgCost) : 0;
    const w = Math.abs(contracts);
    seed.optPremNum.set(key, (seed.optPremNum.get(key) ?? 0) + w * prem);
    seed.optPremDen.set(key, (seed.optPremDen.get(key) ?? 0) + w);
  }
  return seed;
}

type MutableReplayState = {
  stockState: Map<string, { shares: number; cost: number }>;
  optNet: Map<string, number>;
  optPremNum: Map<string, number>;
  optPremDen: Map<string, number>;
  optMeta: Map<string, FidelityActivityOptMeta>;
};

function cloneReplayState(seed: FidelityActivityReplaySeed): MutableReplayState {
  return {
    stockState: new Map([...seed.stockState.entries()].map(([k, v]) => [k, { shares: v.shares, cost: v.cost }])),
    optNet: new Map(seed.optNet),
    optPremNum: new Map(seed.optPremNum),
    optPremDen: new Map(seed.optPremDen),
    optMeta: new Map(seed.optMeta)
  };
}

function applyActivityRowToState(r: FidelityActivityRawRow, state: MutableReplayState): void {
  const sym = r.symbol.trim();
  if (!sym) {
    return;
  }
  const q = r.quantity;
  if (q === null) {
    return;
  }

  const osi = parseFidelityOptionSymbol(sym);
  if (osi) {
    const key = `${osi.underlying}|${osi.expiration}|${osi.optionType}|${osi.strike}`;
    state.optMeta.set(key, osi);
    state.optNet.set(key, (state.optNet.get(key) ?? 0) + q);
    const w = Math.abs(q);
    if (w > 0 && r.price !== null && Number.isFinite(r.price)) {
      state.optPremNum.set(key, (state.optPremNum.get(key) ?? 0) + w * r.price);
      state.optPremDen.set(key, (state.optPremDen.get(key) ?? 0) + w);
    }
    return;
  }

  if (!isPlainEquityTicker(sym)) {
    return;
  }

  const ticker = sym.toUpperCase();
  const delta = stockSignedDelta(r.action.toUpperCase(), q);
  if (delta === 0) {
    return;
  }

  const st = state.stockState.get(ticker) ?? { shares: 0, cost: 0 };
  if (delta > 0) {
    const px = r.price !== null && Number.isFinite(r.price) ? Math.max(0, r.price) : 0;
    st.shares += delta;
    st.cost += delta * px;
  } else {
    const sell = -delta;
    if (st.shares > 0) {
      const avg = st.cost / st.shares;
      const closed = Math.min(sell, st.shares);
      st.cost -= closed * avg;
      st.shares -= closed;
    }
  }
  state.stockState.set(ticker, st);
}

function latestRunYmdFromRows(rows: FidelityActivityRawRow[]): string {
  let max = "";
  for (const r of rows) {
    if (r.runIsoYmd > max) {
      max = r.runIsoYmd;
    }
  }
  return max;
}

function buildPositionsFromReplayState(
  state: MutableReplayState,
  latestRunIsoYmd: string,
  cashBalances: Map<string, number>
): FidelityHoldingsPosition[] {
  const positions: FidelityHoldingsPosition[] = [];

  for (const [ticker, st] of state.stockState) {
    if (st.shares > 0.0001) {
      const sh = Math.round(st.shares);
      if (sh > 0) {
        positions.push({
          type: "stock",
          ticker,
          shares: sh,
          purchasePrice: st.cost > 0 ? st.cost / st.shares : 0
        });
      }
    }
  }

  for (const [key, net] of state.optNet) {
    if (net === 0) {
      continue;
    }
    const meta = state.optMeta.get(key);
    if (!meta) {
      continue;
    }
    const contracts = Math.round(net);
    if (contracts === 0) {
      continue;
    }
    if (latestRunIsoYmd && optionExpiredForActivitiesImport(meta.expiration, latestRunIsoYmd)) {
      continue;
    }
    const den = state.optPremDen.get(key) ?? 0;
    const num = state.optPremNum.get(key) ?? 0;
    const prem = den > 0 ? num / den : 0;
    positions.push({
      type: "option",
      ticker: meta.underlying,
      contracts,
      premium: Math.max(0, prem),
      optionType: meta.optionType,
      strike: meta.strike,
      expiration: meta.expiration
    });
  }

  for (const [sym, usd] of cashBalances) {
    if (usd > 0.0001) {
      positions.push({
        type: "cash",
        ticker: sym,
        shares: 1,
        purchasePrice: usd
      });
    }
  }

  return positions;
}

/**
 * Replay activity rows onto an initial seed (empty = file-only net, same as legacy behavior).
 * Cash balances from the seed are preserved (activities CSV does not model sweep cash today).
 */
export function replayFidelityActivityRows(
  rows: FidelityActivityRawRow[],
  seed: FidelityActivityReplaySeed
): FidelityHoldingsPosition[] {
  const state = cloneReplayState(seed);
  const cashBalances = new Map(seed.cashBalances);
  rows.sort((a, b) => a.sortKey - b.sortKey || a.lineIndex - b.lineIndex);
  for (const r of rows) {
    applyActivityRowToState(r, state);
  }
  const latestRunIsoYmd = latestRunYmdFromRows(rows);
  return buildPositionsFromReplayState(state, latestRunIsoYmd, cashBalances);
}

export function detectFidelityActivitiesCsv(csv: string): boolean {
  const head = csv.slice(0, 16_000).toLowerCase();
  return head.includes("run date") && head.includes("account number");
}

type ParsedHeader = {
  headerLineIndex: number;
  headerIdx: Record<string, number>;
};

function findActivitiesHeader(lines: string[]): ParsedHeader | null {
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    if (isFooterOrNoiseLine(rawLine)) {
      continue;
    }
    const row = parseCsvLine(rawLine);
    const lower = row.map((c) => c.replace(/\uFEFF/g, "").trim().toLowerCase());
    const runIx = lower.findIndex((c) => c === "run date");
    const acctNumIx = lower.findIndex((c) => c === "account number");
    if (runIx >= 0 && acctNumIx >= 0 && row.length >= 8) {
      const headerIdx: Record<string, number> = {};
      for (let j = 0; j < row.length; j++) {
        const key = row[j]!.replace(/\uFEFF/g, "").trim().toLowerCase();
        if (key) {
          headerIdx[key] = j;
        }
      }
      return { headerLineIndex: i, headerIdx };
    }
  }
  return null;
}

/**
 * Parse Accounts History into per-account activity rows (for merge apply + preview net).
 */
export function parseFidelityActivitiesAccountsWithRows(csv: string): {
  accounts: Array<{ accountRef: string; label: string; rows: FidelityActivityRawRow[] }>;
  parseError?: string;
} {
  const normalized = csv.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const header = findActivitiesHeader(lines);
  if (!header) {
    return {
      accounts: [],
      parseError: "Could not find Fidelity Activities header (Run Date and Account Number columns)."
    };
  }

  const { headerLineIndex, headerIdx } = header;
  const ix = (name: string): number => {
    const k = name.toLowerCase();
    return headerIdx[k] ?? -1;
  };

  const iRun = ix("run date");
  const iAcct = ix("account");
  const iAcctNum = ix("account number");
  const iAction = ix("action");
  const iSymbol = ix("symbol");
  const iPrice = ix("price");
  const iQty = ix("quantity");
  if (iRun < 0 || iAcctNum < 0 || iAction < 0 || iSymbol < 0 || iQty < 0) {
    return {
      accounts: [],
      parseError: "Activities CSV is missing required columns (Run Date, Account Number, Action, Symbol, Quantity)."
    };
  }

  const rawRows: FidelityActivityRawRow[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    if (isFooterOrNoiseLine(rawLine)) {
      continue;
    }
    const row = parseCsvLine(rawLine);
    const runCell = (row[iRun] ?? "").trim();
    if (!RUN_DATE_RE.test(runCell)) {
      continue;
    }
    const acctNum = (row[iAcctNum] ?? "").trim();
    if (!acctNum) {
      continue;
    }
    const ts = parseUsDateMmDdYyyy(runCell);
    const runIsoYmd = runDateToIsoYmd(runCell);
    if (!runIsoYmd) {
      continue;
    }
    const action = (row[iAction] ?? "").trim();
    const symbol = (row[iSymbol] ?? "").trim();
    const qty = parseNum(row[iQty] ?? "");
    const price = iPrice >= 0 ? parseNum(row[iPrice] ?? "") : null;
    const accountName = iAcct >= 0 ? (row[iAcct] ?? "").trim() : "";
    rawRows.push({
      sortKey: ts * 1_000_000 + i,
      lineIndex: i,
      runIsoYmd,
      accountNumber: acctNum,
      accountName,
      action,
      symbol,
      price,
      quantity: qty
    });
  }

  if (rawRows.length === 0) {
    return {
      accounts: [],
      parseError: "No activity rows found after header (check file format)."
    };
  }

  const byAccount = new Map<string, FidelityActivityRawRow[]>();
  for (const r of rawRows) {
    const list = byAccount.get(r.accountNumber) ?? [];
    list.push(r);
    byAccount.set(r.accountNumber, list);
  }

  const accounts: Array<{ accountRef: string; label: string; rows: FidelityActivityRawRow[] }> = [];
  for (const [accountRef, accountRows] of byAccount) {
    accountRows.sort((a, b) => a.sortKey - b.sortKey || a.lineIndex - b.lineIndex);
    const label =
      accountRows[0]?.accountName?.replace(/^"|"$/g, "") || `Fidelity ${accountRef}`;
    accounts.push({ accountRef, label, rows: accountRows });
  }

  return { accounts };
}

/**
 * Parse Fidelity Accounts History CSV into per-account position snapshots **from the file only**
 * (same as replaying onto an empty seed). Use for preview; apply uses merge with DB holdings.
 */
export function parseFidelityActivitiesAccounts(csv: string): {
  accounts: FidelityActivitiesAccount[];
  parseError?: string;
} {
  const { accounts: withRows, parseError } = parseFidelityActivitiesAccountsWithRows(csv);
  if (withRows.length === 0) {
    return { accounts: [], parseError: parseError ?? "No accounts parsed from Fidelity Activities CSV." };
  }
  const empty = emptyFidelityActivityReplaySeed();
  return {
    accounts: withRows.map(({ accountRef, label, rows }) => ({
      accountRef,
      label,
      positions: replayFidelityActivityRows(rows, empty)
    }))
  };
}
