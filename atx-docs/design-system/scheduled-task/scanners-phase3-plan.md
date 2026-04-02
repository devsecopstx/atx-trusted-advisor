# Scheduled scanners — Phase 3 plan (shared platform + tenant jobs)

**Status:** Plan (not implemented). Builds on Phase 2 options scanner work (`options-scannerp2.md`, `options-scanner-engine.ts`) and the **admin tenant task** model (`schedule-tasks-admin.md`).

**Goals**

1. **15-minute option chain cache** — reusable across any job that calls Yahoo option chains (options scanner, expiration/roll manager, income projector legs, etc.); single TTL policy, tenant-safe keys, observability hooks.
2. **Circuit breaker** — reusable per **tenant** + **upstream** (e.g. Yahoo batch failures); pause further calls for a cooldown, emit structured logs / optional Slack; integrate with `admin_task_runs` output.
3. **New tenant-level scheduled jobs** — each future scanner is a **category** executed by Next (`task-runner.ts`) or stubbed in Kotlin when BFF runs the tick; **created/edited/run** only via **`/admin/tasks`** (`global_admin`, tenant-scoped rows in `admin_scheduled_tasks`).
4. **Shared components** — one small **scanner runtime** package (conceptually under `src/modules/scanner/` or `src/modules/scheduled-jobs/`) so corporate events, rebalance, risk, tax-loss, etc. do not reimplement cache/breaker/retry.

---

## Admin & configuration (unchanged contract, extended catalog)

| Mechanism | Location / notes |
|-----------|------------------|
| **Task definitions** | Mongo `admin_scheduled_tasks` — tenant-scoped; no portfolio-bound tasks in UI. |
| **CRUD + Run now** | `/admin/tasks`, `POST/PATCH/DELETE /api/admin/tasks`, `POST /api/admin/tasks/{id}/run`. |
| **Execution** | `executeScheduledTask` → `runScheduledCategory` → per-category handler (`task-runner.ts`). |
| **Category allowlist** | `src/lib/scheduled-task-category-schema.ts` + Kotlin allowlist when BFF enabled — **new categories must be added in both** for parity. |
| **Pre-defined jobs** | Product can ship **default cron presets** per category (env or seed JSON); admins **enable/disable** and adjust cron — no new surface required beyond extending category list + docs. |

Phase 3 **does not** add a separate “job template” collection unless product later requires it; **pre-defined** means documented defaults + optional seed rows for new tenants.

---

## Shared reusable components (implementation outline)

### A. Option chain cache (15-minute TTL)

| Aspect | Proposal |
|--------|----------|
| **Scope** | In-process LRU + **Mongo** (or Redis if already available for tenant) for multi-instance Cloud Run — **decision in 3a**: start in-process + Mongo `scanner_option_chain_cache` (or namespaced keys in existing cache) so all workers see shared TTL. |
| **Key** | `{ tenantId?, underlying, expirationYmd, chainFingerprint }` — align with `fetchYahooOptionChainForExpiration` inputs. |
| **TTL** | 900s (15m), configurable `OPTIONS_CHAIN_CACHE_TTL_SEC`. |
| **API** | `getCachedOptionChain` / `setCachedOptionChain` — used by options scanner, expiration/roll manager, income projector when it needs legs. |
| **Invalidation** | Manual via admin only if needed; normal path is TTL expiry. |

### B. Circuit breaker (tenant + provider)

| Aspect | Proposal |
|--------|----------|
| **Trigger** | Rolling window failure rate (e.g. last N Yahoo calls per tenant) OR consecutive failures ≥ threshold. |
| **Open state** | Stop new outbound Yahoo requests for **tenantId** (or global if no tenant) for **15 minutes** (align with cache; configurable `SCANNER_CIRCUIT_COOLDOWN_SEC`). |
| **Half-open** | Probe with single request after cooldown; close on success. |
| **Storage** | Mongo `scanner_circuit_state` or in-memory + Mongo for multi-instance consistency (prefer Mongo for Cloud Run). |
| **Output** | `admin_task_runs.output` includes `circuit_open=true` / `suppressed_calls=N`; optional Slack via existing `scheduled-task-slack-notify`. |

