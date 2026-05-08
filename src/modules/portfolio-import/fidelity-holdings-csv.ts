/**
 * Parse Fidelity "Positions - All Accounts" CSV. Aligned with xfinance-strategy
 * `apps/frontend/src/lib/fidelity-holdings-csv.ts`.
 */

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      const parts: string[] = [];
      while (end < line.length) {
        const next = line.indexOf('"', end);
        if (next < 0) {
          parts.push(line.slice(end));
          end = line.length;
          break;
        }
        parts.push(line.slice(end, next));
        if (line[next + 1] === '"') {
          parts.push('"');
          end = next + 2;
        } else {
          end = next + 1;
          break;
        }
      }
      out.push(parts.join(""));
      i = end;
      if (line[i] === ",") i++;
    } else {
      const comma = line.indexOf(",", i);
      if (comma < 0) {
        out.push(line.slice(i).trim());
        break;
      }
      out.push(line.slice(i, comma).trim());
      i = comma + 1;
    }
  }
  return out;
}

export function parseNum(val: string): number | null {
  if (val == null || val === "" || val === "--") return null;
  const cleaned = String(val).replace(/,/g, "").replace(/[$()]/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

export type FidelityHoldingsPosition = {
  type: "stock" | "option" | "cash";
  ticker: string;
  shares?: number;
  contracts?: number;
  purchasePrice?: number;
  premium?: number;
  optionType?: "call" | "put";
  strike?: number;
  expiration?: string;
  /** Last / Last Price column from Portfolio CSV when present (distinct from cost basis / avg). */
  lastPriceUsd?: number;
  /** Fidelity Portfolio CSV "Current Value" when present; drives dry-run balance totals (incl. short-option negatives). */
  currentValueUsd?: number;
};

export type FidelityHoldingsResult = {
  accountRef: string;
  label: string;
  positions: FidelityHoldingsPosition[];
  parseError?: string;
};

/** OPRA-style compact option symbol (root + yy mm dd + C|P + strike), aligned with activities parser. */
const FIDELITY_OSI_BODY_RE = /^([A-Z]{1,5})(\d{2})(\d{2})(\d{2})([CP])(\d+(?:\.\d+)?)$/i;

function utcCalendarYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** True when expiration YYYY-MM-DD is on or before the as-of calendar day (UTC). */
export function fidelityOptionExpiredOnOrBeforeAsOf(expirationYmd: string, asOf: Date): boolean {
  const ymd = expirationYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return false;
  }
  return ymd <= utcCalendarYmd(asOf);
}

function parseFidelityOptionSymbol(
  symbol: string
): { underlying: string; expiration: string; optionType: "call" | "put"; strike: number } | null {
  const sym = symbol.trim().replace(/^\uFEFF/, "").replace(/^-/, "").trim();
  const m = sym.match(FIDELITY_OSI_BODY_RE);
  if (!m) return null;
  const [, underlying, yy, mm, dd, cp, strikeStr] = m;
  const y = parseInt(yy!, 10);
  const year = y >= 50 ? 1900 + y : 2000 + y;
  const expiration = `${year}-${mm}-${dd}`;
  const optionType = cp!.toUpperCase() === "P" ? "put" : "call";
  const strike = parseFloat(strikeStr!);
  if (!Number.isFinite(strike) || strike <= 0) return null;
  return { underlying: underlying!.toUpperCase(), expiration, optionType, strike };
}

export type FidelityPortfolioHoldingsAccount = {
  accountRef: string;
  label: string;
  positions: FidelityHoldingsPosition[];
};

export type FidelityPortfolioHoldingsParseResult = {
  accounts: FidelityPortfolioHoldingsAccount[];
  parseError?: string;
};

function isFidelityPortfolioFooterLine(line: string): boolean {
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

/**
 * Fidelity **Portfolio** / multi-account **Positions** download: first column `Account Number`,
 * plus `Account Name`, `Symbol`, `Quantity` (not Accounts History — that has `Run Date`).
 */
export function detectFidelityPortfolioHoldingsCsv(csv: string): boolean {
  const normalized = csv.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length && i < 80; i++) {
    const raw = lines[i] ?? "";
    if (isFidelityPortfolioFooterLine(raw)) {
      continue;
    }
    const row = parseCsvLine(raw);
    const lower = row.map((c) => c.replace(/\uFEFF/g, "").trim().toLowerCase());
    if (lower.includes("run date")) {
      return false;
    }
    const hasAcctNum = lower.some((c) => c === "account number");
    const hasAcctName = lower.some((c) => c === "account name");
    const hasSymbol = lower.some((c) => c === "symbol");
    const hasQty = lower.some((c) => c === "quantity");
    if (hasAcctNum && hasAcctName && hasSymbol && hasQty) {
      return true;
    }
  }
  return false;
}

function appendFidelityHoldingPosition(
  positions: FidelityHoldingsPosition[],
  symbolRaw: string,
  quantity: number,
  lastPrice: number | null,
  avgCost: number | null,
  asOfDate: Date,
  currentValueUsd: number | null = null
): void {
  const priceBasis = avgCost ?? lastPrice ?? 0;
  const cv =
    currentValueUsd != null && Number.isFinite(currentValueUsd) ? currentValueUsd : undefined;
  const lastUsd =
    lastPrice != null && Number.isFinite(lastPrice) && lastPrice >= 0 ? lastPrice : undefined;

  if (/^cash\s*\(/i.test(symbolRaw)) {
    positions.push({
      type: "cash",
      ticker: symbolRaw.replace(/^cash\s*\(([^)]*)\)/i, "$1").trim() || "CASH",
      shares: quantity,
      purchasePrice: priceBasis || 1,
      ...(lastUsd !== undefined ? { lastPriceUsd: lastUsd } : {}),
      ...(cv !== undefined ? { currentValueUsd: cv } : {})
    });
    return;
  }

  const optionInfo = parseFidelityOptionSymbol(symbolRaw);
  if (optionInfo) {
    if (fidelityOptionExpiredOnOrBeforeAsOf(optionInfo.expiration, asOfDate)) {
      return;
    }
    positions.push({
      type: "option",
      ticker: optionInfo.underlying,
      contracts: Math.round(quantity),
      premium: avgCost ?? lastPrice ?? 0,
      optionType: optionInfo.optionType,
      strike: optionInfo.strike,
      expiration: optionInfo.expiration,
      ...(lastUsd !== undefined ? { lastPriceUsd: lastUsd } : {}),
      ...(cv !== undefined ? { currentValueUsd: cv } : {})
    });
    return;
  }

  positions.push({
    type: "stock",
    ticker: symbolRaw.toUpperCase(),
    shares: Math.round(quantity),
    purchasePrice: priceBasis > 0 ? priceBasis : undefined,
    ...(lastUsd !== undefined ? { lastPriceUsd: lastUsd } : {}),
    ...(cv !== undefined ? { currentValueUsd: cv } : {})
  });
}

/**
 * Parse Fidelity **Portfolio** positions CSV (all accounts in one file, `Account Number` column).
 */
export function parseFidelityPortfolioHoldingsCsv(
  csv: string,
  asOfDate: Date = new Date()
): FidelityPortfolioHoldingsParseResult {
  const normalized = csv.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  let headerLineIndex = -1;
  let headerIdx: Record<string, number> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    if (isFidelityPortfolioFooterLine(rawLine)) {
      continue;
    }
    const row = parseCsvLine(rawLine);
    const lower = row.map((c) => c.replace(/\uFEFF/g, "").trim().toLowerCase());
    if (lower.includes("run date")) {
      continue;
    }
    const hasAcctNum = lower.some((c) => c === "account number");
    const hasAcctName = lower.some((c) => c === "account name");
    const hasSymbol = lower.some((c) => c === "symbol");
    const hasQty = lower.some((c) => c === "quantity");
    if (hasAcctNum && hasAcctName && hasSymbol && hasQty && row.length >= 6) {
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
      parseError:
        "Could not find Fidelity Portfolio positions header (Account Number, Account Name, Symbol, Quantity)."
    };
  }

  const ix = (name: string): number => {
    const k = name.toLowerCase();
    return headerIdx![k] ?? -1;
  };

  const iAcctNum = ix("account number");
  const iAcctName = ix("account name");
  const iSymbol = ix("symbol");
  const iQty = ix("quantity");
  let iLastPrice = -1;
  for (const [k, v] of Object.entries(headerIdx)) {
    if (/^last price$/i.test(k.trim())) {
      iLastPrice = v;
      break;
    }
  }
  const iAvgCost = (() => {
    for (const [k, v] of Object.entries(headerIdx)) {
      if (/\baverage\s+cost\s+basis\b/i.test(k) || /\bavg\.?\s*cost\b/i.test(k)) {
        return v;
      }
    }
    return -1;
  })();
  const iCurrentValue = (() => {
    for (const [k, v] of Object.entries(headerIdx)) {
      if (/^current value$/i.test(k.trim())) {
        return v;
      }
    }
    return -1;
  })();
  const iCostBasisTotal = (() => {
    for (const [k, v] of Object.entries(headerIdx)) {
      if (/^cost basis total$/i.test(k.trim())) {
        return v;
      }
    }
    return -1;
  })();

  if (iAcctNum < 0 || iAcctName < 0 || iSymbol < 0 || iQty < 0) {
    return {
      accounts: [],
      parseError: "Portfolio CSV is missing Account Number, Account Name, Symbol, or Quantity."
    };
  }

  const byAccount = new Map<string, { label: string; positions: FidelityHoldingsPosition[] }>();

  for (let r = headerLineIndex + 1; r < lines.length; r++) {
    const rawLine = lines[r] ?? "";
    if (isFidelityPortfolioFooterLine(rawLine)) {
      break;
    }
    const row = parseCsvLine(rawLine);
    const acctRef = (row[iAcctNum] ?? "").trim();
    if (!acctRef) {
      continue;
    }
    const acctName = (row[iAcctName] ?? "").trim().replace(/^"|"$/g, "");
    const symbolRaw = (row[iSymbol] ?? "").trim();
    if (!symbolRaw || /^pending activity/i.test(symbolRaw)) {
      continue;
    }
    const symClean = symbolRaw.replace(/\s/g, "");
    const isCoreSweep = /^(SPAXX|FCASH|FDRXX|CORE|SPRXX)\*+$/i.test(symClean);

    let bucket = byAccount.get(acctRef);
    if (!bucket) {
      bucket = { label: acctName || `Fidelity ${acctRef}`, positions: [] };
      byAccount.set(acctRef, bucket);
    } else if (acctName) {
      bucket.label = acctName;
    }

    if (isCoreSweep) {
      const fromCurrent = iCurrentValue >= 0 ? parseNum(row[iCurrentValue] ?? "") : null;
      const fromCostBasis = iCostBasisTotal >= 0 ? parseNum(row[iCostBasisTotal] ?? "") : null;
      const dollars = fromCurrent ?? fromCostBasis;
      if (dollars == null || dollars <= 0) {
        continue;
      }
      const ticker = symClean.replace(/\*+$/i, "").toUpperCase();
      bucket.positions.push({
        type: "cash",
        ticker,
        shares: 1,
        purchasePrice: dollars,
        currentValueUsd: dollars
      });
      continue;
    }

    const qty = parseNum(row[iQty] ?? "");
    if (qty === null || qty === 0) {
      continue;
    }
    const quantity = qty < 0 ? -qty : qty;

    const lastPrice = iLastPrice >= 0 ? parseNum(row[iLastPrice] ?? "") : null;
    const avgCost = iAvgCost >= 0 ? parseNum(row[iAvgCost] ?? "") : null;
    const currentVal = iCurrentValue >= 0 ? parseNum(row[iCurrentValue] ?? "") : null;

    appendFidelityHoldingPosition(bucket.positions, symbolRaw, quantity, lastPrice, avgCost, asOfDate, currentVal);
  }

  const accounts: FidelityPortfolioHoldingsAccount[] = [...byAccount.entries()].map(([accountRef, v]) => ({
    accountRef,
    label: v.label,
    positions: v.positions
  }));

  if (accounts.length === 0) {
    return {
      accounts: [],
      parseError: "No position rows found in Portfolio CSV after header."
    };
  }

  return { accounts };
}

