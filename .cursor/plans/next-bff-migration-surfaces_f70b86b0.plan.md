---
name: next-bff-migration-surfaces
overview: Next.js BFF → Spring (atxfinance-backend) in vertical slices. Canonical status and backlog live in docs/ops/api-consolidation-spring-backend.md; this plan is the Cursor checklist to resume work.
todos:
  - id: resume-next-session
    content: "On return: read docs/ops/api-consolidation-spring-backend.md status board; run npm run ci:gate + services/atxfinance-backend ./gradlew test; then pick a backlog row below."
    status: pending
  - id: backlog-admin-mutations
    content: "Deferred: Kotlin + proxy for admin mutations — /api/admin/access-requests/** (review), users, tasks, deploy-note-configs, import, scheduler tick, etc."
    status: pending
  - id: backlog-rag-post
    content: "Deferred: POST /api/rag/files (upload) remains Next-only until Spring + xAI upload parity."
    status: pending
  - id: backlog-recommendations-pubsub
    content: "Optional parity: emit Pub/Sub publishRecommendationEvent from Kotlin on POST /api/recommendations (currently Next-only when proxy off)."
    status: pending
  - id: backlog-xchat-streaming
    content: "Deferred: xChat routes — streaming proxy + tools; see Plan:xChat in api-consolidation-spring-backend.md."
    status: pending
  - id: backlog-auth-oauth
    content: "In progress: move /api/auth/* session + OAuth callback to Spring using approved single-host cookie + backend PKCE/state contract and dual-run cutover."
    status: pending
isProject: false
---

# Next BFF Migration Plan

**Source of truth for what is shipped vs deferred:** [`docs/ops/api-consolidation-spring-backend.md`](../../docs/ops/api-consolidation-spring-backend.md) (migration status board, Plan:xChat, operational parity table).

**When you return to BFF backend work:** start from that doc’s **Still Next-primary** / **Deferred** rows, then run the per-slice checklist below.

## Goal

Move product/business API ownership from Next route handlers to Spring controllers using a proxy-first BFF pattern (`proxyRequestToBackend` in [`src/lib/backend-bff.ts`](../../src/lib/backend-bff.ts)), then remove Next handlers only after parity checks pass.

## Baseline (reference pattern)

- [`src/lib/backend-bff.ts`](../../src/lib/backend-bff.ts) — proxy + `nextBffApi` route registry (if present)
- [`src/lib/bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) — parity list for smoke tests
- [`docs/ops/api-consolidation-spring-backend.md`](../../docs/ops/api-consolidation-spring-backend.md)
- [`docs/ops/atxfinance-backend-http-api.md`](../../docs/ops/atxfinance-backend-http-api.md)
- [`tests/smoke/backend-http-api-parity.test.ts`](../../tests/smoke/backend-http-api-parity.test.ts)

## Shipped slices (summary)

Portfolios/positions/watchlist, recommendations (app + per-portfolio), strategy-options, personas, self-service `POST /api/access-requests`, feedback, `GET` admin bootstrap-status + audit, `GET` RAG files list — see migration status table in the consolidation doc.

## Backlog (resume in this order unless priorities change)

1. **Admin mutations (Next-primary today)** — access-request **review** (`/api/admin/access-requests/**`), users CRUD, tasks, deploy-note-configs, import, scheduler tick, etc. Same gate as existing slices (Kotlin controllers + proxy-first + `bff-proxy-routes` + HTTP spec + smoke).
2. **RAG POST** — upload path still Next-only; needs Spring + parity with xAI upload flow.
3. **Recommendation Pub/Sub** — optional JVM duplicate of `publishRecommendationEvent` when BFF handles `POST /api/recommendations`.
4. **xChat** — streaming-capable BFF path; tool loop; last major product slice per **Plan: xChat** in consolidation doc.
5. **Auth / OAuth** — session issuance and `/api/auth/x/callback` move to Spring per approved contract in `docs/ops/api-consolidation-spring-backend.md` (backend cookie authority + dual-run cutover).

## Per-slice implementation checklist

- Add Spring controllers/services under [`services/atxfinance-backend/src/main/kotlin`](../../services/atxfinance-backend/src/main/kotlin).
- Update [`docs/ops/atxfinance-backend-http-api.md`](../../docs/ops/atxfinance-backend-http-api.md).
- Extend [`tests/smoke/backend-http-api-parity.test.ts`](../../tests/smoke/backend-http-api-parity.test.ts) / [`src/lib/bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) as appropriate.
- Proxy-first in [`src/app/api`](../../src/app/api).
- Integration tests in [`tests/integration`](../../tests/integration).
- Side effects: duplicate Slack/audit/Pub/Sub on JVM per **Plan: operational parity** in consolidation doc before enabling BFF-only traffic.

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
