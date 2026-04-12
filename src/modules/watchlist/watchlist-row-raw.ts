/**
 * Mongo `portfolio_watchlists.symbols` may still contain legacy **string** tickers; structured rows use `{ symbol, … }`.
 * Normalization on read (`normalizeWatchlistDocumentSymbols`) fixes API output, but batch jobs read raw BSON.
 */

export function symbolFromRawWatchlistEntry(raw: unknown): string | null {
  if (typeof raw === "string") {
    const s = raw.trim().toUpperCase();
    return s || null;
  }
  if (raw && typeof raw === "object" && "symbol" in raw) {
    const s = String((raw as { symbol?: unknown }).symbol ?? "").trim().toUpperCase();
    return s || null;
  }
  return null;
}

/** Prior `lastPrice` on a structured BSON row (used when Yahoo returns no price this tick). */
export function lastPriceFromRawWatchlistEntry(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object" || !("lastPrice" in raw)) {
    return undefined;
  }
  const v = (raw as { lastPrice?: unknown }).lastPrice;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replaceAll(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Desk fields on a structured row (Grok / scan stitching). */
export function watchlistRowDeskMeta(raw: unknown): {
  rationale?: string;
  lineType?: string;
  strategy?: string;
} {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    rationale: typeof o.rationale === "string" ? o.rationale : undefined,
    lineType: typeof o.lineType === "string" ? o.lineType : undefined,
    strategy: typeof o.strategy === "string" ? o.strategy : undefined
  };
}

/** Safe object base for `$set` merges — never spread a string primitive onto a subdocument. */
export function mergeBaseFromRawWatchlistEntry(raw: unknown, fallbackNow: Date): Record<string, unknown> {
  if (typeof raw === "string") {
    const symbol = raw.trim().toUpperCase();
    return { symbol, addedAt: fallbackNow };
  }
  if (raw && typeof raw === "object") {
    return { ...(raw as Record<string, unknown>) };
  }
  return { symbol: "", addedAt: fallbackNow };
}
