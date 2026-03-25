# Backlog & migration notes

Living backlog for atx app, xChat, admin, and BFF. **Frontend marketing details** that are still open live under **§ Stripe & billing**; shipped UI chrome is noted only by reference.

**Docs index:** [README.md](./README.md) · Phase 1 multi-agent: [atx-xchat/atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) · BFF: [atx-sre-ops/api-consolidation-spring-backend.md](./atx-sre-ops/api-consolidation-spring-backend.md) · **NL / strategy preflight:** [atx-xchat/xchat-nl-collect-inputs.md](./atx-xchat/xchat-nl-collect-inputs.md)

---

## Today / near-term (pick from here)


| Priority | Item                                     | Notes                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | **Spring BFF parity (admin portfolios)** | **Shipped (accounts):** `GET/POST …/portfolios/{id}/accounts`, `PATCH/DELETE …/accounts/{accountId}` — BFF + Kotlin (`AdminPortfolioAccountsController`). **Still Next-only:** portfolio root (`GET/POST /api/admin/portfolios`, `PATCH/DELETE …/{id}`), watchlist, positions, tasks, alerts, recommendations, delivery-channels — add Kotlin + `bff-proxy-routes` when ready. |
| 2        | **Accounts subpage UX**                  | `/admin/portfolios/[portfolioId]/accounts` — align **Save changes** batch pattern + friendly user/account labels with main portfolios table.                                                                                                                                               |
| 3        | **Default portfolio invariant**          | If a user has multiple portfolios, enforce **exactly one** `isDefault: true` (UX + server guard; align with Mongo partial unique index).                                                                                                                                                   |
| 4        | **Admin portfolio audit**                | Log create/update/delete (optional CSV) via `admin_audit_events` / audit pipeline.                                                                                                                                                                                                         |
| 5        | **NL + strategy job tool (xChat)**       | Wire **nl**-gathered slots to `/api/strategy-jobs` (BFF) from xChat when product-ready; document tool schema + persona copy. Until then, personas use **nl** only (see `xchat-nl-collect-inputs.md`).                                                                                      |
| 6        | **Admin seed — RAG sync**                | Optional `SEED_RAG_FROM_REPO` (or similar): ingest `atx-rag-collection/xpersonas/`, `finance-reference-docs/`, `example-prompts/`, `options-strategy/` into team collections and/or Mongo `xpersonas`; tests + `generate-docs`.                                                            |


**Deferred product TODOs**

- Restore `LoginProductPanel` on `/login` or fold plan tiers into registration / access-request flow.
- Google OAuth — `/api/auth/google/login` + callback + env; enable login page button when shipped.

---

## Phase 1 — xChat → xStrategyBuilder multi-agent

**Canonical:** [atx-xchat/atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./atx-xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./atx-xchat/context-routing-multi-agent-policy.md)

Order: **Backend orchestrator** → **LLM + artifact** → **SRE** → **Frontend** → **Reviewer**.

### Chunk 1 — Orchestrator (partially shipped)


| Step    | Deliverable                                                                                                                                    | Status                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1.1–1.2 | Mongo `strategy_jobs`, Spring `StrategyJobService` + `StrategyJobsController`, hourly cap + idempotency, Next BFF proxy + 503 when backend off | **Shipped (initial)**                        |
| 1.3     | Redis hot keys / RL counters                                                                                                                   | **Open** (optional; caps work without Redis) |
| 1.4     | JVM tests                                                                                                                                      | **Shipped** (`StrategyJobServiceTest` etc.)  |


### Chunk 2 — LLM tier + artifact v1


| Step    | Deliverable                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2.1–2.4 | Context bundle, async xAI path, artifact v1 validation + error codes, BFF route parity docs + `backend-http-api-parity` smoke |


**Exit:** Validated handoff payload + stable `jobId` / `correlationId`; documented failure codes.

### Chunk 3 — SRE / platform

Env matrix, observability (`correlationId`, `jobId`, `personaId`, `effectiveModel`, no raw PII), queue if p95 > SLO, per-tenant RL at orchestrator edge.

### Chunk 4 — Frontend

xStrategyBuilder: poll/push job status, render artifact, deep link `jobId`. Optional xChat entry to start/resume job without client-side orchestration state. Error UX ↔ backend codes.

### Chunk 5 — Reviewer / governance

OpenAPI parity, `atxdesign-review-audit` gaps, product doc parity (`xchat-tools-guide.md`, `context-routing-multi-agent-policy.md`).

**Open question:** [Phase: user_history_agent](#phase-xchat-chat_history--xai-collection-user_history_agent) vs TEAM-only `XAI_TEAM_ID` policy — reconcile before per-user collection writes.

---

## SRE status


| Area                 | Status             | Notes                                                                                                                       |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| BFF frontend→backend | Verified           | `bff-proxy-routes.ts`; admin **portfolio accounts** CRUD proxied when `ATXFINANCE_BACKEND_ORIGIN` set. Other `/api/admin/portfolios/**` (root + nested) still Next-only until Kotlin. |
| Auth / OAuth         | Next authoritative | See [auth-oauth-spring-dual-run.md](./atx-sre-ops/auth-oauth-spring-dual-run.md).                                           |
| Deploy               | GitHub Actions     | `AGENTS.md` + `.github/workflows/deploy-cloud-run.yml` (staging) / production workflow.                                     |
| CI gate              | Pass               | `npm run ci:gate` — lint, typecheck, tests.                                                                                 |


---

## TEAM-only xAI: remove legacy collection paths

**Goal:** Remove `userBootstrapCollectionId` and per-user bootstrap xAI flows where policy says TEAM-only. **Anchor:** `XAI_TEAM_ID` for team KB append/retrieval.

**Acceptance (remaining):** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## PR5 — RAG readiness (shipped)

Scope delivered: `getScopeReadinessSummary`, ask-route gate, multi-source orchestrator skip reason, persona link-files readiness, admin labels, tests, validation checklist. **No further PR5 backlog here.**

---

## Phase: xChat chat_history → XAI collection (`user_history_agent`)

**Goal:** Scheduled `user_history_agent` syncs `xchat_logs` → user xAI collection for retrieval.

**Remaining:** Align implementation with TEAM-only policy; task runner + admin category; tests with mocked xAI append. See table in prior plans for touch files.

**Audit gaps:** Full inference lineage on `xchat_logs`, tamper-evident chain, optional `admin_audit_events` per task run — see `atx-sre-ops/audit-lineage-and-controls.md`.

---

## Stripe & billing (from frontend plan)

**Not implemented:** Stripe Checkout/Portal, `POST /api/webhooks/stripe`, Mongo subscription fields, plan gating hooks. See variables sketch in archived notes or add `STRIPE_`* to `DEVELOPMENT.md` when starting.

---

## Deferred

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).

