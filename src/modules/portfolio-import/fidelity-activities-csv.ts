/**
 * Fidelity "Accounts History" / activity CSV: Run Date, Account Number, Symbol, Quantity, …
 * Groups rows by Account Number (xref), skips disclaimer/footer lines, replays chronologically
 * into net stock lots and net long option legs (short/flat option nets are omitted).
 */

import { parseCsvLine, parseNum, type FidelityHoldingsPosition } from "@/modules/portfolio-import/fidelity-holdings-csv";

export type FidelityActivitiesAccount = {
  accountRef: string;
  label: string;
  positions: FidelityHoldingsPosition[];
};

const RUN_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const OSI_BODY_RE = /^([A-Z]{1,5})(\d{2})(\d{2})(\d{2})([CP])(\d+(?:\.\d+)?)$/i;

function normalizeOsiSymbol(raw: string): string {
  return raw.trim().replace(/^\uFEFF/, "").replace(/^-/, "").trim().toUpperCase();
}

function parseOsiSymbol(
  raw: string
): { underlying: string; expiration: string; optionType: "call" | "put"; strike: number } | null {
  const sym = normalizeOsiSymbol(raw);
  const m = sym.match(OSI_BODY_RE);
  if (!m) {
    return null;
  }
  const [, und, yy, mm, dd, cp, strikeStr] = m;
  const y = parseInt(yy!, 10);
  const year = y >= 50 ? 1900 + y : 2000 + y;
  const expiration = `${year}-${mm}-${dd}`;
  const optionType = cp!.toUpperCase() === "P" ? "put" : "call";
  const strike = parseFloat(strikeStr!);
  if (!Number.isFinite(strike) || strike <= 0) {
    return null;
  }
  return { underlying: und!.toUpperCase(), expiration, optionType, strike };
}

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

export function detectFidelityActivitiesCsv(csv: string): boolean {
  const head = csv.slice(0, 16_000).toLowerCase();
  return head.includes("run date") && head.includes("account number");
}

/**
 * Parse Fidelity Accounts History CSV into per-account position snapshots (file = source of truth style).
 */
export function parseFidelityActivitiesAccounts(csv: string): {
  accounts: FidelityActivitiesAccount[];
  parseError?: string;
} {
  const normalized = csv.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  let headerIdx: Record<string, number> | null = null;
  let headerLineIndex = -1;

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
      headerLineIndex = i;
      headerIdx = {};
      for (let j = 0; j < row.length; j++) {
        const key = row[j]!.replace(/\uFEFF/g, "").trim().toLowerCase();
        if (key) {
          headerIdx[key] = j;
        }
      }
      break;
    }
  }

  if (!headerIdx || headerLineIndex < 0) {
    return {
      accounts: [],
      parseError: "Could not find Fidelity Activities header (Run Date and Account Number columns)."
    };
  }

  const ix = (name: string): number => {
    const k = name.toLowerCase();
    return headerIdx![k] ?? -1;
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

  type RawRow = {
    sortKey: number;
    lineIndex: number;
    accountNumber: string;
    accountName: string;
    action: string;
    symbol: string;
    price: number | null;
    quantity: number | null;
  };

  const rawRows: RawRow[] = [];

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
    const action = (row[iAction] ?? "").trim();
    const symbol = (row[iSymbol] ?? "").trim();
    const qty = parseNum(row[iQty] ?? "");
    const price = iPrice >= 0 ? parseNum(row[iPrice] ?? "") : null;
    const accountName = iAcct >= 0 ? (row[iAcct] ?? "").trim() : "";
    rawRows.push({
      sortKey: ts * 1_000_000 + i,
      lineIndex: i,
      accountNumber: acctNum,
      accountName,
      action: action,
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

  const byAccount = new Map<string, RawRow[]>();
  for (const r of rawRows) {
    const list = byAccount.get(r.accountNumber) ?? [];
    list.push(r);
    byAccount.set(r.accountNumber, list);
  }

  const accounts: FidelityActivitiesAccount[] = [];

  for (const [accountRef, rows] of byAccount) {
    rows.sort((a, b) => a.sortKey - b.sortKey || a.lineIndex - b.lineIndex);

    const stockState = new Map<string, { shares: number; cost: number }>();
    const optNet = new Map<string, number>();
    const optPremNum = new Map<string, number>();
    const optPremDen = new Map<string, number>();
    const optMeta = new Map<
      string,
      { underlying: string; expiration: string; optionType: "call" | "put"; strike: number }
    >();

    for (const r of rows) {
      const sym = r.symbol.trim();
      if (!sym) {
        continue;
      }
      const q = r.quantity;
      if (q === null) {
        continue;
      }

      const osi = parseOsiSymbol(sym);
      if (osi) {
        const key = `${osi.underlying}|${osi.expiration}|${osi.optionType}|${osi.strike}`;
        optMeta.set(key, osi);
        optNet.set(key, (optNet.get(key) ?? 0) + q);
        const w = Math.abs(q);
        if (w > 0 && r.price !== null && Number.isFinite(r.price)) {
          optPremNum.set(key, (optPremNum.get(key) ?? 0) + w * r.price);
          optPremDen.set(key, (optPremDen.get(key) ?? 0) + w);
        }
        continue;
      }

      if (!isPlainEquityTicker(sym)) {
        continue;
      }

      const ticker = sym.toUpperCase();
      const delta = stockSignedDelta(r.action.toUpperCase(), q);
      if (delta === 0) {
        continue;
      }

      const st = stockState.get(ticker) ?? { shares: 0, cost: 0 };
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
      stockState.set(ticker, st);
    }

    const positions: FidelityHoldingsPosition[] = [];
    for (const [ticker, st] of stockState) {
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

    for (const [key, net] of optNet) {
      if (net <= 0) {
        continue;
      }
      const meta = optMeta.get(key);
      if (!meta) {
        continue;
      }
      const contracts = Math.round(net);
      if (contracts <= 0) {
        continue;
      }
      const den = optPremDen.get(key) ?? 0;
      const num = optPremNum.get(key) ?? 0;
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

    const label = rows[0]?.accountName?.replace(/^"|"$/g, "") || `Fidelity ${accountRef}`;

    accounts.push({
      accountRef,
      label,
      positions
    });
  }

  return { accounts };
}
