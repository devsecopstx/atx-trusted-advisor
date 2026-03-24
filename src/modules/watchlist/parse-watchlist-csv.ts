const SYMBOL_RE = /^[A-Z0-9.\-]{1,32}$/;

export type WatchlistCsvEntry = {
  symbol: string;
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
};

export type ParseWatchlistCsvResult = {
  /** Last row wins per symbol (file order). */
  entries: WatchlistCsvEntry[];
  invalidRowCount: number;
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter !== "," && delimiter !== ";") {
    return line.split(delimiter).map((c) => c.trim());
  }

  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      out.push(cur.trim());
      cur = "";
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > 0 && tabs >= commas && tabs >= semis) {
    return "\t";
  }
  if (semis > commas) {
    return ";";
  }
  return ",";
}

function normalizeHeaderCell(raw: string): string {
  return raw.replace(/^"|"$/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const set = new Set(candidates.map((c) => c.toLowerCase()));
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeaderCell(headers[i] ?? "");
    if (set.has(h)) {
      return i;
    }
  }
  return -1;
}

/** Dedicated cost / limit columns (take precedence over market `Price`). */
function findEntryPriceColumnIndex(headers: string[], symbolColumn: number): number {
  const normalized = headers.map((h) => normalizeHeaderCell(h));
  const preferOrder = [
    "entry price",
    "entryprice",
    "avg entry",
    "px entry",
    "limit",
    "price entry",
    "entry"
  ];
  for (const want of preferOrder) {
    const idx = normalized.findIndex((h) => h === want);
    if (idx >= 0 && idx !== symbolColumn) {
      return idx;
    }
  }
  return -1;
}

/**
 * Quote / last columns (e.g. app export `Price`). Used as `entryPrice` when dedicated entry cell is empty.
 */
function findMarketPriceColumnIndex(headers: string[], symbolColumn: number): number {
  const normalized = headers.map((h) => normalizeHeaderCell(h));
  const preferOrder = [
    "last price",
    "last",
    "close",
    "prev close",
    "market price",
    "current price",
    "mid",
    "price"
  ];
  for (const want of preferOrder) {
    const idx = normalized.findIndex((h) => h === want);
    if (idx >= 0 && idx !== symbolColumn) {
      return idx;
    }
  }
  return -1;
}

function findTypeColumnIndex(headers: string[], symbolColumn: number): number {
  const candidates = [
    "type",
    "position type",
    "asset type",
    "instrument type",
    "asset class"
  ];
  const idx = findColumnIndex(headers, candidates);
  if (idx >= 0 && idx !== symbolColumn) {
    return idx;
  }
  for (let i = 0; i < headers.length; i++) {
    if (i === symbolColumn) {
      continue;
    }
    const h = normalizeHeaderCell(headers[i] ?? "");
    if (h === "kind" || h.endsWith(" type")) {
      return i;
    }
  }
  return -1;
}

function parseNumericCell(raw: string): number | undefined {
  const t = raw.replace(/^"|"$/g, "").trim();
  if (!t) {
    return undefined;
  }
  const n = Number.parseFloat(t.replaceAll(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function unquoteCell(raw: string): string {
  return raw.replace(/^"|"$/g, "").trim();
}

/**
 * Parses watchlist CSV from app export or broker sheets.
 * Supports comma-, semicolon-, or tab-delimited files; optional header row.
 * Imports Symbol plus Type, Strategy, Quantity, and price for **`entryPrice`**:
 * prefers Entry Price / Entry / limit-style columns; if that cell is empty or missing, uses **Price** /
 * Last / Close / market-style columns (matches re-importing our export with quote `Price`).
 */
export function parseWatchlistCsv(text: string): ParseWatchlistCsvResult {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { entries: [], invalidRowCount: 0 };
  }

  const delim = detectDelimiter(lines[0]!);
  const firstCells = parseDelimitedLine(lines[0]!, delim);
  const headerProbe = firstCells.map((c) => normalizeHeaderCell(c));

  const symbolIdx = findColumnIndex(headerProbe, [
    "symbol",
    "ticker",
    "instrument",
    "sym"
  ]);

  let dataStart = 0;
  let colSymbol = 0;
  let colType = -1;
  let colStrategy = -1;
  let colQty = -1;
  let colEntry = -1;
  let colMarketPrice = -1;

  if (symbolIdx >= 0) {
    dataStart = 1;
    colSymbol = symbolIdx;
    colType = findTypeColumnIndex(firstCells, colSymbol);
    colStrategy = findColumnIndex(firstCells, ["strategy", "strat", "play"]);
    colQty = findColumnIndex(firstCells, ["quantity", "qty", "shares", "size"]);
    colEntry = findEntryPriceColumnIndex(firstCells, colSymbol);
    colMarketPrice = findMarketPriceColumnIndex(firstCells, colSymbol);
  }

  const bySymbol = new Map<string, WatchlistCsvEntry>();
  let invalidRowCount = 0;

  for (let r = dataStart; r < lines.length; r++) {
    const row = lines[r]!;
    const cells = parseDelimitedLine(row, delim);
    const rawSym = unquoteCell(cells[colSymbol] ?? "");
    if (!rawSym) {
      invalidRowCount += 1;
      continue;
    }
    const sym = rawSym.toUpperCase();
    if (!SYMBOL_RE.test(sym)) {
      invalidRowCount += 1;
      continue;
    }

    const entry: WatchlistCsvEntry = { symbol: sym };
    if (colType >= 0) {
      const v = unquoteCell(cells[colType] ?? "");
      if (v) {
        entry.lineType = v.slice(0, 128);
      }
    }
    if (colStrategy >= 0) {
      const v = unquoteCell(cells[colStrategy] ?? "");
      if (v) {
        entry.strategy = v.slice(0, 512);
      }
    }
    if (colQty >= 0) {
      const q = parseNumericCell(cells[colQty] ?? "");
      if (q !== undefined) {
        entry.quantity = q;
      }
    }
    const fromEntry = colEntry >= 0 ? parseNumericCell(cells[colEntry] ?? "") : undefined;
    const fromMarket =
      colMarketPrice >= 0 ? parseNumericCell(cells[colMarketPrice] ?? "") : undefined;
    const entryPrice = fromEntry ?? fromMarket;
    if (entryPrice !== undefined) {
      entry.entryPrice = entryPrice;
    }

    bySymbol.set(sym, entry);
  }

  return {
    entries: Array.from(bySymbol.values()),
    invalidRowCount
  };
}
