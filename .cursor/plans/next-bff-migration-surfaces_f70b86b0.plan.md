---
name: next-bff-migration-surfaces
overview: Next.js BFF → Spring (atxfinance-backend) in vertical slices. Canonical status and backlog live in atx-docs/sre-ops/api-consolidation-spring-backend.md; this plan is the Cursor checklist to resume work.
todos:
  - id: resume-next-session
    content: "On return: read atx-docs/sre-ops/api-consolidation-spring-backend.md status board; run npm run ci:gate + services/atxfinance-backend ./gradlew test; then pick a backlog row below."
    status: pending
  - id: backlog-admin-remaining
    content: "PR 3 migration = tasks/scheduler BFF cutover (code shipped; operators follow api-consolidation § PR 3). PR 4 migration = deploy-note-configs + import/broker Kotlin + BFF. Users already on Spring + BFF."
    status: pending
  - id: backlog-xchat-streaming
    content: "Deferred: xChat routes — streaming proxy + tools; see Plan:xChat in api-consolidation-spring-backend.md."
    status: pending
  - id: backlog-auth-oauth
    content: "In progress: move /api/auth/* session + OAuth callback to Spring (single-host cookie + backend PKCE/state, dual-run cutover)."
    status: pending
  - id: backlog-user-history-agent
    content: "Phase: xChat chat_history Mongo collection + user_history_agent scheduled task to sync turns to xAI user collection. See atx-docs/PLAN.md § user_history_agent."
    status: pending
  - id: done-rag-post
    content: "Done: GET/POST /api/rag/files on Spring + BFF (xai_collections)."
    status: completed
  - id: done-recommendations-pubsub
    content: "Done: Kotlin RecommendationEventPublisher when BFF on + RECOMMENDATIONS_PUBSUB_TOPIC."
    status: completed
  - id: done-admin-access-requests
    content: "Done: /api/admin/access-requests CRUD + review on Kotlin + BFF (bootstrap deferred audit when proxy off)."
    status: completed
isProject: false
---

# Next BFF Migration Plan

**Source of truth for shipped vs deferred:** [api-consolidation-spring-backend.md](../../atx-docs/sre-ops/api-consolidation-spring-backend.md) (migration status board, Plan:xChat, operational parity).

**When you return to BFF work:** start from that doc’s **Still Next-primary** / **Deferred** rows, then run the per-slice checklist below.

## Goal

Move product/business API ownership from Next route handlers to Spring controllers using a proxy-first BFF pattern (`proxyRequestToBackend` in [`src/lib/backend-bff.ts`](../../src/lib/backend-bff.ts)), then remove Next handlers only after parity checks pass.

## Baseline (reference pattern)

- `[src/lib/backend-bff.ts](../../src/lib/backend-bff.ts)` — proxy + `nextBffApi` route registry (if present)
- `[src/lib/bff-proxy-routes.ts](../../src/lib/bff-proxy-routes.ts)` — parity list for smoke tests
- `[atx-docs/sre-ops/api-consolidation-spring-backend.md](../../atx-docs/sre-ops/api-consolidation-spring-backend.md)`
- `[atx-docs/sre-ops/atxfinance-backend-http-api.md](../../atx-docs/sre-ops/atxfinance-backend-http-api.md)`
- `[tests/smoke/backend-http-api-parity.test.ts](../../tests/smoke/backend-http-api-parity.test.ts)`

## Shipped slices (summary)

Portfolios/positions/watchlist, recommendations (app + per-portfolio) + Pub/Sub on JVM when BFF on, strategy-options, personas, self-service `POST /api/access-requests`, user-feedback, admin bootstrap + audit, **admin access-requests** (full CRUD/review), **RAG GET+POST** — see the consolidation doc status table.

## What’s next (suggested order)

1. **Auth / OAuth** — highest product risk; follow **Auth callback contract** in the consolidation doc (Spring session authority, dual-run).
2. **xChat** — streaming-capable BFF + tool loop (last large slice per **Plan: xChat**).
3. **Remaining admin** — users, tasks, deploy configs, import, scheduler (lower traffic; same Kotlin + proxy + parity gate).

## Backlog (legacy numbered list — prefer “What’s next” above)

1. ~~Admin access-requests / RAG POST / recommendations Pub/Sub~~ — shipped; keep parity tests green.
2. **xChat** — streaming proxy; align with consolidation **Plan: xChat**.
3. **Auth** — session + `/api/auth/x/callback` cutover per approved contract.
4. **user_history_agent** — Mongo chat_history collection + scheduled task to sync turns → xAI user collection (`atx-docs/PLAN.md`).

## Per-slice implementation checklist

- Add Spring controllers/services under `[services/atxfinance-backend/src/main/kotlin](../../services/atxfinance-backend/src/main/kotlin)`.
- Update `[atx-docs/sre-ops/atxfinance-backend-http-api.md](../../atx-docs/sre-ops/atxfinance-backend-http-api.md)`.
- Extend `[tests/smoke/backend-http-api-parity.test.ts](../../tests/smoke/backend-http-api-parity.test.ts)` / `[src/lib/bff-proxy-routes.ts](../../src/lib/bff-proxy-routes.ts)` as appropriate.
- Proxy-first in `[src/app/api](../../src/app/api)`.
- Integration tests in `[tests/integration](../../tests/integration)` when adding coverage.
- Side effects: duplicate Slack/audit/Pub/Sub on JVM per **Plan: operational parity** in the consolidation doc before enabling BFF-only traffic.

## Deletion gate for each Next route

Only delete a Next `route.ts` when all are true:

- Spring route exists with intended method/path and response semantics.
- Spec + parity test updated and green.
- Integration coverage verifies migrated behavior.
- Callers are switched (or path is still served by a thin proxy route).
- CI gate passes (`lint`, `typecheck`, `test`).

## Rollout shape

- Ship one domain slice per PR.
- Prefer proxy-first PR then deletion PR for large/risky surfaces.

