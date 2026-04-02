# Options Strategy Scanner Job — Phase 2

**Service id (categories):** `options_scanner` · `daily_options_scanner`  
**Logical service id (output prefix):** `options-strategy-scanner`  
**Modules:** `executeOptionsStrategyScannerJob` — `src/modules/strategy-options/options-strategy-scanner-job.ts`; thin wrapper `runOptionsStrategyScanner` — `options-strategy-scanner.ts`  
**Type:** Tenant-admin scheduled background job (`admin_scheduled_tasks`), same pipeline as other core scanners

**Governance (reviewer / SRE):** Jobs are created only via **`/admin/tasks`** (global admin, tenant-scoped). There is no portfolio-level scheduler UI. **Future (TBD):** end-users might create an options-related job from **xChat** — not shipped until scoped; see `.cursor/agents/reviewer.md` § *Scheduled tasks (admin)*.

---

## Implementation (Next.js) — Phase 2

| Piece | Location |
|--------|----------|
| **Unified job** | `executeOptionsStrategyScannerJob({ tenantId, category })` — `options-strategy-scanner-job.ts` (both categories share one implementation; `task_category=` in output preserves source) |
| **Scheduled hook** | `runOptionsStrategyScanner(task)` → delegates to the job above |
| **Scheduled task routing** | Single branch: `options_scanner` **or** `daily_options_scanner` → `runOptionsStrategyScanner` — `src/modules/core-admin/task-runner.ts` |
| **Admin schedule / cron** | `/admin/tasks` — `admin_scheduled_tasks`; default cron via `SCHEDULED_TASK_CATEGORY_DEFAULT_CRON` in `src/lib/scheduled-task-category-schema.ts`; manual run: `POST /api/admin/tasks/{taskId}/run` |
| **Core scanner audit** | `isCoreScannerCategory` includes both categories — `logCoreScannerRunAudit` in `executeScheduledTask` (`task-runner.ts`) |
| **Slack run summary** | Optional: task `deliveryChannelTarget` → `admin_delivery_channels` (Slack webhook), same pattern as other scheduled tasks (`scheduled-task-slack-notify.ts`) |

### Phase 2 shipped (current)

1. **US market calendar gate** (same helper as price scanner): non-business days or outside regular session → **success + skipped** with reason; still loads strategy/prefs counts for output.
2. **Strategy catalog + preference inventory** (`adminListOptionsStrategySummaries`, `adminListOptionsStrategyPreferenceSummaries`).
3. **Tenant-scoped option position survey:** `portfolio_positions` count for option legs (`type: "option"` or legacy `optionType` call/put) + distinct underlying symbols; when market open, included in output and `tenant_market_calendar` snapshot with `sourceTaskCategory: "options_strategy_scanner"`.
4. **Recommendations + rationale:** Batched **Yahoo** chains (`fetchYahooOptionChainForExpiration`), **side-aware** rules (long vs short premium, high-IV short puts tighter thresholds), optional **Grok** (`chatWithXai`). Upserts **`portfolio_recommendations`** with `[options-scanner]` notes + `Side` / `BUY_TO_CLOSE` | `SELL_TO_CLOSE` copy. **Long** exit → `action: sell`; **short** exit → `action: buy` (buy-to-close). **Watchlist:** `portfolio_watchlists` rows with OCC-style `symbol` (e.g. CSV `TSLA260327C00370000`) and eligible `lineType` / `strategy` → `options-scanner-targets.ts` → merged with positions (position wins on duplicate contract). Module: `options-scanner-engine.ts`.
5. **Alerts (deduped):** Close-only; body tags `[afp:underlying|exp|strike|type]` + `[close:BUY_TO_CLOSE|SELL_TO_CLOSE]`. Skips new alert if an **active** alert with the same fingerprint exists; **dismisses** scanner alerts for that contract when the run returns **HOLD**. Cap **`OPTIONS_SCANNER_MAX_ALERTS_PER_RUN`** (default **5**).
6. **Try/catch** → failed runs return `options-strategy-scanner: task_category=… failed: …`.

**Env (optional):** `OPTIONS_SCANNER_MAX_POSITIONS`, `OPTIONS_SCANNER_MAX_WATCHLIST_ROWS`, `OPTIONS_SCANNER_GROK_ENABLED`, `OPTIONS_SCANNER_GROK_MAX_CALLS`, `OPTIONS_SCANNER_MAX_ALERTS_PER_RUN`.

**Tests:** `options-strategy-scanner`, `options-scanner-engine`, `options-scanner-targets`.

### Phase 2 roadmap — full engine (extra)

- Richer **PLAN 245** / Kotlin **OptionsStrategyEngine** scoring, `option_scan_history` dashboard badges, circuit breaker / metrics — see `strategy-engine.md`.

---

## Purpose (product)

The Option Scanner is a rule-based + Grok-enhanced scheduled job that keeps **every tenant portfolio’s option watchlists and holdings** up-to-date with fresh recommendations and rationale.  
When a user adds an option call/put chain (or any option position) to a watchlist or portfolio, the scanner evaluates it and generates clear `HOLD` / `BUY_TO_CLOSE` recommendations with supporting rationale, confidence score (0-100), and alerts where needed.

