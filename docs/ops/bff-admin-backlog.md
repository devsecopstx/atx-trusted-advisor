# BFF admin API backlog (Next → Spring)

Canonical proxied routes live in `src/lib/bff-proxy-routes.ts` (see `tests/smoke/backend-http-api-parity.test.ts`). When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies via `src/lib/backend-bff.ts`.

## Shipped on Kotlin + BFF (when origin set)

| Area | Notes |
|------|--------|
| Self-service `POST /api/access-requests` | Audit + optional Slack (`SlackWebhookService`). |
| `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` | Read-only admin probes. |
| **`/api/admin/access-requests` (collection + by id)** | `AdminAccessRequestsController`: list/create/review/delete. Async xAI user-bootstrap after approve still runs only when approval is handled on **Next** (proxy off); JVM records audit (`bootstrap_deferred`, etc.). |

## Shipped on Kotlin + BFF — **PR 3 (tasks migration)**

| Area | Notes |
|------|--------|
| Tasks / scheduler | `GET/POST /api/admin/tasks`, `POST .../tasks/{taskId}/run`, `GET /api/admin/task-runs`, `POST /api/admin/scheduler/tick` — **operator cutover** = set `ATXFINANCE_BACKEND_ORIGIN` per `docs/ops/api-consolidation-spring-backend.md` § **PR 3**. |

## Still Next-primary — **PR 4 (deploy + import migration)**

Migrate as **one slice** when ready: Kotlin + proxy + parity tests + doc updates.

| Area | Example Next routes | Notes |
|------|---------------------|--------|
| Users / tenants | admin user CRUD | **Shipped** on Kotlin + BFF (not part of PR 3/4). |
| **Deploy-note-configs** | `GET/POST /api/admin/deploy-note-configs`, `[configId]` | Mongo **`admin_deploy_note_configs`**. Next-only until PR 4. |
| **Import / broker** | `POST /api/admin/import/broker` | Next-only until PR 4. **`portfolio-console.tsx`** — Merrill/Fidelity holdings CSV. |
| Alerts (future) | TBD | Pair with `ALERTS_PUBSUB_TOPIC` + `publishAppUserAlertEvent` (`src/lib/pubsub/alerts-publish.ts`) |

## Recommendations Pub/Sub

- **Next:** `publishRecommendationEvent` when BFF proxy is **off** (`src/lib/pubsub/recommendations-publish.ts`).
- **Kotlin:** `RecommendationEventPublisher` after insert when `RECOMMENDATIONS_PUBSUB_TOPIC` + project id are set (parity when BFF proxy is **on**).

## RAG

- **GET/POST** `/api/rag/files`: BFF to Spring; inventory Mongo collection **`xai_collections`** (see `docs/ops/atxfinance-backend-http-api.md`). Full RAG migration largely done.
- **Readiness** `GET /api/rag/files/{fileId}/readiness`: Next-only until migrated. **PR 5** scopes a focused **RAG-readiness** migration (not full RAG) — see `docs/PLAN.md` § PR 5.

## Related

- `docs/ops/api-consolidation-spring-backend.md` — migration status board, **PR 3 / PR 4** runbooks, auth callback contract.
- `docs/ops/atxfinance-backend-http-api.md` — Spring route inventory.
