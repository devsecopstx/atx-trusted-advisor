# xChat Prompt Tips (Current UI)

This document tracks app_user prompt examples for `xChat`.
Examples are shown regardless of persona as helpful finance starters.

Current shipped UI state:

- Prompt examples are in a collapsed **Example prompts** panel below the input bar.
- Clicking an example copies it into the current input (does not auto-send).
- Chat history is a separate collapsed panel to the right of examples on desktop.
- History is lazy-loaded when the history panel is first expanded.

Use this page as the canonical prompt bank for QA and support runbooks.

## xFinance Prompt Bank

### Portfolio and holdings

- Show my portfolio allocation
- What are my top movers today
- Summarize my current risk exposure
- Which positions are over-concentrated

### Watchlist and market scan

- Show my watchlist performance
- Add TSLA to my watchlist
- Compare SPY vs QQQ trend today
- What changed in my watchlist today

### Covered calls and options income

- Covered call ideas for my holdings
- Should I roll my TSLA call
- Wheel strategy setup for NVDA
- Evaluate protective put for downside risk

### Trade review and risk controls

- Review today trades for risk flags
- Where is my max drawdown risk
- Stress test portfolio for volatility spike
- Suggest defined-risk hedge ideas

### Placeholder

- xStrategy

## Maintenance checklist

- Keep this file aligned with `src/app/xchat/ui/xchat-conversation.tsx`.
- Keep examples finance-focused and concise for chip-style rendering.
- Keep `xStrategy` as the final placeholder entry until replaced by shipped prompts.
