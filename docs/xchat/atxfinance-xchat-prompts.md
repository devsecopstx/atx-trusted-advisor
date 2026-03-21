# xChat Prompt Tips (Current + Ready List)

This document tracks operator-approved finance prompt examples for `xChat`.

Current shipped UI state:
- `src/app/xchat/ui/xchat-conversation.tsx` does not currently render clickable prompt chips.
- Users type prompts directly in the input bar.
- Saved history and history stats are rendered above the live session thread.

Use this page as the canonical prompt bank for:
- future clickable prompt tips in `xChat`,
- QA smoke tests for finance prompt quality,
- support/runbook examples.

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

### Ops and automation
- Show scheduled scanner tasks
- Run options scan now
- What failed in my last task run
- Recommend next automation task

## Maintenance checklist

- Keep this file aligned with `src/app/xchat/ui/xchat-conversation.tsx`.
- If prompt chips are added to UI, ensure this list and UI examples match.
- Keep prompts finance-focused and concise for chip-sized rendering.
