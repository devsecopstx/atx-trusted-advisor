# Options strategy scanner — open questions & backlog

**Category:** `options_scanner`  
**Code:** `runOptionsStrategyScanner` / `executeOptionsStrategyScannerJob` — `src/modules/strategy-options/options-strategy-scanner.ts`, `options-strategy-scanner-job.ts`; recommendation pass — `options-scanner-engine.ts`; prefs merge — `options-scanner-prefs-filter.ts`. Routed in `src/modules/core-admin/task-runner.ts`; cron/UI — `/admin/tasks`. **Governance:** tenant-admin jobs only until xChat-created flows are designed (`.cursor/agents/reviewer.md` — scheduled tasks).

**Tenant isolation (app users):** Each `admin_scheduled_tasks` row for `options_scanner` (and `options_expiration_roll_manager`) **must** set **`tenantId`**. If it is missing, the job **skips** (no chain scan, no `portfolio_recommendations` writes) — an empty Mongo scope would otherwise touch all tenants. Writes use **`jobTenantId`**: `adminCreateRecommendationForPortfolio` / `adminUpdateRecommendationForPortfolio` refuse rows unless the target **portfolio’s `tenantId`** matches the job’s tenant. **Reads:** app users only see recs via **`GET /api/portfolios/:portfolioId/recommendations`** after **`requirePortfolioForSessionUser`** + **`listRecommendations`** (`userId` + **exact** session `tenantId` + portfolio), so they never cross tenants.

**Tests:** `tests/unit/options-strategy-scanner.test.ts`, `tests/unit/options-scanner-engine.test.ts`, `tests/unit/options-scanner-prefs-filter.test.ts`, `tests/unit/options-scanner-targets.test.ts`, `tests/unit/options-scanner-persona.test.ts`.  
**Scope:** One task run = one `tenantId`. The job loads **all** option positions with that `tenantId` (every user’s portfolios in the tenant) and **all** tenant `portfolio_watchlists` documents for option-line targets — same sweep pattern as `watchlist_price_scanner`. **Optional env caps** (cost control on huge tenants): `OPTIONS_SCANNER_MAX_POSITIONS`, `OPTIONS_SCANNER_MAX_WATCHLIST_ROWS` — positive integer limits rows after load; **unset or `0`** = no cap. Also: `OPTIONS_SCANNER_GROK_ENABLED`, `OPTIONS_SCANNER_GROK_MAX_CALLS`, `OPTIONS_SCANNER_MAX_ALERTS_PER_RUN`, `OPTIONS_SCANNER_PERSONA_NAME` (default **`finance-advisor`**), `OPTIONS_SCANNER_PERSONA_DISABLE=1`.

**Grok refinement (Next.js):** When `OPTIONS_SCANNER_GROK_ENABLED` is on, `processOptionRecommendationsPass` loads a **published** xPersona by **name** (`resolveOptionsScannerPersonaContext` in `options-scanner-persona.ts`): **`systemPrompt` + `overridePrompt`**, **`model`**, **`temperature`**, and **`xapi.tools`** (via `personaXapiToolsToXaiRequestTools`). Calls use **`/v1/responses`** (`respondWithXaiToolLoop` or `respondWithXai`). Local tools: **`yahoo_finance`** → live quote; **`atx_function`** → JSON error (`options_scanner_no_workspace`) because scheduled jobs have no signed-in user. RAG / `file_search` run hosted-side like xChat. If the persona is missing, draft/archived, or persona mode is disabled, the job falls back to the previous fixed system prompt + `chatWithXai` (chat completions).

**Kotlin tick:** `options_scanner` on the JVM still runs **`OptionsStrategyEngine.scheduledTaskDryRunOutput`** only; full chain + Grok pass remains on **Next**.

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
