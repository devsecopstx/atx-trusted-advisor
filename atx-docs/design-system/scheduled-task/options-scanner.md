# Option Scanner Job

**Service**: `option-scanner`  
**Type**: Scheduled background job (runs as part of unifiedOptionsScanner)  
**Frequency**: Configurable per tenant (default: every 15 minutes during market hours, once after close)

## Purpose
The Option Scanner is a rule-based + Grok-enhanced scheduled job that keeps **every tenant portfolio’s option watchlists and holdings** up-to-date with fresh recommendations and rationale.  
When a user adds an option call/put chain (or any option position) to a watchlist or portfolio, the scanner evaluates it and generates clear HOLD / BUY_TO_CLOSE recommendations with supporting rationale, confidence score, and alerts where needed.  
All market data is sourced exclusively from Yahoo Finance (acceptable 15-minute delay).

## Scope
- Scans **all portfolios** belonging to the current app tenant.
- Sources:
  - Existing open option positions (calls & puts) from default portfolio accounts.
  - Watchlist symbols (for new opportunities, including user-added option chains).
- Focus: Calls and puts only.
- Applies tenant/portfolio-level `option-strategy-prefs` (IV rank/percent, min OI, min volume, max delta, risk profile, etc.).

## Core Flow
```ts
runOptionScanner(accountId?, config?)
  ↓
Load default portfolio (risk/outlook) + watchlist symbols
  ↓
For each option position / watchlist symbol:
  • Fetch real-time option chain + greeks via Yahoo Finance only
  • Apply filters (min OI, min volume, IV range, etc.)
  • Evaluate rules (DTE, P/L %, time value %, stop-loss, IV spike)
  • Edge cases → optional Grok analysis
  ↓
Store recommendation + rationale in optionRecommendations collection
Create alerts (BUY_TO_CLOSE only)
  ↓
Return per-portfolio stats
Output & Logging Summary (per portfolio)
After each run, the job emits a clean, human-readable summary for observability and audit trails:

Option scan complete for portfolio [PORTFOLIO_ID] (@ [YYYY-MM-DD HH:MM:SS UTC])
• Scanned: 27 options
• Stored: 19 recommendations (12 HOLD, 7 BUY_TO_CLOSE)
• Alerts created: 3 (BUY_TO_CLOSE)
• Grok analysis: 2 high-P/L edge cases
• Duration: 4.2 seconds
• Next scheduled run: [timestamp]

The summary is:

Written to application logs
Stored in a lightweight option_scan_history table (for dashboard “last updated” badges)
Optionally pushed to a tenant-specific notification channel if any BUY_TO_CLOSE alerts are generated.

Key Requirements

Idempotent and retry-safe (use unique job ID + lock per tenant).
Rate-limit friendly to Yahoo Finance.
Cache-aware: skip options whose chain is <15 minutes old unless forced refresh.
Zero user-facing impact — runs silently in background.

Error Handling & Resilience

Isolated per-option failures: An error fetching any single option chain (network, Yahoo outage, invalid ticker, rate-limit 429, etc.) is logged with full context (symbol, expiration, strike, error code) but does NOT stop the scan for the rest of the portfolio or tenant.
Retry policy: Transient errors receive up to 3 exponential-backoff retries (initial 1s, then 3s, then 8s). Permanent errors (e.g., 404 ticker, auth failure) are recorded once and skipped.
Fallback: If Yahoo primary call fails, use the last cached chain (still within 15-min window) before marking as failed.
Circuit breaker: If >20% of options fail in a single run, the job pauses further Yahoo calls for that tenant for 15 minutes and logs a high-severity alert.
Partial success reporting: Summary always shows “Scanned X / Stored Y / Failed Z / Alerts W” so ops can see exactly what succeeded.
Dead-letter & alerting: Persistent failures (>3 consecutive runs for same option) are moved to an option_scan_dead_letter queue and trigger a tenant admin Slack/email alert (with portfolio context).
Transaction safety: All recommendation updates are wrapped in per-portfolio database transactions; partial batch failures roll back only the failed options.
Monitoring hooks: Every run emits Prometheus metrics (option_scan_duration_seconds, option_scan_options_total, option_scan_errors_total, option_scan_grok_calls).

Key Evaluation Rules (configurable via UnifiedOptionsScannerConfig)

HOLD if DTE ≥ holdDteMin and time value % ≥ holdTimeValuePercentMin
BUY_TO_CLOSE if DTE < btcDteMax or P/L < btcStopLossPercent
High IV puts → conservative treatment
Grok candidates: high |P/L|%, low DTE, high IV spike

Configuration
Pulled from UnifiedOptionsScannerConfig:

optionScanner overrides: holdDteMin, btcDteMax, btcStopLossPercent, holdTimeValuePercentMin, highVolatilityPercent, grokEnabled, etc.
Strategy prefs: IV rank/percent, min OI, min volume, max delta, risk profile.

Success Criteria

Every option holding/watchlist chain has a recommendation timestamp ≤ current job run time (or explicit failure logged).
Total scan time per tenant stays under 45 seconds even at scale (hundreds of portfolios + thousands of options).
Clear, concise per-portfolio summary logged for every execution, including error counts.

Status: Ready for implementation / review.