# API consolidation: Next.js → atxfinance-backend (Spring)

**Status:** in progress (extended BFF slices shipped).  
**Today:** Canonical proxy list: [`src/lib/bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) (drives `tests/smoke/backend-http-api-parity.test.ts`). Kotlin covers **health / diagnostics**, **app-user portfolios + positions + watchlist + recommendations**, **strategy-options**, **personas**, **self-service access-requests** (with audit + optional Slack), **admin access-requests**, **admin portfolio shell** (`GET`/`POST` list, `GET`/`PATCH`/`DELETE` by id), **admin portfolio nested**: accounts, watchlist, **account positions** (`GET`/`POST` collection only), **portfolio recommendations / alerts / delivery-channels**, tenant **`/api/admin/tasks`** (portfolio-nested task CRUD removed from product), plus **deploy-note-configs**, **import/broker**, **tenant tasks/scheduler**, **user-feedback**, **admin bootstrap-status**, **admin audit (GET)**, **RAG files** + readiness — see `./atxfinance-backend-http-api.md`. App-user **recommendations** optional Pub/Sub on create when `RECOMMENDATIONS_PUBSUB_TOPIC` + project id set. When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies via `src/lib/backend-bff.ts`.

## Migration status board

| Area | Spring | Notes |
|------|--------|--------|
| Portfolios, positions, watchlist | Yes | App-user paths; **admin** portfolio root, watchlist, accounts, nested recommendations/alerts/delivery-channels, and **GET**/**POST** positions under an account — **Spring + BFF** when origin set. **Gap:** admin **`PATCH`/`DELETE …/positions/{positionId}`** not in `bff-proxy-routes.ts` yet. |
| Recommendations (app + per-portfolio) | Yes | Pub/Sub: Next `publishRecommendationEvent` when BFF off; Kotlin `RecommendationEventPublisher` when BFF on (`RECOMMENDATIONS_PUBSUB_TOPIC`). |
| Strategy-options | Yes | Yahoo + synthetic fallback on JVM. |
| Personas | Yes | Audit writes in Kotlin (`PersonaService`). |
| `POST /api/access-requests` | Yes | Audit + Slack webhook when `SLACK_WEBHOOK_URL` set. |
| `POST /api/user-feedback` | Yes | Slack webhook. |
| `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` | Yes | Read-only admin probes. |
| `GET` / `POST /api/rag/files` | Yes | Inventory Mongo **`xai_collections`**; POST uploads via xAI + chunking. |
| **Auth (`/api/auth/*`)** | Next-primary | OAuth callback (`/api/auth/x/callback`) on Next. To retire: implement Spring callback per **Auth callback contract**; add BFF proxy; dual-run 7–14 days before removing Next. |
| **Deferred** | | **`xchat/*`** — streaming + tools; see **Plan: xChat** below. |
| **PR 4 shipped** | | **deploy-note-configs**, **import/broker** on Kotlin + BFF. **RAG readiness** `GET /api/rag/files/{fileId}/readiness` migrated. |

**Target (your architecture):** Next.js focuses on **branding + UI**; **atxfinance-backend** implements **business HTTP APIs** and scheduler/worker concerns. The browser or Next server calls the Spring service instead of executing domain logic in Route Handlers.

## Non-goals for “big bang”

- Replacing all 59 routes in one change set is unsafe. Ship **vertical slices** with parity tests per domain.
- **OAuth callback** is migration-sensitive. Cut over with dual-run and explicit failure redirects to avoid login regressions.

## Recommended topology (pick one)

| Pattern | Pros | Cons |
|--------|------|------|
| **BFF (Next server proxies)** | Same-origin cookies, minimal CORS; gradual migration via `fetch(backend)` in Route Handlers that thin-wrap Spring | Next still runs “API-shaped” routes until deleted |
| **Direct browser → Spring** | Next truly UI-only | CORS, CSRF, cookie domain (`api.` vs app host), X OAuth redirect URI registration for second origin |
| **Edge / gateway** (single host) | `/` → Next, `/api` → Spring | Infra (Cloud Run multi-service, LB path rules) |

For **local dev**, a BFF or gateway that preserves `http://127.0.0.1:3000` for UI and routes `/api/*` to `http://127.0.0.1:8080` is often the least painful during migration.

## Phased migration (suggested order)

1. **Contracts** — OpenAPI for Spring per domain; keep Next inventory (`src/lib/openapi/*`) in sync or generate client types from Spring’s `/v3/api-docs`.
2. **Shared primitives** — Env: backend base URL(s), request signing or session forwarding rules, correlation IDs.
3. **Read-only / low-risk** — e.g. `GET /api/health` parity (already duplicated conceptually), then read-only admin/bootstrap probes.
4. **Core CRUD** — portfolios ✅; recommendations ✅; personas ✅; self-service access-requests ✅; feedback ✅; read-only admin bootstrap/audit ✅; RAG file list + upload ✅ (`xai_collections`).
5. **Remaining admin mutations** — **users** ✅; **tasks / scheduler** ✅ (PR 3 — see below). **Deploy-note-configs + import/broker** ✅ (PR 4 — Kotlin + BFF). (**Admin access-request review** ✅ in Kotlin + BFF.)
6. **xChat** — **deferred** (see **Plan: xChat**).
7. **Auth / OAuth** — move session + callback ownership to Spring with the approved contract below; run dual callback paths for 7-14 days before removing Next callback logic.
8. **Delete Next route** only after integration tests hit Spring and UI uses the new path.

## Admin surfaces (split)

**Proxied today:** `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` (read-only); **`/api/admin/access-requests`** (CRUD + review) — see `./atxfinance-backend-http-api.md`.

**Proxied with Spring parity (Next BFF):** deploy-note-configs, import/broker (`POST /api/admin/import/broker` from **`portfolio-console.tsx`**), **admin portfolio** tree (root CRUD, accounts, watchlist, positions collection GET/POST, recommendations, alerts). **`ATXFINANCE_BACKEND_ORIGIN`** must be the JVM base URL, not the Next app host (PR 3 + PR 4 + subsequent admin-portfolio slices — same origin).

**Next-only HTTP (no BFF proxy):** tenant **`/api/admin/tasks*`**, **`/api/admin/task-runs`**, **`/api/admin/scheduler/tick`**, **`/api/admin/delivery-channels*`** (tenant + portfolio-nested), app-user **`GET`/`PATCH /api/user/watchlist`**, and app-user **`GET`/`PATCH /api/portfolios/{portfolioId}/watchlist`** — always served from Next + Mongo (Yahoo `?quotes=1`; **one watchlist per user**, portfolio path is ownership shim). Spring JVM **`…/watchlist`** paths mirror the same Mongo semantics (session user + tenant, not path `portfolioId` on the document).

## PR 3 & PR 4 — real migration slices (not “code-only” PRs)

These are **vertical migration tracks**: same Mongo collections and contracts as Next, but **cutover** is an operator-controlled step (staging → prod), with rollback by clearing the BFF origin.

### PR 3 — Admin tasks + scheduler (migration)

**Product scope:** `GET`/`POST /api/admin/tasks`, `POST /api/admin/tasks/{taskId}/run`, `GET /api/admin/task-runs`, `POST /api/admin/scheduler/tick` — Spring `AdminScheduledTasksController` + `AdminScheduledTasksService` for JVM/direct callers; **Next does not BFF-proxy** these (always `src/app/api/admin/tasks/*`, `task-runs`, `scheduler/tick`). Registry entries remain for parity smoke tests.

**Data migration:** **No destructive backfill.** JVM reads/writes the same collections as Next: **`admin_scheduled_tasks`**, **`admin_task_runs`**. Existing documents remain valid.

**Cutover checklist**

1. Deploy **atxfinance-backend** containing task controllers; verify `./gradlew test` and `GET /api/backend/health` (or service health) in the target environment.
2. In **staging**, set **`ATXFINANCE_BACKEND_ORIGIN`** to the Spring base URL (HTTPS origin, no trailing slash). Helper (merges env; does not wipe other vars):  
   `bash scripts/ops/set-atxfinance-backend-origin.sh staging https://<your-backend>-run.app`  
   Requires `gcloud` auth and defaults: project `fintech-advisor-staging`, service `xfinance-core-staging`, region `us-central1` (override with `GCP_PROJECT_ID`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_REGION`).
3. **Soak staging:** exercise **Admin → Tasks** (list/create, run, task runs, scheduler tick) and spot-check another BFF surface (e.g. portfolios) if you already rely on the same origin. Monitor Cloud Run logs and latency.
4. **Production:** repeat after soak; set origin on prod Cloud Run (`bash scripts/ops/set-atxfinance-backend-origin.sh prod https://…`) or mirror the same `gcloud run services update … --update-env-vars`. **Operator layout:** see **`./gcp-prod-two-service-model.md`** (`xfinance-core-prod` + `atxfinance-backend-prod`).
5. **Rollback:** remove **`ATXFINANCE_BACKEND_ORIGIN`** — Next route handlers execute the Mongo again (fallback paths remain in `src/app/api/admin/tasks/*`, `task-runs`, `scheduler/tick`). Example:  
   `gcloud run services update xfinance-core-staging --project fintech-advisor-staging --region us-central1 --remove-env-vars ATXFINANCE_BACKEND_ORIGIN`

### PR 4 — Deploy-note-configs + broker import (migration)

**Product scope:** `GET`/`POST /api/admin/deploy-note-configs`, `GET`/`PUT`/`DELETE /api/admin/deploy-note-configs/{configId}`, and **`POST /api/admin/import/broker`** (Merrill/Fidelity holdings CSV from **`portfolio-console.tsx`**). **Shipped** on Kotlin + BFF + registry + `backend-http-api-parity` needles; cutover is operator-controlled via **`ATXFINANCE_BACKEND_ORIGIN`** (same as PR 3).

**Data migration**

- **Deploy-note-configs:** Mongo **`admin_deploy_note_configs`** — no collection rename; migration work is **API parity + BFF cutover**, not a bulk transform. If you add JVM writers, run dual-validation in staging (create/edit on Spring vs Next) before prod.
- **Import/broker:** Stateless CSV → **`portfolio_positions`** (and related) — **operational** migration means staging dry-runs (`dryRun` where supported), broker→account mappings verified, then BFF enablement the same way as PR 3.

**Cutover checklist (PR 4 — use for staging/prod enablement)**

1. Confirm `tests/smoke/backend-http-api-parity.test.ts` + `npm run ci:gate` on the release revision.
2. Staging: set **`ATXFINANCE_BACKEND_ORIGIN`**, exercise deploy-note CRUD and **one** import with a known-good CSV.
3. Prod: enable after soak; **rollback** = unset origin (Next handlers remain).

## Risks and gaps (TODO)

Track these before **PR 3** prod cutover and during BFF rollout; **PR 4** code path is shipped — remaining items are operational and parity hygiene.

| ID | Area | Risk / gap | TODO |
|----|------|------------|------|
| R1 | PR 3 — JVM tasks | `AdminScheduledTasksService` blocks the HTTP thread during simulated work (`Thread.sleep`); high concurrency or long cron batches could exhaust worker threads vs Next’s async model. | Add timeouts / bounded pool or async execution; cap concurrent runs; load-test `POST /api/admin/scheduler/tick`. |
| R2 | PR 3 — parity | Kotlin vs Next execution order: JVM runs due tasks **sequentially** in `scheduler/tick`; Next used `Promise.all` (**parallel**). Behavior differs under multi-task ticks. | Document or align ordering/parallelism; add integration test for tick with 2+ due tasks. |
| R3 | PR 3 — tests | No `Testcontainers` / `@WebMvcTest` coverage for `AdminScheduledTasksController` in `services/atxfinance-backend` yet. | Add JVM integration or slice tests for list/create/run/tick with in-memory or test Mongo. |
| R4 | PR 4 | ~~Deploy-note-configs + import/broker Next-only~~ — **shipped** on Kotlin + BFF. | Keep staging soak + dry-run import discipline before prod; extend parity tests if response shapes drift. |
| R5 | BFF generally | If `ATXFINANCE_BACKEND_ORIGIN` points at a **down** or **wrong** Spring URL, admin APIs 5xx with no Mongo fallback until origin is cleared. | Runbook: health-check Spring before enabling; feature-flag or staged rollout per env. |
| R6 | Side effects | Task runs in Next did not publish audit/Slack events; JVM path matches today — confirm product expectations if audit is required later. | Optional: `admin_audit_events` on task success/fail if compliance needs it. |

| R7 | Auth / OAuth cutover | Spring does not yet own `/api/auth/x/callback`; Next cookie `SameSite` and error codes differ from the **approved** Spring contract. | Follow [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md): operator checklist, Next→Spring error matrix, `next` redirect gap. Add JVM callback + Redis PKCE + integration tests before dual-run soak. |

## Auth callback contract (approved)

### Authority and cookie model

- **Session authority:** Spring backend only.
- **Cookie model:** `HttpOnly`, `Secure`, `SameSite=Strict`, single-host cookie scope (`app.<domain>`), no cross-subdomain wildcard.
- **Next role:** initiates login redirect only; does not issue/validate auth cookies.

### Callback and PKCE/state ownership

- **Callback host/path:** backend callback on app host: `/api/auth/x/callback`.
- **PKCE + state owner:** backend. Persist `state` + `code_verifier` in Redis with 10-minute TTL keyed by `state`.
- **Next responsibility:** pass through `next` destination and provider redirect initiation only.

### Redirect and failure contract

- **Post-login redirect:** backend enforces allowlist (`/dashboard`, `/home`, `/portfolio`, `/`); default to `/dashboard` for missing/invalid `next`.
- **Failure redirects:** backend redirects to `/login?error=<code>` for `invalid_state`, `code_reused`, `missing_email`, `access_denied`, or `generic`.
- **Observability:** backend logs full failure context (state/user/error) server-side.

### Role bootstrap and cutover

- **Bootstrap policy:** fail-closed by default; optional viewer bootstrap behind `FEATURE_NEW_USER_VIEWER`.
- **Migration flag window:** keep `FEATURE_NEW_USER_VIEWER=true` for first 2 weeks of cutover, then disable.
- **Cutover shape:** dual-run callbacks for 7-14 days (keep legacy Next callback live while Spring callback is enabled), then retire Next callback path.

## Plan: xChat (next major product slice)

**Goal:** Move high-traffic chat surfaces to Spring behind the BFF, or keep them on Next until JVM can match behavior.

### Prerequisites

- **Streaming:** SSE or chunked HTTP from Spring Web MVC / WebFlux; Next BFF must forward streams without buffering the full body (today `proxyRequestToBackend` uses `fetch` — may need a streaming-capable proxy path for `POST /api/xchat/ask`).
- **Secrets:** xAI keys and management keys already in env/Secret Manager; Kotlin must mirror redaction and never log raw payloads beyond existing patterns.
- **Persona resolution:** Partially overlaps personas collection; Spring should reuse the same Mongo collections and session cookie as portfolio BFF.

### Suggested sub-order

1. **Read-only / low-risk:** `GET` history/stats routes if any are easy wins (still need session + Mongo parity).
2. **Batch / async jobs:** Non-streaming paths that enqueue work (align with existing Pub/Sub worker if applicable).
3. **`POST /api/xchat/ask` (streaming):** Last — highest coupling to Next’s tool loop, xAI client, and RAG orchestration.

### xChat testing gate

Extend `tests/smoke/backend-http-api-parity.test.ts` + per-route integration tests (live Spring or Testcontainers); add streaming smoke only if you can assert headers / first chunk in CI.

## Plan: operational parity when BFF is on (side effects)

When `proxyRequestToBackend` returns a Spring `Response`, the Next handler’s side effects are skipped. Critical paths below are **duplicated on the JVM** where noted.

| Effect | JVM status |
|--------|------------|
| Slack on self-service access-request | ✅ `SlackWebhookService` + `AccessRequestService` |
| Audit on self-service access-request | ✅ `AuditEventService` |
| Persona audit trail | ✅ `PersonaService` (Mongo `admin_audit_events`) |
| Recommendation Pub/Sub publish | Next `publishRecommendationEvent` when proxy **off**; Kotlin `RecommendationEventPublisher` when proxy **on** (`RECOMMENDATIONS_PUBSUB_TOPIC` + project id). |
| Other routes | Audit each handler before enabling BFF in prod. |

## Env hooks (repo)

- `ATXFINANCE_BACKEND_ORIGIN` — BFF proxy target (`src/lib/backend-bff.ts`); read via `getAtxfinanceBackendOrigin()` from **`process.env`** (not `getEnv()` zod) so App Router handlers and Vitest do not need xAI/OAuth keys just to evaluate “proxy off”.
- `NEXT_PUBLIC_ATXFINANCE_BACKEND_ORIGIN` — optional; `getPublicAtxfinanceBackendOrigin()` for direct browser → Spring (CORS on Kotlin). Commented in `.env.example`.

## Testing gate

- Per migrated route: **integration test** against Spring (live or Testcontainers) + **contract test** vs OpenAPI.
- Keep `tests/smoke/backend-http-api-parity.test.ts` extended as Spring gains real controllers.

## Related

- [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md) — Next vs Spring auth gaps, `/login?error=` matrix, dual-run checklist
- `./atxfinance-backend-http-api.md` — current Spring surface
- [`./audit-lineage-and-controls.md`](./audit-lineage-and-controls.md) — audit rows, BFF side-effect parity, retrieval semantics, test inventory vs xdesign-review-audit
- `AGENTS.md` — today’s validation assumes Next API; update when a slice moves