export function parseFidelityHoldingsCsv(
  csv: string,
  defaultAccountRef: string = "",
  /** Positions snapshot "as of" — options expired on or before this day (UTC) are omitted. */
  asOfDate: Date = new Date()
): FidelityHoldingsResult {
  const normalized = csv.replace(/\uFEFF/g, "").trim();
  const lines = normalized.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  const positions: FidelityHoldingsPosition[] = [];

  let headerRow: string[] | null = null;
  let dataStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const first = (row[0] ?? "").trim();
    if (/^symbol$/i.test(first) && row.length >= 2) {
      headerRow = row.map((h) => h.replace(/\uFEFF/g, "").trim());
      dataStartIndex = i + 1;
      break;
    }
    if (first.toLowerCase().startsWith("disclosure") || first === "") break;
  }

  if (!headerRow || dataStartIndex < 0) {
    return {
      accountRef: defaultAccountRef,
      label: "Fidelity (All Accounts)",
      positions: [],
      parseError: "Could not find header row starting with Symbol"
    };
  }

  const iSymbol = headerRow.findIndex((h) => /^symbol$/i.test(h));
  const iQty = headerRow.findIndex((h) => /^quantity$/i.test(h));
  const iLast = headerRow.findIndex((h) => /^last$/i.test(h));
  const iAvgCost = headerRow.findIndex((h) => /\$?\s*avg\s*cost/i.test(h));

  if (iSymbol < 0 || iQty < 0) {
    return {
      accountRef: defaultAccountRef,
      label: "Fidelity (All Accounts)",
      positions: [],
      parseError: "Required columns Symbol and Quantity not found"
    };
  }

  for (let r = dataStartIndex; r < lines.length; r++) {
    const row = parseCsvLine(lines[r]);
    const symbolRaw = (row[iSymbol] ?? "").trim();
    const firstCell = (row[0] ?? "").trim();
    if (firstCell.toLowerCase().startsWith("disclosure") || firstCell === "") break;
    if (!symbolRaw || symbolRaw === "--") continue;

    const qtyRaw = row[iQty] ?? "";
    const qty = parseNum(qtyRaw);
    if (qty === null) continue;
    const quantity = qty < 0 ? -qty : qty;

    const lastPrice = iLast >= 0 ? parseNum(row[iLast] ?? "") : null;
    const avgCost = iAvgCost >= 0 ? parseNum(row[iAvgCost] ?? "") : null;
    appendFidelityHoldingPosition(positions, symbolRaw, quantity, lastPrice, avgCost, asOfDate);
  }

  return {
    accountRef: defaultAccountRef,
    label: "Fidelity (All Accounts)",
    positions
  };
}