### C. Scanner job shell (wrapper)

Shared helper for all **Phase 3 scanners**:

- Resolve **tenant** + **market calendar** (reuse `resolveUsMarketDayContext` where relevant).
- Acquire **budget** (max symbols, max API calls per run — env).
- Call **cache** → **Yahoo** on miss → **set cache**.
- Record **breaker** state; never throw away whole run — partial success summaries (pattern from options scanner).

---

## Scanner catalog (Phase 3 job specs)

Each row links the **design stub**; implementation order is suggested by dependency on **chain cache** and **portfolio data**.

| Job (stub) | Doc | Suggested `category` id (TBD in schema) | Depends on cache / breaker | Notes |
|------------|-----|----------------------------------------|----------------------------|--------|
| **Corporate Events & News** | [corporate-events-news-scanner.md](./corporate-events-news-scanner.md) | `corporate_events_scanner` | Breaker (Yahoo quotes/news) | Earnings/ex-div/news; watchlist + holdings only. |
| **Income & Cash-Flow Projector** | [income-cash-flow-projector.md](./income-cash-flow-projector.md) | `income_cash_flow_projector` | Cache + breaker for option legs | Dividends + premium projection; daily post-market. |
| **Options Expiration & Roll Manager** | [options-expiration-roll-manager.md](./options-expiration-roll-manager.md) | `options_expiration_roll_manager` | **Heavy** cache + breaker | Close to current options scanner; shares chain fetch. |
| **Rebalance Scanner** | [rebalance-scanner.md](./rebalance-scanner.md) | `rebalance` (exists — replace stub) | Breaker for quotes | Allocation drift; may use only equity quotes first. |
| **Risk & Concentration Monitor** | [risk-concentration-montitor.md](./risk-concentration-montitor.md) | `risk_concentration_scanner` | Breaker for quotes | Filename typo **montitor** retained until rename. |
| **Tax-Loss Harvest Scanner** | [tax-loss-harvest-scanner.md](./tax-loss-harvest-scanner.md) | `tax_loss_harvest_scanner` | Breaker | Taxable accounts + wash-sale rules. |

**Options scanner (existing)** continues to consume cache/breaker first as the reference implementation; **options-expiration-roll-manager** should share the most code with it.

---

## Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **3a — Platform** | Mongo-backed **chain cache** module + **circuit breaker** module + unit tests; wire **options scanner** to both (feature-flagged). |
| **3b — Categories** | Add new category strings to Zod + Kotlin allowlist; **stub handlers** in `task-runner.ts` (success string + delay) for each new id until logic ships; document default crons. |
| **3c — Verticals** | Implement scanners in priority order: **expiration/roll** (chain-heavy) → **corporate events** → **risk** → **rebalance** (enhance) → **tax-loss** → **income projector** (most cross-cutting). |

---

## Success criteria (Phase 3 exit)

- [ ] Single **chain cache** + **circuit breaker** used by at least **two** job types (options scanner + one new).
- [ ] **No duplicate Yahoo storm** when hourly tasks align — cache hit rate visible in logs/metrics.
- [ ] Breaker **opens** under synthetic failure tests; **half-open** recovers.
- [ ] New categories **admin-manageable** (list/create/run) with **documented** default schedules.
- [ ] Each linked stub doc updated with **“Phase 3 — see scanners-phase3-plan.md”** when that job ships.

---

## References

- Admin tasks: [schedule-tasks-admin.md](./schedule-tasks-admin.md)
- Options Phase 2: [options-scannerp2.md](./options-scannerp2.md)
- Task runner: `src/modules/core-admin/task-runner.ts`
- Category schema: `src/lib/scheduled-task-category-schema.ts`
