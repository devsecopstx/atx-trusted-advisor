/** Hard cap on symbols per portfolio watchlist (aligned with `mutatePortfolioWatchlistSymbols`). */
export const MAX_WATCHLIST_SYMBOLS = 75;

/** API `PATCH` body allows at most this many symbols per `addSymbols` / `removeSymbols` request. */
export const MAX_WATCHLIST_SYMBOLS_PER_PATCH = 20;
