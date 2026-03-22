/**
 * Parse Fidelity "Positions - All Accounts" CSV. Aligned with xfinance-strategy
 * `apps/frontend/src/lib/fidelity-holdings-csv.ts`.
 */

function parseCsvLine(line: string): string[] {
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

function parseNum(val: string): number | null {
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
};

export type FidelityHoldingsResult = {
  accountRef: string;
  label: string;
  positions: FidelityHoldingsPosition[];
  parseError?: string;
};

function parseFidelityOptionSymbol(
  symbol: string
): { underlying: string; expiration: string; optionType: "call" | "put"; strike: number } | null {
  const m = symbol.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d+)$/i);
  if (!m) return null;
  const [, underlying, yy, mm, dd, cp, strikeStr] = m;
  const year = 2000 + parseInt(yy!, 10);
  const expiration = `${year}-${mm}-${dd}`;
  const optionType = cp!.toUpperCase() === "P" ? "put" : "call";
  const strike = parseInt(strikeStr!, 10);
  if (Number.isNaN(strike)) return null;
  return { underlying: underlying!.toUpperCase(), expiration, optionType, strike };
}

export function parseFidelityHoldingsCsv(
  csv: string,
  defaultAccountRef: string = ""
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
    const price = lastPrice ?? avgCost ?? 0;

    if (/^cash\s*\(/i.test(symbolRaw)) {
      positions.push({
        type: "cash",
        ticker: symbolRaw.replace(/^cash\s*\(([^)]*)\)/i, "$1").trim() || "CASH",
        shares: quantity,
        purchasePrice: price || 1
      });
      continue;
    }

    const optionInfo = parseFidelityOptionSymbol(symbolRaw);
    if (optionInfo) {
      positions.push({
        type: "option",
        ticker: optionInfo.underlying,
        contracts: Math.round(quantity),
        premium: avgCost ?? lastPrice ?? 0,
        optionType: optionInfo.optionType,
        strike: optionInfo.strike,
        expiration: optionInfo.expiration
      });
      continue;
    }

    positions.push({
      type: "stock",
      ticker: symbolRaw.toUpperCase(),
      shares: Math.round(quantity),
      purchasePrice: price || undefined
    });
  }

  return {
    accountRef: defaultAccountRef,
    label: "Fidelity (All Accounts)",
    positions
  };
}
