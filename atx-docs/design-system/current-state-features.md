# xFinance monorepo — current state (stack, features, docs & test gaps)

Last updated: 2026-04-08  
App semver (canonical): root **`package.json`** (runtime label via `src/lib/app-version.ts`).

This page is the **single entry** for “what ships today” across **Next.js (core product)** and **Kotlin/Spring (`atxfinance-backend`)**. Deep dives stay in linked docs; **outstanding work only** lives in [`PLAN.md`](../PLAN.md). PR hygiene aligns with [`.cursor/agents/reviewer.md`](../../.cursor/agents/reviewer.md) (contracts, OpenAPI parity, Secret Manager / deploy docs when OAuth, BFF, or SMTP paths change).

---

## Doc & roadmap index

| Topic | Where |
|--------|--------|
| Backlog (open items only) | [`PLAN.md`](../PLAN.md) |
| IBKR integration (phases, compliance) | [`ibkr-automation.md`](./ibkr-automation.md) · module [`src/modules/ibkr-integration/README.md`](../../src/modules/ibkr-integration/README.md) |
| Next API inventory | [`guides/api-endpoints.md`](../guides/api-endpoints.md) |
| Spring HTTP contract | [`sre-ops/atxfinance-backend-http-api.md`](../sre-ops/atxfinance-backend-http-api.md) |
| BFF / consolidation | [`sre-ops/api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md) |
| Deploy, secrets, desk SMTP | [`guides/deploy-and-ops.md`](../guides/deploy-and-ops.md) |
| OptionsStrategyEngine (shipped scoring path) | [`xStrategyBuilder/strategy-engine.md`](./xStrategyBuilder/strategy-engine.md) |
| Charts (Apex) | [`charts-apex.md`](./charts-apex.md) |
| Release history | [`sre-ops/release-notes.md`](../sre-ops/release-notes.md) |
| Scheduled scanners (Phase 3 shipped) | [`scheduled-task/scanners-phase3-plan.md`](./scheduled-task/scanners-phase3-plan.md) |

---

## 1) Core app — Next.js (primary product)

- **Framework:** Next.js App Router (`src/app/*`)
- **UI:** React 19, TypeScript, Tailwind + **`--xf-*`** tokens from [`atxfinance-brand-kit.css`](./atxfinance-brand-kit.css)
- **Validation:** Zod; **`npm run typecheck`** (strict)
- **Data:** MongoDB via route handlers and `src/modules/*`; session cookie **`xf_core_session`**
- **API docs:** `GET /api/openapi` (inventory); admin **Swagger** at **`/admin/api-docs`**
- **CI gate:** **`npm run ci:gate`** → lint, typecheck, **`docs:links`** (all `atx-docs/**/*.md`), Vitest (unit + integration), OpenAPI parity tests (`tests/integration/openapi-*.test.ts`)
- **Optional BFF:** When **`ATXFINANCE_BACKEND_ORIGIN`** points at the **Spring** service **HTTPS** origin, selected **`/api/*`** routes proxy per [`bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts). **xChat** (`/api/xchat/*`) stays **Next-authoritative** (streaming not on Spring until explicitly migrated — see `PLAN.md` / `api-consolidation-spring-backend.md`).

### Product surfaces (app_user shell)

Path prefixes for the shared product chrome are defined in **`APP_USER_PRODUCT_PATH_PREFIXES`** ([`surface-policy.ts`](../../src/modules/surface-policy.ts)): **`/xchat`**, **`/portfolio`**, **`/portfolios`**, **`/import-activity`**, **`/watchlist`**, **`/account`**, **`/workspace`**, **`/xoptions`**. Other user routes (e.g. **`/xcoach`**) exist but are not in that rail list unless extended there.

**Representative capabilities (non-exhaustive — see `api-endpoints.md`):**

- **xChat** — `POST /api/xchat/ask`, personas, plan limits; xAI-backed; history in Mongo (`xchat_logs` per product rules).
- **Portfolio / accounts / holdings** — app_user and admin paths; workspace portfolio cookie; Merrill/Fidelity CSV import + **`/import-activity`**.
- **Watchlist** — user-scoped store, quotes, optional chain glance; desk columns / IV-OI highlights (see release notes **3.1.x**). **Price alerts** (Next-side scanner thresholds + cooldown): `src/modules/watchlist/price-alert-service.ts`; roadmap context in **`PLAN.md`** (**240n** shipped).
- **xOptions** — strategy builder UI; strategy-options APIs (Yahoo + optional BFF to Spring).
- **xCoach** — learning surface (route present; detail in app).
- **Billing** — Stripe webhook + plan field on users; portal / tier polish in `PLAN.md`.
- **IBKR (Client Portal, gated `IBKR_ENABLED`)** — consent (`ibkr_user_consents`), sealed httpOnly CP session + issued-at cookie; **`GET /api/integrations/ibkr/*`** including **`…/accounts/{id}/snapshot`** (summary, positions, orders, trades); account allowlist vs **`portfolio/accounts`**; **`[ibkr/audit]`** logs with **`correlationId`** matching response **`X-Correlation-Id`**; UI **`/account/integrations/ibkr`**. No in-app broker OAuth yet; no live order POST (see `ibkr-automation.md`).
- **Strategy jobs (hardcore)** — Next BFF to Spring: `POST/GET /api/strategy-jobs`, turns through **`slots_complete`**; Redis hourly cap when **`REDIS_URL`** set; contract in `atxfinance-backend-http-api.md` + smoke parity needles.

### Quick pointers

- Implementation: **`src/app/`**, **`src/modules/`**
- Local dev: [`guides/local-development.md`](../guides/local-development.md)
- AGENTS runbook: [`AGENTS.md`](../../AGENTS.md)

---

## 2) Worker / API — `atxfinance-backend` (Kotlin/Spring)

Scope: scheduler/worker and **thin HTTP API** for portfolio/admin/strategy/RAG-support paths. Built from **`services/atxfinance-backend`** (repo-root Dockerfile can build this JAR).

- **Runtime:** Kotlin, Spring Boot, **JDK 21**
- **Build:** Gradle (`build.gradle.kts`); **`npm run build:backend`** runs **`./gradlew test`**
- **Data:** MongoDB (Spring Data Mongo)
- **Scheduling:** `@Scheduled` + **ShedLock** (Mongo lock collection)
- **Messaging:** Google **Pub/Sub** publisher when configured — **subscriber/consumer not implemented** (platform follow-on)
- **Observability:** Micrometer (GMP-oriented) + OTLP optional
- **HTTP:** REST (health, portfolio, admin, strategy, RAG, auth callback stubs); SpringDoc **2.x** — **`/swagger-ui.html`**

### Boot & configuration

- Entry: `com.atxfinance.backend.Application`
- Config: `AtxfinanceProperties` (`app.atxfinance.*`)
- Mongo: `MONGODB_URI` / `MONGODB_URI_B64` early resolution → `spring.data.mongodb.uri`
- Pub/Sub: `app.pubsub.project-id`, `app.pubsub.topic`, `app.pubsub.dlq-topic`

### Module map (packages)

- **`config/`** — properties, Mongo URI, ShedLock, executors
- **`web/`** — REST controllers
- **`portfolio/`**, **`admin/`** — CRUD, watchlist, positions, **platform `admin_delivery_channels`** (`in_app` \| `slack` \| **`email`**), tenant tasks, deploy notes
- **`audit/`** — audit writers + admin query
- **`strategy/`** — strategy jobs, Yahoo client, **`OptionsStrategyEngine`** (scoring + scanner alignment — see `strategy-engine.md`)
- **`rag/`** — ingestion helpers, xAI collection clients
- **`session/`** — session cookie parse (name aligns with Next: **`xf_core_session`**)
- **`notify/`** — Slack, **desk SMTP** (`DeskSmtpSender`) for proxied admin test-send (parity with Next `desk-smtp.ts`)

### Notable Mongo collections (Spring + shared)

Centralized in `AtxfinanceProperties`. Examples: **`tenant_portfolio`**, **`portfolio_accounts`**, **`portfolio_positions`**, **`portfolio_watchlists`**, **`strategy_jobs`**, **`xchat_personas`**, **`core_users`**, **`admin_audit_events`**, **`admin_scheduled_tasks`**, **`admin_delivery_channels`**, **`app_user_recommendations`**, RAG (`xai_collections`, `xchat_rag_chunks`, `xchat_logs`), etc.

### HTTP (selected)

- **Health:** `GET /actuator/health`, `GET /api/health`, `GET /api/backend/health`
- **Portfolio (session):** `GET|PATCH /api/portfolios/{portfolioId}` (and nested resources per `web/`)
- **Admin / app:** access requests, audit, broker import, recommendations, strategy, RAG — full list in **`atxfinance-backend-http-api.md`**

### Scheduling & deployment baseline

- ShedLock default max lock **PT5M**; scheduler thread pool (e.g. core/max 4)
- **Cloud Run (typical):** concurrency **1**, **1 vCPU**, **1 GiB**, HTTP **:8080**

### Run locally

```bash
cd services/atxfinance-backend
./gradlew bootRun   # env from repo-root .env as needed
```

Service README: [`services/atxfinance-backend/README.md`](../../services/atxfinance-backend/README.md)

---

## 3) Desk email (Next + Spring)

When SMTP + **`DESK_EMAIL_FROM`** are configured (see **`.env.example`** / `src/lib/env.ts`):

- **Next** — portfolio desk channels, price-alert paths, etc. (`src/lib/desk-smtp.ts`)
- **Spring** — proxied admin **`POST /api/admin/delivery-channels/test`** (`DeskSmtpSender`); failures → **502**
- **Ops:** With BFF on, **both** services that execute those paths need matching Secret Manager bindings — [`deploy-and-ops.md`](../guides/deploy-and-ops.md). UI: **`/admin/delivery-channels`**.

---

## 4) Testing matrix (what runs in CI vs optional)

| Layer | Command / location | Notes |
|--------|-------------------|--------|
| **Next gate** | **`npm run ci:gate`** | lint + typecheck + **markdown link check** + full Vitest suite + OpenAPI inventory tests |
| **Vitest unit** | `tests/unit/**` | Fast, mocked deps |
| **Vitest integration** | `tests/integration/**` | Route/module tests; **no** live Mongo required for default suite |
| **OpenAPI parity** | `tests/integration/openapi-*.test.ts` | **`CURRENT_STATE_ROUTES`** must match implemented routes |
| **Smoke** | `tests/smoke/**`, `npm run smoke:*` | Backend HTTP parity needles, optional live smokes (skipped unless env flags) |
| **Spring** | **`./gradlew test`** in `services/atxfinance-backend` | Required before prod when Kotlin changes; **`npm run build:backend`** in CI stack |
| **Live stack** | **`npm run test:integration:live`** | Docker Compose + Mongo + backend + Redis — opt-in |

---

## 5) Known gaps — tests & docs (reviewer-style, consolidated)

These are **documented** backlog items or **conscious** holes; do not treat as shipped.

| Gap | Pointer |
|-----|---------|
| **xChat on Spring + BFF streaming** | `PLAN.md` · `api-consolidation-spring-backend.md` |
| **Strict JSON Schema artifact v2** (strategy jobs) | `PLAN.md` · `atx-multi-agent.md` |
| **`POST /api/import/broker/clean`** — no dedicated integration test (destructive) | `PLAN.md` § test/doc follow-ups · `api-endpoints.md` |
| **Admin `PATCH/DELETE …/positions/{id}`** — Next until BFF registry + Kotlin parity | `PLAN.md` |
| **Pub/Sub consumer** on Spring | This doc §2 · `PLAN.md` / release notes |
| **IBKR** — no broker OAuth/token refresh in-app; no order placement | `ibkr-automation.md` |
| **Stripe** — customer portal / `getPlanLimits()` polish | `PLAN.md` |
| **xChat** — privacy-first history, paste, voice, xMoney billing | `PLAN.md` priorities **701–704** |
| **OptionsStrategyEngine** — extend scoring / desk notification providers | `PLAN.md` · `reviewer.md` §245 |

**Governance:** Tenant workspace limits, persona changes, and SMTP/BFF/deploy workflow edits should update **`CURRENT_STATE_ROUTES`**, relevant **`atx-docs/guides/*`**, and **`tests/unit/surface-policy.test.ts`** when **`APP_USER_PRODUCT_PATH_PREFIXES`** or public contracts change.

---
### UX Performance (current baseline)
- **Core Web Vitals targets**: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 on /portfolio, /xoptions, /watchlist, /xchat
- **Monitoring**: [to be added — see PLAN.md]
- **CI enforcement**: Lighthouse CI on key pages (planned)
- **High-risk surfaces**: ApexCharts, watchlist real-time updates, IBKR snapshots, strategy builder

#### xChat, xOptions, /portfolios & /portfolio — loading targets (shipped baseline)
- **First Contentful Paint** ≤ 1.2 s
- **Largest Contentful Paint** ≤ 2.0 s
- **Interaction to Next Paint** ≤ 200 ms
- **High-risk**: ApexCharts, IBKR snapshot, long xChat history

### xChat & Portfolios targets (2026-04-07 LHCI)
- /xchat: 0.89 → ≥0.95 (history fetch + dynamic input)
- /portfolios: 0.89 → ≥0.95 (virtualized list)
- All critical routes now target LCP ≤ 2.0 s, INP ≤ 200 ms

---

## References (unchanged deep dives)

- `services/atxfinance-backend/README.md`
- `atx-docs/sre-ops/atxfinance-backend-http-api.md`
- `atx-docs/PLAN.md`
- `atx-docs/guides/deploy-and-ops.md`
- Kotlin sources: `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/**`
