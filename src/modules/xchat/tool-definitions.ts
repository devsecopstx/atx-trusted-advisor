
/**
 * Wire definitions for atx_function and yahoo_finance tools.
 * Kept separate from tool-executor so xai-tools (and thus xai) can be used
 * in contexts that must not pull in Mongo/core-admin (e.g. client bundles).
 */
export const ATXFINANCE_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "atx_function",
    description:
      "Portfolio, accounts, watchlist (read + add/remove on the user's default watchlist), positions, scheduled tasks, and Yahoo quotes. Scoped to the signed-in user only—never pass a user id. watchlist_add_symbols upserts tickers with default row metadata (Stock / balanced) and fills desk risk growth + outlook neutral only when unset; use when the user says e.g. \"add NVDA to my watchlist\". watchlist_remove_symbols removes tickers.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "portfolio_summary",
            "positions_snapshot",
            "watchlist_snapshot",
            "watchlist_add_symbols",
            "watchlist_remove_symbols",
            "account_health",
            "task_status",
            "market_quote"
          ],
          description:
            "portfolio_summary: portfolio + accounts (cashBalance, position counts) + watchlist (name, symbols, addedAt) on the default portfolio; use watchlist_snapshot for watchlist-only. positions_snapshot: holdings per account (qty, avgCost; capped). watchlist_add_symbols / watchlist_remove_symbols: require symbols array or symbol (see properties). account_health: balances + default account. task_status: scheduled tasks/runs. market_quote: Yahoo quote for symbol."
        },
        symbol: {
          type: "string",
          description:
            "Single ticker: market_quote, or one symbol for watchlist_add_symbols / watchlist_remove_symbols."
        },
        symbols: {
          type: "array",
          items: { type: "string" },
          description:
            "Multiple tickers for watchlist_add_symbols or watchlist_remove_symbols (max 20 per call), e.g. [\"NVDA\",\"AMD\"]."
        }
      },
      required: ["operation"]
    }
  }
};

export const YAHOO_FINANCE_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "yahoo_finance",
    description:
      "Fetch market quote data from Yahoo Finance (internal canonical market data source).",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description:
            "Ticker symbol to quote (for example TSLA). Optional; defaults to TSLA."
        }
      }
    }
  }
};
