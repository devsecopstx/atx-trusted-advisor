const WATCHLIST_SCAN_RATIONALE_MAX = 4000;

/**
 * Appends a short desk note after each `watchlist_price_scanner` price refresh.
 * Preserves prior rationale (trimmed + capped at 4000 chars).
 */
export function buildWatchlistScannerRationaleAppendix(
  existing: string | undefined,
  /** Yahoo spot when available; otherwise prior row `lastPrice`; omit both → quote-unavailable line. */
  lastPrice: number | undefined,
  at: Date
): string {
  const day = at.toISOString().slice(0, 10);
  const spotLabel =
    typeof lastPrice === "number" && Number.isFinite(lastPrice)
      ? `$${lastPrice.toFixed(2)}`
      : "n/a (quote unavailable)";
  const appendix = `[Watchlist price scan ${day}] Spot ${spotLabel} — review desk thesis.`;
  const prev = (existing ?? "").trim();
  const combined = prev ? `${prev}\n\n${appendix}` : appendix;
  if (combined.length <= WATCHLIST_SCAN_RATIONALE_MAX) {
    return combined;
  }
  return combined.slice(combined.length - WATCHLIST_SCAN_RATIONALE_MAX);
}
