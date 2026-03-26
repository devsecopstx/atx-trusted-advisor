Watchlist Scanner — Requirements & Design
Overview
The Watchlist Scanner is a lightweight scheduled/on-demand job that keeps the user’s default portfolio watchlist fresh in the background.
For every symbol in the watchlist it:

Pulls the latest price + % change from Yahoo Finance
Generates a concise recommendation (BUY / HOLD / SELL) + short rationale
Updates the watchlist record with latestPrice, recommendation, rationale, lastUpdated

It also produces one consolidated market snapshot post (price + recommendation + rationale per item) and creates alerts for delivery via the user’s configured channels (Slack / X). Runs as part of the daily runPortfolio flow.
Job type: watchlistScanner
Default schedule: 0 16 * * 1-5 (Mon–Fri 4 PM)
Triggers: scheduled, manual “Run Now”, or runPortfolio

Architecture

┌─────────────────────────────────────────────────────────────┐
│                    Watchlist Scanner Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  runWatchlistScanner()                                      │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────┐                                   │
│  │ Load default         │                                   │
│  │ portfolio watchlist  │                                   │
│  └──────────┬───────────┘                                   │
│             │                                               │
│             ▼                                               │
│  For each symbol → Yahoo Finance                           │
│     • latest price + change %                              │
│     • recommendation + rationale (rule + Grok optional)    │
│                                                             │
│             │                                               │
│             ▼                                               │
│  Update watchlist document                                  │
│  (latestPrice, recommendation, rationale, lastUpdated)     │
│                                                             │
│             │                                               │
│             ▼                                               │
│  Create alerts (significant moves / high-confidence recs)  │
│             │                                               │
│             ▼                                               │
│  One consolidated snapshot post → configured channels      │
│  (Slack / X)                                                │
│                                                             │
│  Result: { updated: N, alertsCreated: M, posted: true }   │
└─────────────────────────────────────────────────────────────┘

Key Features

Background update – watchlist always shows current prices & AI insights
Market snapshot – single daily post summarizing the entire watchlist
Alerts – created for BUY/SELL recs or price moves > threshold
Configurable – min change %, symbols filter, Grok enable/disable (future)
Integration – fits into existing unifiedOptionsScanner + deliverAlerts pipeline

Ready to implement as src/lib/watchlist-scanner.ts following the exact pattern of covered-call-analyzer.ts / unified-options-scanner.ts.
