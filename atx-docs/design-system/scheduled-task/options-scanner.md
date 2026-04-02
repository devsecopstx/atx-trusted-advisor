# Options Strategy Scanner Job

**Service id (categories):** `options_scanner` · `daily_options_scanner`  
**Module:** `runOptionsStrategyScanner` — `src/modules/strategy-options/options-strategy-scanner.ts`  
**Type:** Tenant-admin scheduled background job (`admin_scheduled_tasks`), same pipeline as other core scanners

**Governance (reviewer / SRE):** Jobs are created only via **`/admin/tasks`** (global admin, tenant-scoped). There is no portfolio-level scheduler UI. **Future (TBD):** end-users might create an options-related job from **xChat** — not shipped until scoped; see `.cursor/agents/reviewer.md` § *Scheduled tasks (admin)*.

---

## Implementation (Next.js) — shipped today

| Piece | Location |
|--------|----------|
| **Job entrypoint** | `runOptionsStrategyScanner(task)` — `src/modules/strategy-options/options-strategy-scanner.ts` |
| **Scheduled task routing** | `runScheduledCategory` → `options_scanner` **or** `daily_options_scanner` → same function — `src/modules/core-admin/task-runner.ts` |
| **Admin schedule / cron** | `/admin/tasks` — `admin_scheduled_tasks`; default cron via `SCHEDULED_TASK_CATEGORY_DEFAULT_CRON` in `src/lib/scheduled-task-category-schema.ts`; manual run: `POST /api/admin/tasks/{taskId}/run` |
| **Core scanner audit** | `isCoreScannerCategory` includes both categories — `logCoreScannerRunAudit` in `executeScheduledTask` (`task-runner.ts`); payloads include `summaryForDiff`, fingerprints, size caps (`301n` / `CORE_SCANNER_AUDIT_*`). |
| **Slack run summary** | Optional: task `deliveryChannelTarget` → `admin_delivery_channels` (Slack webhook), same pattern as other scheduled tasks (`scheduled-task-slack-notify.ts`) |

### Current behavior (market-open path)

When the US regular session gate says **open**, the job also:

1. Counts **portfolios** and **accounts**; loads strategy catalog + preference summaries (same as before).
2. Loads **`options_strategy`** filter rows (`adminListOptionsStrategyFilterRows`) and merges JSON **`filters`** via **`mergeOptionsStrategyFilters`** (`options-scanner-prefs-filter.ts`) — denylist, allowlist union, DTE bounds, `optionTypes`, `sources`. Applies **`filterOptionScanTargetsByMergedPrefs`** before the recommendation pass (`scan_targets` / `prefs_after` / `prefs_active` in task output).
3. Loads tenant-scoped **option positions** from `portfolio_positions` (and watchlist rows); builds merged scan targets, then prefs-filtered list.
4. Runs **`processOptionRecommendationsPass`** (`options-scanner-engine.ts`): batched Yahoo chains (**`chain_batches`** = unique underlying|expiration groups), rule-based + optional Grok rationale, **`rankedSignals`** (top confidence, `rank_top=` in output), upserts **`portfolio_recommendations`** (`[options-scanner]` notes), optional **`portfolio_alerts`** on SELL (capped per run).

**`filters` JSON (admin `options_strategy` documents):**

| Field | Type | Merge rule |
| --- | --- | --- |
| `underlyingDenylist` | `string[]` | Union → block if ticker (uppercased) in set |
| `underlyingAllowlist` | `string[]` | Union across strategies; if any non-empty allowlist exists, target must be in union |
| `minDte` / `maxDte` | number | `max(minDte)`, `min(maxDte)` across rows |
| `optionTypes` | `("call"\|"put")[]` | Union of types |
| `sources` | `("position"\|"watchlist")[]` | Union |

When the market gate **skips** (holiday / after hours), recommendations are not written; output still includes strategy/prefs inventory counts.

Output includes `scan_targets=… prefs_after=… chain_batches=… rank_top=… rec_examined=…` and related fields. See **`options-scannerp2.md`** for env flags and detail.

**Tests:** `tests/unit/options-strategy-scanner.test.ts`, `tests/unit/options-scanner-engine.test.ts`, `tests/unit/options-scanner-prefs-filter.test.ts`.

---

## Purpose (product)

**Target end state** (aligned with **PLAN 245** / **OptionsStrategyEngine** — `.cursor/agents/reviewer.md`, `.cursor/agents/sre.md`): a tenant-scoped job that eventually drives **ranked strategy recommendations** from chain data, prefs, and the pipeline in [`strategy-engine.md`](../xStrategyBuilder/strategy-engine.md) (orchestrator, fit scores, legs, rationale).

**Current shipped value:** proves the scheduled path and keeps **strategy + preference inventory** visible in run output for ops and audits; seeds alignment with RAG / admin strategy prefs.

---

## Roadmap (not implemented in `runOptionsStrategyScanner` yet)

The older draft in this file described Grok-enhanced chain scans, `option_scan_history`, Prometheus, circuit breakers, per-option retries, dead-letter queues, and **`UnifiedOptionsScannerConfig`** — **those are not in the v1 code path.** Treat them as **product/engineering backlog** unless/until implemented.

Intended integration point for the full engine: **`daily_options_scanner`** (and/or **`options_scanner`**) should invoke the same brain as interactive **xOptions** / strategy engine once **PLAN 245** lands — reviewer doc calls out **`daily_options_scanner`** as the single job brain candidate.

**SRE (when scale matters):** batch runs on Cloud Run should respect Mongo connection limits, timeouts on scheduled execution, and **structured, safe logs** (task id, tenant mask, counts — no raw PII). Today, primary observability is **`admin_task_runs.output`** + optional Slack + core_scanner audit rows — not dedicated Prometheus metrics for this job.

---

## Alignment checklist

| Area | Status |
|------|--------|
| Tenant-only admin tasks | Aligned — no portfolio task UI |
| BFF / new HTTP routes for scanner | Not required for v1 (in-process only) |
| OpenAPI | No dedicated public route; inventory is indirect via admin tasks APIs |
| Kotlin backend | When BFF runs scheduler, categories that are not special-cased in JVM may simulate — Next remains source of truth for `runOptionsStrategyScanner` when not proxied |

---

## Open questions (for product / eng)

1. **Category split:** `options_scanner` vs `daily_options_scanner` today share one implementation (output label differs). Should product keep both template rows in admin UI or converge to a single category when the engine ships?
2. **Market window:** Unlike `price_scanner`, v1 does **not** skip outside equity hours — runs whenever scheduled. Should options inventory respect US session / `resolveUsMarketDayContext` once chain I/O exists?
3. **xChat-created jobs:** When users can create scanner jobs from chat, do they create **`admin_scheduled_tasks`** rows (with caps) or a separate job table — needs explicit design before build.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-02 | Rewrote to match **`runOptionsStrategyScanner`** v1; roadmap; governance. **270n:** merged `filters`, prefs-filtered targets, `chain_batches` + `rank_top`. **280:** umbrella in `strategy-engine.md`. |
