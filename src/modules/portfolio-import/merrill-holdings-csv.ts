/**
 * Parse Merrill Edge Holdings CSV (positions snapshot) into accounts with positions.
 * Aligned with xfinance-strategy `apps/frontend/src/lib/merrill-holdings-csv.ts` and OpenAPI
 * `Position` (ticker, shares, purchasePrice, type stock|option|cash).
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

/** Parse quantity: "(3)" => -3, "500" => 500, "2,486.98" => 2486.98 */
function parseQuantity(raw: string): number | null {
  const n = parseNum(raw);
  if (n === null) return null;
  if (raw.trim().startsWith("(")) return -Math.abs(n);
  return n;
}

/** Parse option details from Security Description */
function parseOptionFromDescription(
  desc: string
): { optionType: "call" | "put"; symbol: string; strike: number; expiration: string } | null {
  const m = desc.match(/(CALL|PUT)\s+(\w+)\s+(\d+(?:\.\d+)?)\s+.*?EXP\s+(\d{2})-(\d{2})-(\d{2})/i);
  if (!m) return null;
  const [, side, sym, strikeStr, mm, dd, yy] = m;
  const optionType = side!.toLowerCase() === "put" ? "put" : "call";
  const strike = parseFloat(strikeStr!);
  const year = yy!.length === 2 ? (parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`) : yy!;
  const expiration = `${year}-${mm}-${dd}`;
  return { optionType, symbol: sym!.toUpperCase(), strike, expiration };
}

export type MerrillHoldingsPosition = {
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

export type MerrillHoldingsResult = {
  accounts: Array<{
    accountRef: string;
    label: string;
    positions: MerrillHoldingsPosition[];
  }>;
  parseError?: string;
};

function normalizeHeaderCell(h: string): string {
  return h.replace(/\uFEFF/g, "").trim();
}

export function parseMerrillHoldingsCsv(csv: string): MerrillHoldingsResult {
  const normalized = csv.replace(/\uFEFF/g, "").trim();
  const lines = normalized.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { accounts: [], parseError: "File has no data rows (need header + at least one row)." };
  }

  const headerRow = parseCsvLine(lines[0]);
  const header = headerRow.map(normalizeHeaderCell);
  const iSymbol = header.findIndex((h) => /symbol/i.test(h) && !/cusip/i.test(h));
  const iAccountReg = header.findIndex((h) => /account\s+registration/i.test(h));
  const iAccountNum = header.findIndex((h) => /account\s*#/i.test(h));
  const iDesc = header.findIndex((h) => /security\s+description/i.test(h));
  const iQty = header.findIndex((h) => /quantity/i.test(h));
  const iPrice = header.findIndex((h) => /price/i.test(h));

  if (iSymbol < 0 || iQty < 0) {
    const missing = [iSymbol < 0 ? "Symbol" : null, iQty < 0 ? "Quantity" : null].filter(Boolean).join(", ");
    return {
      accounts: [],
      parseError: `Required column(s) not found: ${missing}. Header: ${header.slice(0, 10).join(" | ")}`
    };
  }

  function looksLikeAccountRef(s: string): boolean {
    const t = s.replace(/,/g, "").trim();
    if (!t) return false;
    if (/^\d+\.?\d*$/.test(t)) return false;
    if (/^[\d,]+\.?\d*$/.test(t)) return false;
    return true;
  }

  const byAccount = new Map<string, { label: string; positions: MerrillHoldingsPosition[] }>();

  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvLine(lines[r]);
    const symbolRaw = (row[iSymbol] ?? "").trim();
    const accountRef = (row[iAccountNum] ?? "").trim() || (row[iAccountReg] ?? "").trim();
    const label = (row[iAccountReg] ?? "").trim() || accountRef;
    if (!looksLikeAccountRef(accountRef) && !looksLikeAccountRef(label)) continue;
    const key = accountRef || label || "default";
    const desc = (row[iDesc] ?? "").trim();
    const qty = parseQuantity(row[iQty] ?? "");
    const priceRaw = row[iPrice] ?? "";
    const price = parseNum(priceRaw);

    if (!symbolRaw || symbolRaw === "--") continue;
    if (qty === null || qty === 0) continue;

    if (!byAccount.has(key)) {
      byAccount.set(key, { label, positions: [] });
    }
    const bag = byAccount.get(key)!;

    const hasHash = symbolRaw.includes("#");
    const optionInfo = parseOptionFromDescription(desc);
    const isOption = hasHash && (optionInfo != null || /[CP]\d{8}$/i.test(symbolRaw));
    const underlying = hasHash ? symbolRaw.slice(0, symbolRaw.indexOf("#")).toUpperCase() : symbolRaw.toUpperCase();

    if (underlying === "IIAXX" || /^[A-Z]+XX$/i.test(underlying)) {
      bag.positions.push({
        type: "cash",
        ticker: underlying,
        shares: qty,
        purchasePrice: price ?? 1
      });
      continue;
    }

    if (isOption && optionInfo) {
      const contracts = Math.abs(Math.round(qty));
      bag.positions.push({
        type: "option",
        ticker: optionInfo.symbol,
        contracts,
        premium: price != null ? Math.abs(price) : undefined,
        optionType: optionInfo.optionType,
        strike: optionInfo.strike,
        expiration: optionInfo.expiration
      });
      continue;
    }

    if (isOption && !optionInfo) {
      const contracts = Math.abs(Math.round(qty));
      bag.positions.push({
        type: "option",
        ticker: underlying,
        contracts,
        premium: price != null ? Math.abs(price) : undefined
      });
      continue;
    }

    bag.positions.push({
      type: "stock",
      ticker: underlying,
      shares: Math.abs(qty),
      purchasePrice: price != null ? Math.abs(price) : undefined
    });
  }

  const accounts = Array.from(byAccount.entries()).map(([ref, { label, positions }]) => ({
    accountRef: ref,
    label,
    positions
  }));

  return { accounts };
}
