# Scanner jobs — tenant pattern & desk mutations (reviewer contract)

**Audience:** `.cursor/agents/reviewer.md`, engineers changing **`task-runner.ts`**, **`ScheduledCategoryResult`**, or Mongo writes from scheduled tasks.

**Goal:** One mental model for **tenant-scoped system jobs**: when they **read**, when they **write** desk state (recommendations, watchlist rationale/status, alerts), and what **tests** should exist.

---

## Tier A — Desk mutators (must be tenant-safe + tested)

These jobs **change Mongo documents** or **create portfolio alerts** that app users see. They must:

| Rule | Rationale |
|------|-----------|
| **`tenantId` on `admin_scheduled_tasks`** | **Per-tenant row:** same as today — one tenant per execution. **System-wide row** (`tenantId` omitted): Next **`executeScheduledTask`** fans out to **every** `core_tenants._id` (one internal run per tenant; desk writes stay tenant-scoped). Scanner handlers that require `tenantId` receive it on each fan-out slice. |
| **Mongo queries** | Use `tenantId` (or shared helpers like `tenantScopeFilter`) on positions, watchlists, recommendations, etc. |
| **Writes to recommendations / alerts** | Pass **`jobTenantId`** (or equivalent) into repository upserts so rows cannot attach to another tenant’s portfolio. |
| **US desk window** | Use **`resolveUsMarketDayContext`** (or shared job input) for market-hours behavior; **`bypassMarketWindow: true`** only from **`POST /api/admin/tasks/{id}/run`** via **`executeScheduledTask`**. |
| **`ScheduledCategoryResult`** | Prefer **`auditDetails`** with stable keys (`itemsUpdated`, `alertsCreated`, `durationSeconds`, …) for **`logCoreScannerRunAudit`** / **`extractSummaryForDiff`**. |
| **Output string** | Prefix category id (`options_scanner:`, `watchlist_price_scanner:`, …) and include counts for ops. |

| Job | Entry | Primary writes / side effects |
|-----|--------|------------------------------|
| **`options_scanner`** | `runOptionsStrategyScanner` → `options-strategy-scanner-job.ts` | `portfolio_recommendations`, optional **`portfolio_alerts`**, Grok rationale; prefs filter. Enumerates **all** tenant option legs (`portfolio_positions` + `tenantId`) and **all** tenant watchlist docs for option-line rows (same “every user document in tenant” idea as `watchlist_price_scanner`). Optional env caps: `OPTIONS_SCANNER_MAX_POSITIONS`, `OPTIONS_SCANNER_MAX_WATCHLIST_ROWS` (`0` / unset = no cap). |
| **`watchlist_price_scanner`** | `runWatchlistPriceScanner` | `portfolio_watchlists` symbol rows (`lastPrice`, `rationale`, `rowStatus`), optional price-move **alerts**; optional persona Grok. |

### `watchlist_price_scanner` — tenant · user · rows

- **Scheduled task scope:** One run is **one `tenantId`** on the `admin_scheduled_tasks` row (`reviewer.md` — tenant-level tasks only; no portfolio-scoped enqueue).
- **Enumeration:** `listWatchlistsForTenantScope(tenantId)` loads **every** `portfolio_watchlists` document with that `tenantId`. In the product model, **each tenant user** has a canonical user watchlist (same doc the app-user `/api/portfolios/{id}/watchlist` path reads). A tenant with *N* onboarded users with watchlists → **up to N** documents processed per tick (not merged across users).
- **Per-document work:** For each document, **every** element of `symbols[]` is scanned in order. **Duplicate tickers** (two rows both `TSLA`, different strategies/theses) stay independent: quotes are keyed by normalized symbol, but **writes** use `symbolRowIndex` + `updateWatchlistSymbolPrices` index mode so each row gets its own rationale / `lastPrice` / `rowStatus`. Price-move evaluation uses the same index when present (`price-alert-service.ts`).
- **Read path parity:** `normalizeWatchlistDocumentSymbols` (Next + Kotlin `WatchlistSymbolCodec`) **preserves** duplicate rows so the desk UI matches Mongo after a scan.
- **SRE note:** Multi-tenant ticks are **sequential per job** (watchlists loop); Yahoo batch size and persona Grok caps drive cost — see env in `watchlist-scanner-persona.ts` / batch quotes module. Empty tenant → success with `watchlists=0`.
| **`price_scanner`** | `executePriceScannerJob` | Watchlist `lastPrice`, **`tenant_market_calendar`** snapshot. |
| **`options_expiration_roll_manager`** | `runOptionsExpirationRollManager` → `executeOptionsExpirationRollJob` | Roll/recommendation path (shared options job stack); desk window + bypass. |

**Tests (Vitest) — keep green when changing Tier A:**

- `tests/unit/options-strategy-scanner.test.ts` — tenant skip, market bypass, prefs.
- `tests/unit/options-scanner-engine.test.ts`, `options-scanner-persona.test.ts`, targets/prefs as relevant.
- `tests/unit/update-watchlist-symbol-prices.test.ts` — symbol merge / rationale / `rowStatus`.
- `tests/unit/watchlist-scanner-*.test.ts` — rationale appendix, persona wiring.
- `tests/unit/core-scanner-service.test.ts` — audit / category membership.

**Gaps to treat as conscious debt (extend when behavior grows):**

- Integration test: **`POST /api/admin/tasks/.../run`** for **`watchlist_price_scanner`** with mocked Mongo + Yahoo (heavy; optional).
- **`price_scanner`** job: dedicated unit file for **`executePriceScannerJob`** skip/success paths (partially covered via scanner shared tests only).

---

## Tier B — Analytics / read-mostly (summary output)

Phase 3 jobs in **`phase3-scanner-jobs.ts`** compute **tenant-scoped** metrics and return **`output` strings**. They do **not** today persist recommendations, watchlist rationale, or portfolio alerts (narrative is in the run log / Slack).

| Job | Notes |
|-----|--------|
| **`corporate_events_scanner`** | Yahoo quote hints; `tenantId` via `loadEquitySymbolsForTenant` / `countTenantPortfolios`. |
| **`risk_concentration_scanner`** | HHI / max weight from positions + quotes. |
| **`tax_loss_harvest_scanner`** | Loss candidates vs threshold. |
| **`rebalance`** | Equal-weight drift. |
| **`income_cash_flow_projector`** | Option legs summary + optional chain sample; uses **`tenantScopeFilter`**. |

**Expected pattern:** Always pass **`task.tenantId`** into shared loaders; empty book → **`success`** with **`positions=0` / `symbols=0`** style output (no throw).

**Tests:** `tests/unit/phase3-scanner-jobs.test.ts` — smoke + empty-data paths with mocked **`phase3-scanner-shared`** / **`getDb`**. Extend when a Tier B job starts **writing** desk rows — promote it to Tier A rules and add mutation tests.

---

## Tier C — Non-scanner scheduled work

**`user_access_requests`**, **`user-history`**, **`sync-broker`**, stubs (**`compliance`**, **`notifications`**) — different contracts; not covered by this doc.

---

## `extractSummaryForDiff` (audit dashboards)

Stable keys live in **`src/modules/scanner/core-scanner-service.ts`**. When adding **`auditDetails`** fields that ops should diff, add the key to the **`preferred`** set (or document why it stays dynamic-only).

---

## Kotlin scheduler

Kotlin tick may **noop** for some categories while **Next** runs the real job. Do not assume JVM execution updates Mongo for **`options_scanner`** / **`watchlist_price_scanner`** full chain — see **`schedule-tasks-admin.md`** and backend admin task service.
