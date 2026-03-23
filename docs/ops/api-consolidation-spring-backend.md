# API consolidation: Next.js → atxfinance-backend (Spring)

**Status:** in progress (first BFF slice shipped).  
**Today:** Product HTTP APIs still mostly live under `src/app/api/**`. The Kotlin service implements **health / diagnostics** plus **portfolio + positions BFF** routes (single portfolio, default/current, accounts, watchlist, positions CRUD — see `docs/ops/atxfinance-backend-http-api.md`). When `ATXFINANCE_BACKEND_ORIGIN` is set, Next proxies those calls to Spring via `src/lib/backend-bff.ts`.

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
4. **Core CRUD** — portfolios, personas, access-requests (Mongo-heavy, matches Spring Data already in backend).
5. **xChat** — streaming, xAI keys, persona resolution: highest complexity; migrate last or keep on Next until Spring has equivalent streaming + secret handling.
6. **Delete Next route** only after integration tests hit Spring and UI uses the new path.

## Env hooks (repo)

- `ATXFINANCE_BACKEND_ORIGIN` — BFF proxy target (`src/lib/backend-bff.ts`); read via `getAtxfinanceBackendOrigin()` from **`process.env`** (not `getEnv()` zod) so App Router handlers and Vitest do not need xAI/OAuth keys just to evaluate “proxy off”.
- `NEXT_PUBLIC_ATXFINANCE_BACKEND_ORIGIN` — optional; `getPublicAtxfinanceBackendOrigin()` for direct browser → Spring (CORS on Kotlin). Commented in `.env.example`.

## Testing gate

- Per migrated route: **integration test** against Spring (live or Testcontainers) + **contract test** vs OpenAPI.
- Keep `tests/smoke/backend-http-api-parity.test.ts` extended as Spring gains real controllers.

## Related

- `docs/ops/atxfinance-backend-http-api.md` — current Spring surface
- `AGENTS.md` — today’s validation assumes Next API; update when a slice moves
