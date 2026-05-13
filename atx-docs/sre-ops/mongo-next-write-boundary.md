# Mongo write boundary (Next.js vs Spring)

## Immediate rule (sprint policy)

- **No new direct writes from Next to Mongo.** All **POST / PUT / PATCH / DELETE** product paths should hit **Spring** via the BFF (`ATXFINANCE_BACKEND_ORIGIN` + `proxy*RequestToBackend` / entries in `src/lib/bff-proxy-routes.ts`), or call a **repository** in `src/modules/**` that is explicitly scheduled for JVM migration.
- **Reads** may remain on Next + Mongo for high-churn GETs (e.g. `GET /api/portfolios/{id}`, xChat workspace preload) until latency/cost tradeoffs say otherwise.

## ESLint

- Plugin: `eslint-rules/atx-mongo-data-plane.mjs`, wired in `eslint.config.mjs`.
  - **`atx-mongo/no-mongo-client-import-outside-lib`** — `MongoClient` import from `mongodb` only in `src/lib/mongodb.ts` (plus `tests/`, `scripts/`, `services/`).
  - **`atx-mongo/no-collection-write-in-app-api-routes`** — blocks `.updateOne`, `.insertOne`, `.deleteOne`, etc. on route files under `src/app/api/**/route.ts(x)` except the small **allowlist** in that file (legacy tenant admin mutations until Spring exposes replacements).

## BFF registry

- Canonical list: **`src/lib/bff-proxy-routes.ts`** (must match Kotlin `@*Mapping` needles; see `tests/smoke/backend-http-api-parity.test.ts`).
- Kotlin HTTP inventory: **`atx-docs/sre-ops/atxfinance-backend-http-api.md`**.

## Short-term (4–6 weeks)

Move **writes** for **`portfolio_positions`**, **watchlist**, **`admin_scheduled_tasks`** (tenant tasks remain Next-orchestrated today — see `backend-bff.ts` `shouldProxyAdminScheduledTasksToBackend`), **`xchat_user_preferences`**, and **`strategy_jobs`** to Spring; keep Next **GET** hot paths on Mongo until explicitly migrated.
