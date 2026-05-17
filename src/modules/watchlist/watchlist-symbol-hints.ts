/** Common ticker typos → intended symbol (desk add flow). */
export const WATCHLIST_TICKER_TYPOS: Record<string, string> = {
  APPL: "AAPL",
  GOOG: "GOOGL"
};

export function suggestWatchlistTickerCorrection(symbolUpper: string): string | null {
  const key = symbolUpper.trim().toUpperCase();
  const suggested = WATCHLIST_TICKER_TYPOS[key];
  if (!suggested || suggested === key) {
    return null;
  }
  return suggested;
}
