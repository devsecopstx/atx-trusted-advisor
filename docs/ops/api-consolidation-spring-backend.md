# API consolidation: Next.js → atxfinance-backend (Spring)

**Status:** in progress (extended BFF slices shipped).  
**Today:** Canonical proxy list: [`src/lib/bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) (drives `tests/smoke/backend-http-api-parity.test.ts`). Kotlin covers **health / diagnostics**, **portfolios + positions**, **recommendations** (app + portfolio), **strategy-options**, **personas**, **self-service access-requests** (with audit + optional Slack), **feedback**, **admin bootstrap-status**, **admin audit (GET)**, and **RAG files (GET only)** — see `docs/ops/atxfinance-backend-http-api.md`. When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies via `src/lib/backend-bff.ts`.

### Migration status board

| Area | Spring | Notes |
|------|--------|--------|
| Portfolios, positions, watchlist | Yes | |
| Recommendations (app + per-portfolio) | Yes | Pub/Sub `publishRecommendationEvent` still Next-only when proxy off; not duplicated in Kotlin yet. |
| Strategy-options | Yes | Yahoo + synthetic fallback on JVM. |
| Personas | Yes | Audit writes in Kotlin (`PersonaService`). |
| `POST /api/access-requests` | Yes | Audit + Slack webhook when `SLACK_WEBHOOK_URL` set. |
| `POST /api/feedback` | Yes | Slack webhook. |
| `GET /api/admin/bootstrap-status`, `GET /api/admin/audit` | Yes | Read-only admin probes. |
| `GET /api/rag/files` | Yes | **POST** upload still Next-only. |
| **Deferred** | | **`auth/*`** (OAuth callback / session) — keep on Next until session contract is decided. |
| **Deferred** | | **`xchat/*`** — streaming + tools; see **Plan: xChat** below. |
| **Still Next-primary** | | Most other `admin/*` (access-request **review**, users, tasks, deploy configs, …) — add BFF when Kotlin controllers land. |

**Target (your architecture):** Next.js focuses on **branding + UI**; **atxfinance-backend** implements **business HTTP APIs** and scheduler/worker concerns. The browser or Next server calls the Spring service instead of executing domain logic in Route Handlers.

## Non-goals for “big bang”

- Replacing all 59 routes in one change set is unsafe. Ship **vertical slices** with parity tests per domain.
- **OAuth callback** (`/api/auth/x/callback`) is tightly coupled to **signed cookies**, PKCE state, and redirects. Moving it to Spring requires a **session/JWT contract** (e.g. Spring issues HTTP-only cookie on API host, or BFF pattern keeps callback on Next one more phase).

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
4. **Core CRUD** — portfolios ✅; recommendations ✅; personas ✅; self-service access-requests ✅; feedback ✅; read-only admin bootstrap/audit ✅; RAG file list ✅.
5. **Remaining admin mutations** — access-request **review**, users, tasks, deploy configs, import, scheduler, etc. — **Next-only** until Kotlin + `BFF_PROXY_ROUTES` entries ship per subdomain.
6. **xChat** — **deferred** (see **Plan: xChat**).
7. **Auth / OAuth** — **`/api/auth/x/callback`** and session cookie issuance **stay on Next** until an explicit JWT/cross-host cookie design.
8. **Delete Next route** only after integration tests hit Spring and UI uses the new path.

## Admin surfaces (split)

**Proxied today (read-only / diagnostics):** `GET /api/admin/bootstrap-status`, `GET /api/admin/audit`.

**Still Next-only (until migrated):** access-request moderation, users CRUD, tasks, deploy-note-configs, import, scheduler tick, etc. Add Kotlin + proxy + `BFF_PROXY_ROUTES` + doc parity using the same gate as portfolio BFF.

## Plan: xChat (next major product slice)

**Goal:** Move high-traffic chat surfaces to Spring behind the BFF, or keep them on Next until JVM can match behavior.

**Prerequisites**

- **Streaming:** SSE or chunked HTTP from Spring Web MVC / WebFlux; Next BFF must forward streams without buffering the full body (today `proxyRequestToBackend` uses `fetch` — may need a streaming-capable proxy path for `POST /api/xchat/ask`).
- **Secrets:** xAI keys and management keys already in env/Secret Manager; Kotlin must mirror redaction and never log raw payloads beyond existing patterns.
- **Persona resolution:** Partially overlaps personas collection; Spring should reuse the same Mongo collections and session cookie as portfolio BFF.

**Suggested sub-order**

1. **Read-only / low-risk:** `GET` history/stats routes if any are easy wins (still need session + Mongo parity).
2. **Batch / async jobs:** Non-streaming paths that enqueue work (align with existing Pub/Sub worker if applicable).
3. **`POST /api/xchat/ask` (streaming):** Last — highest coupling to Next’s tool loop, xAI client, and RAG orchestration.

**Testing gate:** Extend `tests/smoke/backend-http-api-parity.test.ts` + per-route integration tests (live Spring or Testcontainers); add streaming smoke only if you can assert headers / first chunk in CI.

## Plan: operational parity when BFF is on (side effects)

When `proxyRequestToBackend` returns a Spring `Response`, the Next handler’s side effects are skipped. Critical paths below are **duplicated on the JVM** where noted.

| Effect | JVM status |
|--------|------------|
| Slack on self-service access-request | ✅ `SlackWebhookService` + `AccessRequestService` |
| Audit on self-service access-request | ✅ `AuditEventService` |
| Persona audit trail | ✅ `PersonaService` (Mongo `admin_audit_events`) |
| Recommendation Pub/Sub publish | ⚠️ Still **Next-only** when proxy off; not emitted from Kotlin on `POST /api/recommendations` yet. |
| Other routes | Audit each handler before enabling BFF in prod. |

## Env hooks (repo)

- `ATXFINANCE_BACKEND_ORIGIN` — BFF proxy target (`src/lib/backend-bff.ts`); read via `getAtxfinanceBackendOrigin()` from **`process.env`** (not `getEnv()` zod) so App Router handlers and Vitest do not need xAI/OAuth keys just to evaluate “proxy off”.
- `NEXT_PUBLIC_ATXFINANCE_BACKEND_ORIGIN` — optional; `getPublicAtxfinanceBackendOrigin()` for direct browser → Spring (CORS on Kotlin). Commented in `.env.example`.

## Testing gate

- Per migrated route: **integration test** against Spring (live or Testcontainers) + **contract test** vs OpenAPI.
- Keep `tests/smoke/backend-http-api-parity.test.ts` extended as Spring gains real controllers.

## Related

- `.cursor/plans/next-bff-migration-surfaces_f70b86b0.plan.md` — Cursor checklist for **resuming** BFF work (backlog todos + per-slice steps); this doc remains the **canonical** status board.
- `docs/ops/atxfinance-backend-http-api.md` — current Spring surface
- `docs/ops/audit-lineage-and-controls.md` — audit rows, BFF side-effect parity, retrieval semantics, test inventory vs xdesign-review-audit
- `AGENTS.md` — today’s validation assumes Next API; update when a slice moves
