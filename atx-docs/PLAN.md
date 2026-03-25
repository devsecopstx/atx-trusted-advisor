# Backlog & migration notes

Living backlog for atx app, xChat, admin, and BFF. **Frontend marketing details** that are still open live under **§ Stripe & billing**; shipped UI chrome is noted only by reference.

**Docs index:** [README.md](./README.md) · Phase 1 multi-agent: [atx-xchat/atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · **NL / strategy preflight:** [atx-xchat/xchat-nl-collect-inputs.md](./atx-xchat/xchat-nl-collect-inputs.md)

---

## Today / near-term (pick from here)


| Priority | Item                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Spring BFF parity (admin portfolios)** | **App-user + shared APIs proxied** when `ATXFINANCE_BACKEND_ORIGIN` is set — see **§ BFF routing gaps** below. **Still Next-only (admin book of record):** `GET/POST /api/admin/portfolios`, `GET/PATCH/DELETE /api/admin/portfolios/{id}`, admin nested watchlist / tasks / alerts / recommendations / delivery-channels / account positions — add Kotlin + `bff-proxy-routes` when ready. |
| 2        | **Accounts subpage UX**                  | **Done** — Toolbar order (Refresh → Save changes), owner block matches main **User** column (`userDisplayName` / id / email + links), `GET …/accounts` includes owner labels; BFF-only loads owner via `GET /api/admin/users/:id`. Per-row pencil save removed (batch **Save changes** only). Human-readable custodian type labels.                                                       |
| 3        | **Default portfolio invariant**          | **Hotfix shipped:** `ensureDefaultPortfolioInvariantForUser` + `getDefaultPortfolio` (read-time repair: dedupe multiple defaults → oldest flagged; if none flagged, promote oldest). xChat workspace snapshot + tools use this path; admin can still move default via `adminUpdatePortfolio` / backoffice. **Remaining:** optional UX guard on portfolio admin UI.                                                                                         |
| 4        | **Admin portfolio audit**                | Log create/update/delete (optional CSV) via `admin_audit_events` / audit pipeline.                                                                                                                                                                                                                                                                                                        |
| 5        | **NL + strategy job tool (xChat)**       | Wire **nl**-gathered slots to `/api/strategy-jobs` (BFF) from xChat when product-ready; document tool schema + persona copy. Until then, personas use **nl** only (see `xchat-nl-collect-inputs.md`).                                                                                                                                                                                     |
| 6        | **Admin seed — RAG sync**                | Optional `SEED_RAG_FROM_REPO` (or similar): ingest `atx-rag-collection/xpersonas/`, `finance-reference-docs/`, `example-prompts/`, `options-strategy/` into team collections and/or Mongo `xpersonas`; tests + `generate-docs`.                                                                                                                                                           |


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


| Area                 | Status             | Notes                                                                                                                                                                                                 |
| -------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BFF frontend→backend | Verified           | Canonical list: [`src/lib/bff-proxy-routes.ts`](../src/lib/bff-proxy-routes.ts) + `proxyRequestToBackend` on matching Next `route.ts` handlers. **Registry ↔ Next:** `tests/unit/bff-proxy-registry-next-handlers.test.ts`. **Kotlin ↔ docs:** `tests/smoke/backend-http-api-parity.test.ts`. |
| Auth / OAuth         | Next authoritative | See [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md). `/api/auth/x/callback` may proxy to Spring when origin set; most auth routes stay Next-only.                        |
| Deploy               | GitHub Actions     | `AGENTS.md` + `.github/workflows/deploy-cloud-run.yml` (staging) / production workflow. `ATXFINANCE_BACKEND_ORIGIN` wired from GitHub vars on Cloud Run — see workflow.                                  |
| CI gate              | Pass               | `npm run ci:gate` — lint, typecheck, tests.                                                                                                                                                           |


### BFF routing gaps (SRE report)

**Source of truth:** [`bff-proxy-routes.ts`](../src/lib/bff-proxy-routes.ts) — every `{ method, path }` there should have a Next handler that calls `proxyRequestToBackend(request)` first (return if non-null), then local fallback. CI enforces file presence + minimum `await proxyRequestToBackend(` count per route file via **`tests/unit/bff-proxy-registry-next-handlers.test.ts`**. **`ATXFINANCE_BACKEND_ORIGIN` unset** ⇒ proxy is a no-op and Next always serves locally.

**Proxied when origin is set (registry + implementation aligned):** app-user portfolios (`/api/portfolios/...` including default, current, by id, accounts, watchlist), `/api/positions`, `/api/recommendations` (+ by id, portfolio-scoped), `/api/strategy-options` (+ expirations), `/api/strategy-jobs` (+ by id, turns), `/api/user-feedback`, `/api/personas` (+ by id), `POST /api/access-requests`, admin access-requests/users/tasks/scheduler/deploy-notes/import/broker/bootstrap-status/audit, admin portfolio **accounts** only, `/api/rag/files` (+ readiness). **`GET /api/auth/x/callback`** is listed in `bff-proxy-routes.ts` but Next only forwards when **`AUTH_CALLBACK_USE_SPRING=true`** in addition to `ATXFINANCE_BACKEND_ORIGIN` (see callback route); default remains Next OAuth completion.

**Intentionally Next-only (not in BFF registry — expected):**

- **xChat / streaming:** `/api/xchat/*` (ask, batch, history, collections, etc.) — deferred per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- **Persona governance extensions:** publish, archive, rollback, versions, sync-from-xai, collection create/link-files, verify-collection, `GET /api/personas/collections` — richer than core CRUD; remain Next until product moves them to Spring.
- **Admin portfolio shell:** list/create portfolios, get/patch/delete portfolio by id; nested admin watchlist, tasks, alerts, recommendations, delivery-channels, holdings under accounts — Next + Mongo until Kotlin controllers exist.
- **Auth surface (mostly):** `/api/auth/x/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/link-email`, Google OAuth login — Next; optional `auth/google/callback` proxy exists for dual-run but path is not in `BFF_PROXY_ROUTES`.
- **Ops / docs:** `/api/health`, `/api/openapi`, `/admin/api-docs` — Next.
- **Other admin:** `/api/admin/brokers`, `/api/admin/xchat/settings` — Next.

**Operator checklist:** Staging/prod with Spring enabled must set **`ATXFINANCE_BACKEND_ORIGIN`** to the Cloud Run (or internal) base URL for the Kotlin service so BFF routes hit Spring; unset ⇒ full Next fallback (split-brain risk for data mutated on both tiers — prefer single writer per domain).


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

**Audit gaps:** Full inference lineage on `xchat_logs`, tamper-evident chain, optional `admin_audit_events` per task run — see [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md).

---

## Stripe & billing (from frontend plan)

**Not implemented:** Stripe Checkout/Portal, `POST /api/webhooks/stripe`, Mongo subscription fields, plan gating hooks. See variables sketch in archived notes or add `STRIPE`_* to `DEVELOPMENT.md` when starting.

---

## Deferred

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).