**Target end state** (aligned with **PLAN 245** / **OptionsStrategyEngine**): ranked strategy recommendations from chain data, prefs, and the pipeline in [`strategy-engine.md`](../xStrategyBuilder/strategy-engine.md).

**Shipped value (current Phase 2):** unified scanner job, US session gate, strategy/prefs inventory, **positions + watchlist OCC lines**, Yahoo chains, side-aware + Grok rationale into **`portfolio_recommendations`**, **deduped** close alerts, `tenant_market_calendar` snapshots. **Roadmap:** full PLAN 245 engine + history collections + circuit metrics.

---

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
Load default portfolio (risk/outlook) + watchlist symbols + option-strategy-prefs from Mongo
  ↓
For each option position / watchlist symbol:
  • Fetch option chain + greeks via Yahoo Finance only (15-min delay OK)
  • Apply filters (min OI, min volume, IV range, etc.)
  • Evaluate rules (DTE, P/L %, time value %, stop-loss, IV spike)
  • Edge cases → optional Grok analysis (if grokEnabled)
  ↓
Store recommendation + rationale in Mongo **`portfolio_recommendations`** (see shipped section)
Create alerts (BUY_TO_CLOSE only)
  ↓
Return per-portfolio stats

Output & Logging Summary (per portfolio)
After each run, the job emits a clean, human-readable summary for observability and audit trails:
textOption scan complete for portfolio [PORTFOLIO_ID] (@ [YYYY-MM-DD HH:MM:SS UTC])
• Scanned: 27 options
• Stored: 19 recommendations (12 HOLD, 7 BUY_TO_CLOSE)
• Alerts created: 3 (BUY_TO_CLOSE)
• Grok analysis: 2 high-P/L edge cases
• Failed: 1 (TSLA 2026-04-17 380C — Yahoo rate limit)
• Duration: 4.2 seconds
• Next scheduled run: [timestamp]
The summary is:

Written to application logs + admin_task_runs.output
Stored in lightweight Mongo option_scan_history collection (for dashboard “last updated” badges)
Optionally pushed to tenant-specific Slack if any BUY_TO_CLOSE alerts fire.

Key Requirements

Idempotent and retry-safe (unique job ID + Mongo lock per tenant).
Rate-limit friendly to Yahoo Finance.
Cache-aware: skip chains whose data is <15 minutes old unless forced refresh.
Zero user-facing impact — runs silently in background.

Error Handling & Resilience (Phase 2)
Isolated per-option failures: Error on any single option chain (network, Yahoo outage, invalid ticker, rate-limit 429, etc.) is logged with full context (symbol, expiration, strike, error code, stack) but does NOT stop the scan for the rest of the portfolio or tenant.
Retry policy: Transient errors receive up to 3 exponential-backoff retries (initial 1s → 3s → 8s). Permanent errors (e.g., 404, auth failure) recorded once and skipped.
Fallback: If Yahoo call fails, use last cached chain (still within 15-min window) before marking failed.
Circuit breaker: If >20% of options fail in a single run, pause further Yahoo calls for that tenant for 15 minutes and log high-severity alert.
Partial success reporting: Summary always shows “Scanned X / Stored Y / Failed Z / Alerts W”.
Dead-letter & alerting: Persistent failures (>3 consecutive runs for same option) moved to Mongo option_scan_dead_letter queue and trigger tenant admin Slack/email (with portfolio context).
Transaction safety: All recommendation updates wrapped in per-portfolio Mongo transactions; partial batch failures roll back only the failed options.
Monitoring hooks: Every run emits structured logs + optional Prometheus metrics (option_scan_duration_seconds, option_scan_options_total, option_scan_errors_total, option_scan_grok_calls, option_scan_retry_count).

Key Evaluation Rules (configurable via UnifiedOptionsScannerConfig)

HOLD if DTE ≥ holdDteMin and time value % ≥ holdTimeValuePercentMin
BUY_TO_CLOSE if DTE < btcDteMax or P/L < btcStopLossPercent
High IV puts → conservative treatment
Grok candidates: high |P/L|%, low DTE, high IV spike

Configuration
Pulled from UnifiedOptionsScannerConfig (stored in Mongo):

optionScanner overrides: holdDteMin, btcDteMax, btcStopLossPercent, holdTimeValuePercentMin, highVolatilityPercent, grokEnabled, etc.
Strategy prefs: IV rank/percent, min OI, min volume, max delta, risk profile.

Success Criteria

Every option holding/watchlist chain has a recommendation timestamp ≤ current job run time (or explicit failure logged).
Total scan time per tenant stays under 45 seconds even at scale (hundreds of portfolios + thousands of options).
Clear, concise per-portfolio summary logged for every execution, including error counts.
Full alignment with existing v1 inventory pass + admin task framework.

Category split: Keep only options_scanner - converge to one when full engine ships.
Market window: Phase 2 respect US session hours via resolveUsMarketDayContext (like price-scanner).
xChat-created jobs: Design for both batch one job for tennat and end-user jobs before enabling.
