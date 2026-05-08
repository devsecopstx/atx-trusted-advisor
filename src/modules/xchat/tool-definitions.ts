
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
      "Portfolio, accounts, watchlist (read + add/remove on the user's default watchlist), positions, scheduled tasks, Yahoo quotes, and Premium+ advisor NL price alerts (price_alert_manage; one active rule per symbol per user; optional portfolio hint). Scoped to the signed-in user only—never pass a user id. watchlist_add_symbols upserts tickers with default row metadata (Stock / balanced) and fills desk risk growth + outlook neutral only when unset; use when the user says e.g. \"add NVDA to my watchlist\". watchlist_remove_symbols removes tickers.",
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
            "options_scan",
            "options_action_scan",
            "market_quote",
            "price_alert_manage"
          ],
          description:
            "portfolio_summary: portfolio + accounts (cashBalance, position counts) + watchlist (name, symbols, addedAt, entryPrice/targetEntryPrice when set) on the default portfolio; use watchlist_snapshot for watchlist-only. positions_snapshot: holdings per account (qty, avgCost; capped). watchlist_add_symbols / watchlist_remove_symbols: require symbols array or symbol (see properties). account_health: balances + default account. task_status: scheduled tasks/runs. options_scan: scan Yahoo option chains by filters (optionType, DTE, delta, IV, OI, bid); accepts either structured fields or a natural-language `query` such as 'RDW CSP scan put DTE<=7 delta 0.15-0.30 vol>40 OI>500 bid>0.10'. options_action_scan: deterministic options action report across live option holdings + watchlist symbols with recommended actions (ROLL/BTC/HOLD/LET_EXPIRE/STC/OPEN/MONITOR). market_quote: Yahoo quote for symbol—echo price, change, and previousClose from the tool JSON in your reply so users see live numbers. price_alert_manage: Premium+HNWI NL desk price rules on the **workspace portfolio** (see priceAlertOp + confirmDestructive); fires during tenant watchlist price scanner when Yahoo quotes cross armed thresholds; email uses desk delivery channels when configured."
        },
        symbol: {
          type: "string",
          description:
            "Single ticker: market_quote, watchlist_add_symbols/watchlist_remove_symbols, or options_scan (alias for underlying)."
        },
        underlying: {
          type: "string",
          description: "Underlying ticker for options_scan."
        },
        query: {
          type: "string",
          description:
            "Natural-language scanner criteria for options_scan, e.g. 'RDW CSP scan for put, DTE<=7, delta 0.15-0.3, vol>40%, OI>500, bid>0.10'."
        },
        optionType: {
          type: "string",
          enum: ["call", "put"],
          description: "options_scan leg side."
        },
        minDte: {
          type: "number",
          description: "options_scan minimum days-to-expiration."
        },
        maxDte: {
          type: "number",
          description: "options_scan maximum days-to-expiration."
        },
        minDelta: {
          type: "number",
          description: "options_scan minimum absolute delta (0..1)."
        },
        maxDelta: {
          type: "number",
          description: "options_scan maximum absolute delta (0..1)."
        },
        minIvPct: {
          type: "number",
          description: "options_scan minimum implied volatility percent."
        },
        minOi: {
          type: "number",
          description: "options_scan minimum open interest."
        },
        minBid: {
          type: "number",
          description: "options_scan minimum bid price."
        },
        symbols: {
          type: "array",
          items: { type: "string" },
          description:
            "Multiple tickers for watchlist_add_symbols or watchlist_remove_symbols (max 20 per call), e.g. [\"NVDA\",\"AMD\"]."
        },
        priceAlertOp: {
          type: "string",
          enum: ["list", "add", "remove_symbol", "clear_all"],
          description:
            "With operation price_alert_manage (Premium+ advisor): list active NL alerts (`portfolio_price_alerts`) + recent desk rows; add requires symbol + targetPrice + ruleKind (above|below|crosses)—if direction missing, stop and ask; optional portfolioHint ties the alert book to a portfolio/account nickname or defaults to workspace; remove_symbol / clear_all need confirmDestructive after explicit user confirmation."
        },
        portfolioHint: {
          type: "string",
          description:
            "price_alert_manage add: optional portfolio nickname, portfolio name, or custodian account label (e.g. \"in Roth\", \"growth portfolio\"). Defaults to current workspace portfolio when omitted."
        },
        inPortfolio: {
          type: "string",
          description: "Alias for portfolioHint when the user says \"in … portfolio/account\"."
        },
        targetPrice: {
          type: "number",
          description: "USD spot threshold for price_alert_manage add (e.g. 420 for TSLA 420)."
        },
        ruleKind: {
          type: "string",
          enum: ["above", "below", "crosses"],
          description:
            "price_alert_manage add: required before calling add—above = upward cross through target; below = downward cross; crosses = either direction. If the user only gave a symbol + number, ask which direction (do not guess)."
        },
        confirmDestructive: {
          type: "boolean",
          description:
            "Must be true for price_alert_manage remove_symbol or clear_all once the user has explicitly confirmed deletion in chat."
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
      "Fetch market quote data from Yahoo Finance (internal canonical market data source). " +
      "The tool returns JSON with price, previousClose, change, and changePercent—**repeat those numbers in your answer** (e.g. SPY vs QQQ comparisons) so users see live figures, not only a citation chip.",
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
