# Options strategy scanner — open questions & backlog

**Category:** `options_scanner`  
**Code:** `runOptionsStrategyScanner` / `executeOptionsStrategyScannerJob` — `src/modules/strategy-options/options-strategy-scanner.ts`, `options-strategy-scanner-job.ts`; recommendation pass — `options-scanner-engine.ts`; prefs merge — `options-scanner-prefs-filter.ts`. Routed in `src/modules/core-admin/task-runner.ts`; cron/UI — `/admin/tasks`. **Governance:** tenant-admin jobs only until xChat-created flows are designed (`.cursor/agents/reviewer.md` — scheduled tasks).

**Tests:** `tests/unit/options-strategy-scanner.test.ts`, `tests/unit/options-scanner-engine.test.ts`, `tests/unit/options-scanner-prefs-filter.test.ts`, `tests/unit/options-scanner-targets.test.ts`.  
**Optional env:** `OPTIONS_SCANNER_MAX_POSITIONS`, `OPTIONS_SCANNER_MAX_WATCHLIST_ROWS`, `OPTIONS_SCANNER_GROK_ENABLED`, `OPTIONS_SCANNER_GROK_MAX_CALLS`, `OPTIONS_SCANNER_MAX_ALERTS_PER_RUN`.

Related design: [`strategy-engine.md`](../xStrategyBuilder/strategy-engine.md) (fit-score contract; PLAN 245 / Kotlin engine umbrella).

---

## Outstanding questions

1. **Market window:** Heavy chain work is gated on US regular session via `resolveUsMarketDayContext`. Do we still need an explicit **inventory-only** or **off-hours** mode, or is session-only correct long-term?
2. **xChat-created jobs:** When users can start scanner work from chat, do rows live in **`admin_scheduled_tasks`** (with caps) or a **separate job table**?
3. **Per-holding alerts vs today:** Rationale is mostly in **`portfolio_recommendations.note`**; **`portfolio_alerts`** fire on **exit** signals only (**`BUY_TO_CLOSE`** / **`SELL_TO_CLOSE`** by side, not **`HOLD`**), deduped and capped per run. Product ask is **watchlist-like** coverage per option leg — see backlog below.
4. **Category split:** Converge on a single scheduled category when/if the full engine ships (today: `options_scanner` is canonical; avoid duplicate “phase” doc splits).

---

## Todo / backlog

- **Alert policy:** Decide informational alert per scanned leg (noisy) vs **threshold / confidence-gated** (closer to watchlist %) vs **non-HOLD only** with dedupe keys extended beyond **`[afp:…]`** + **`[close:…]`**.
- **`recommendation_rationale`:** Add optional first-class field on **`portfolio_recommendations`** if product needs structured rationale; optionally mirror a short excerpt into alert **`body`** (respect ~4k / Slack parity).
- **Reuse `portfolio_alerts`:** Keep **`tenantId` / `userId` / `portfolioId`** from portfolio context (`adminCreatePortfolioAlert` / list scoping) — **no** tenant-wide feed visible without per-user portfolio scope; admin aggregates stay **`global_admin`** only.
- **Structured alert metadata (shipped, v1):** Exit alerts from **`options_scanner`** persist **`metadata`** on **`portfolio_alerts`** (validated in `portfolio-alert-scan-metadata.ts`). Payload includes **`scoringFactorWeights`** (effective portfolio + tenant-default weights), **`thresholdsApplied`** (desk rule numbers actually used: loss/profit %, DTE windows, min OI/vol, high-IV short-put branch), **`metrics`** (DTE, mark, P/L%, IV, OI, vol, confidence, Grok flag), **`snoozeKeys`** (`symbolUpper`, `contractKey`), **`delivery`** (`immediateInApp`, `digestEligible`, `digestCadenceUser: unspecified` until user prefs exist), **`throttle`** (`maxAlertsPerRun`, `dedupeKey`). **`deltaAbs` / `thetaPerDayUsd`** are reserved **null** until positions/Greeks are populated. **Per-book DTE / |delta| / theta-per-day budgets** and **digest cadence / snooze** should move from **`userGoalBinding.note`** into real **`tenant_portfolio`** (or user prefs) fields; the summary/digest job should query `metadata.source === "options_scanner"` + `digestEligible` + cadence when implemented.
- **UI / filtering:** App/admin list APIs return **`metadata`**; `/portfolio/alerts` can surface threshold lines from **`metadata.thresholdsApplied`** / **`metrics`** without parsing **`body`** alone.
- **Full engine / ops hardening (not guaranteed in current path):** PLAN 245 / Kotlin **OptionsStrategyEngine** alignment, `option_scan_history` badges, per-option retries, circuit breaker / Prometheus-style metrics, dead-letter queues, **`UnifiedOptionsScannerConfig`** in Mongo — treat as **backlog** until implemented and tested.
- **Watchlist price scanner parity:** `persistPriceMoveAlerts` uses **`portfolioId + symbol`** cooldown; options scanner should document any chosen dedupe story next to the alert policy above.
