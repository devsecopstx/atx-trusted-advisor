const SYMBOL_RE = /^[A-Z0-9.\-]{1,32}$/;

export type ParseWatchlistCsvResult = {
  /** Unique symbols in file order, uppercased. */
  symbols: string[];
  /** Rows that had no valid symbol (empty or bad format). */
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
  return raw.replace(/^"|"$/g, "").trim().toLowerCase();
}

/**
 * Parses watchlist CSV from app export (`Symbol,Company,...`) or simple one-column lists.
 * Supports comma-, semicolon-, or tab-delimited files and optional header row.
 */
export function parseWatchlistCsv(text: string): ParseWatchlistCsvResult {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { symbols: [], invalidRowCount: 0 };
  }

  const delim = detectDelimiter(lines[0]!);
  const firstCells = parseDelimitedLine(lines[0]!, delim);
  const headerProbe = firstCells.map(normalizeHeaderCell);
  const symbolHeaderIdx = headerProbe.findIndex((h) =>
    ["symbol", "ticker", "instrument"].includes(h)
  );

  let symbolCol = 0;
  let dataStart = 0;
  if (symbolHeaderIdx >= 0) {
    symbolCol = symbolHeaderIdx;
    dataStart = 1;
  }

  const seen = new Set<string>();
  const symbols: string[] = [];
  let invalidRowCount = 0;

  for (let r = dataStart; r < lines.length; r++) {
    const row = lines[r]!;
    const cells = parseDelimitedLine(row, delim);
    const raw = (cells[symbolCol] ?? "").replace(/^"|"$/g, "").trim();
    if (!raw) {
      invalidRowCount += 1;
      continue;
    }
    const sym = raw.toUpperCase();
    if (!SYMBOL_RE.test(sym)) {
      invalidRowCount += 1;
      continue;
    }
    if (seen.has(sym)) {
      continue;
    }
    seen.add(sym);
    symbols.push(sym);
  }

  return { symbols, invalidRowCount };
}
