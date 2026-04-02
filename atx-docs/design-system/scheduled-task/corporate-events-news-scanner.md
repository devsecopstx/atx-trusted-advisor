# Job name
Corporate Events & News Scanner

# Purpose
Surfaces earnings, ex-div dates, splits, or material news only on watchlist/holdings (Yahoo only, 15-min delay OK).

# Suggested frequency
Every 30 min during market hours + EOD

# Per-portfolio summary example

“Event scan: 2 earnings tomorrow (NVDA, TSLA). 1 ex-div date. No material negative headlines.”

> **Phase 3 — shipped (app ≥2.9.0):** Category **`corporate_events_scanner`**; Yahoo quote hints (earnings / ex-div style) + circuit breaker; `runCorporateEventsScanner` in **`phase3-scanner-jobs.ts`**. See [scanners-phase3-plan.md](./scanners-phase3-plan.md).