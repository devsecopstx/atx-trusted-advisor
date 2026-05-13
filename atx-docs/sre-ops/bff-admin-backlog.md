# BFF admin API backlog (Next → Spring)

Canonical proxied routes live in `src/lib/bff-proxy-routes.ts` (see `tests/smoke/backend-http-api-parity.test.ts`). When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies via `src/lib/backend-bff.ts`.

## Shipped on Kotlin + BFF (when origin set)

| Area | Notes |
|------|--------|
| Self-service `POST /api/access-requests` | Audit + optional Slack (`SlackWebhookService`). |
| `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` | Read-only admin probes. |
| **`/api/admin/access-requests` (collection + by id)** | `AdminAccessRequestsController`: list/create/review/delete. On approve, JVM **`CredentialInviteService`** issues password-invite Mongo fields + desk email when `PUBLIC_APP_BASE_URL` + SMTP are mounted on Spring. Async xAI user-bootstrap (`runAccessRequestBootstrap`) still runs only when approval is handled on **Next** (BFF proxy off for that request path or local); JVM records `bootstrap_deferred`. |

## Shipped on Kotlin + BFF — **PR 3 (tasks migration)**

| Area | Notes |
|------|--------|
| Tasks / scheduler | `GET/POST /api/admin/tasks`, `POST .../tasks/{taskId}/run`, `GET /api/admin/task-runs`, `POST /api/admin/scheduler/tick` — **operator cutover** = set `ATXFINANCE_BACKEND_ORIGIN` per `./api-consolidation-spring-backend.md` § **PR 3**. |

## Shipped on Kotlin + BFF — **PR 4 (deploy-note-configs + import/broker)**

| Area | Notes |
|------|--------|
| **Deploy-note-configs** | `GET/POST /api/admin/deploy-note-configs`, `GET/PUT/DELETE .../{configId}` — Mongo **`admin_deploy_note_configs`**. |
| **Import / broker** | `POST /api/admin/import/broker` — Merrill/Fidelity holdings CSV; **`portfolio-console.tsx`**. |

## Shipped on Kotlin + BFF — **admin portfolio shell**

| Area | Notes |
|------|--------|
| **Portfolio list / CRUD** | `GET/POST /api/admin/portfolios`, `GET/PATCH/DELETE /api/admin/portfolios/{portfolioId}` — `AdminPortfoliosController` + `AdminPortfoliosService` (Mongo parity with Next `admin/portfolios` routes). Nested **accounts** on `AdminPortfolioAccountsController`. |
| **Watchlist + account positions** | **`GET` …/admin/portfolios/{portfolioId}/watchlist** — Next-only (quotes + desk). **`PATCH`** same path — BFF → `AdminPortfolioWatchlistController` when admin gate on. `GET/POST …/accounts/{accountId}/positions` (`AdminPortfolioPositionsController`). |
| **Nested portfolio admin** | `GET/POST/PATCH/DELETE …/recommendations`, `…/alerts`, `…/delivery-channels`. (Portfolio-scoped scheduled tasks removed — use tenant `/admin/tasks`.) |

## Still Next-primary / future

| Area | Notes |
|------|--------|
| **Admin position by id** | **DELETE** `…/accounts/{accountId}/positions/{positionId}` — Kotlin + BFF + Next proxy when origin set. |
| Alerts (future) | TBD; pair with `ALERTS_PUBSUB_TOPIC` + `publishAppUserAlertEvent` |

## Recommendations Pub/Sub

- **Next:** `publishRecommendationEvent` when BFF proxy is **off** (`src/lib/pubsub/recommendations-publish.ts`).
- **Kotlin:** `RecommendationEventPublisher` after insert when `RECOMMENDATIONS_PUBSUB_TOPIC` + project id are set (parity when BFF proxy is **on**).

## RAG

- **GET/POST** `/api/rag/files`: BFF to Spring; inventory Mongo collection **`xai_collections`** (see `./atxfinance-backend-http-api.md`). Full RAG migration largely done.
- **Readiness** `GET /api/rag/files/{fileId}/readiness`: Migrated to Kotlin; proxy when `ATXFINANCE_BACKEND_ORIGIN` set.

## Related

- `./api-consolidation-spring-backend.md` — migration status board, **PR 3 / PR 4** runbooks, **Risks and gaps (TODO)** table (R1–R6), auth callback contract.
- `./atxfinance-backend-http-api.md` — Spring route inventory.
