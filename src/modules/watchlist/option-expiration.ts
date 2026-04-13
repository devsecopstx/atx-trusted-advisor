/**
 * Utilities to determine option expiration in America/New_York for OCC/Yahoo compact tickers
 * such as TSLA260327C00370000.
 *
 * Safe for both server and client usage (no Node-only imports).
 */

export type ParsedOccOption = {
  underlying: string;
  expYmd: string; // YYYY-MM-DD
  optionType: "call" | "put";
  strike: number;
};

/** Parse Yahoo/OCC compact option ticker e.g. `TSLA260327C00370000` (right-anchored). */
export function parseOccOptionSymbol(raw: string): ParsedOccOption | null {
  const s = raw.trim().toUpperCase();
  if (s.length < 15) return null;
  const strikeStr = s.slice(-8);
  const cp = s.slice(-9, -8);
  const yymmdd = s.slice(-15, -9);
  const root = s.slice(0, -15);
  if (!root || (cp !== "C" && cp !== "P")) return null;
  if (!/^\d{8}$/.test(strikeStr) || !/^\d{6}$/.test(yymmdd)) return null;
  const strikeInt = Number.parseInt(strikeStr, 10);
  if (!Number.isFinite(strikeInt) || strikeInt < 0) return null;
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = 2000 + yy;
  const expYmd = `${year}-${mm}-${dd}`;
  const t = Date.parse(`${expYmd}T00:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return {
    underlying: root,
    expYmd,
    optionType: cp === "P" ? "put" : "call",
    strike: strikeInt / 1000
  };
}

/**
 * Yahoo `quote` / `options` expect an **underlying** ticker. OCC compact option symbols must map to root.
 */
export function underlyingForYahooOptionsChain(raw: string): string {
  const s = raw.trim().toUpperCase();
  const occ = parseOccOptionSymbol(s);
  return occ?.underlying ?? s;
}

/**
 * Compute today’s civil date in America/New_York and return YYYY-MM-DD.
 */
export function todayEtYmd(now: Date = new Date()): string {
  // Use Intl to format in ET regardless of runtime TZ.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(now);
}

/**
 * Returns true when the symbol is a CALL option and the expiration date is BEFORE today (ET).
 * Options expiring today remain visible (not expired) for the entire ET day.
 */
export function isExpiredCallOption(symbol: string, now: Date = new Date()): boolean {
  const parsed = parseOccOptionSymbol(symbol);
  if (!parsed) return false; // Non-option or unparsable → do not treat as expired here
  if (parsed.optionType !== "call") return false; // Only filter calls per spec
  const etYmd = todayEtYmd(now);
  return parsed.expYmd < etYmd;
}

/** Filter out expired CALL options from a list of string symbols. */
export function filterNonExpiredCallSymbols(symbols: string[], now: Date = new Date()): string[] {
  return symbols.filter((s) => !isExpiredCallOption(s, now));
}
