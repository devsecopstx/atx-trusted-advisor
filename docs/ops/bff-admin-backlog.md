# BFF admin API backlog (Next → Spring)

Canonical proxied routes live in `src/lib/bff-proxy-routes.ts` (see `tests/smoke/backend-http-api-parity.test.ts`). When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies via `src/lib/backend-bff.ts`.

## Shipped on Kotlin + BFF (when origin set)

| Area | Notes |
|------|--------|
| Self-service `POST /api/access-requests` | Audit + optional Slack (`SlackWebhookService`). |
| `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` | Read-only admin probes. |
| **`/api/admin/access-requests` (collection + by id)** | `AdminAccessRequestsController`: list/create/review/delete. Async xAI user-bootstrap after approve still runs only when approval is handled on **Next** (proxy off); JVM records audit (`bootstrap_deferred`, etc.). |

## Still Next-primary (migrate with Kotlin + proxy + parity tests per slice)

| Area | Example Next routes | Notes |
|------|---------------------|--------|
| Users / tenants | admin user CRUD | Session + role boundaries |
| Tasks / deploy notes / import / scheduler | under `src/app/api/admin/**` | Operational; lower traffic |
| Alerts (future) | TBD | Pair with `ALERTS_PUBSUB_TOPIC` + `publishAppUserAlertEvent` (`src/lib/pubsub/alerts-publish.ts`) |

## Recommendations Pub/Sub

- **Next:** `publishRecommendationEvent` when BFF proxy is **off** (`src/lib/pubsub/recommendations-publish.ts`).
- **Kotlin:** `RecommendationEventPublisher` after insert when `RECOMMENDATIONS_PUBSUB_TOPIC` + project id are set (parity when BFF proxy is **on**).

## RAG

- **GET/POST** `/api/rag/files`: BFF to Spring; inventory Mongo collection **`xai_collections`** (see `docs/ops/atxfinance-backend-http-api.md`).
- **Readiness** `GET /api/rag/files/{fileId}/readiness`: Next-only until migrated.

## Related

- `docs/ops/api-consolidation-spring-backend.md` — migration status board and auth callback contract.
- `docs/ops/atxfinance-backend-http-api.md` — Spring route inventory.
