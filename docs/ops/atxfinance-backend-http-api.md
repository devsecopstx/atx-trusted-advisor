# atxfinance-backend — HTTP API (Kotlin / Spring Boot)

**Base URL (local Compose):** `http://localhost:8080`  
**Scope:** Scheduler / worker service built from repo-root `Dockerfile` and `services/atxfinance-backend`. This is **not** the Next.js App Router API (`http://localhost:3000/api/*`).

Canonical route list is enforced by `tests/smoke/backend-http-api-parity.test.ts` (Vitest) against Kotlin sources + this document.

## Health & ops

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/actuator/health` | Spring Boot Actuator liveness/readiness (`management.*`). Response is standard actuator JSON (e.g. `{ "status": "UP" }` when authorized to see details per config). |
| GET | `/api/health` | **Compatibility shim:** lightweight check: Mongo connectivity via `MongoClient`, plus **presence-only** secrets flags (no secret values). `details.secrets` is `ok` if any of `MONGODB_URI`, `SPRING_DATA_MONGODB_URI`, or `MONGODB_URI_B64` is set in the process environment (matches Docker Compose and Atlas-style deploys). |
| GET | `/api/backend/health` | **SRE / diagnostics:** service name, UTC time, `activeProfiles`, masked Mongo URI (`uriMasked`), resolved host/database, mongo ping status, and env **flags** only (`MONGODB_URI_B64_present`, etc.). HTTP **200** even when nested `details.mongo.status` is `error` (inspect body). |

## Portfolios (session cookie, Mongo CRUD)

Same contracts as the matching Next.js App Router handlers when the core app **BFF-proxies** to this service (`ATXFINANCE_BACKEND_ORIGIN`). Forward the browser `Cookie` header (session name `xf_core_session`, HMAC signed with `AUTH_SECRET` or `X_OAUTH_CLIENT_SECRET` — same as Next).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portfolios/{portfolioId}` | **200** `{ "data": { ... } }` summary payload (accounts from `portfolio_accounts`, portfolio from `tenant_portfolio` / `TENANT_PORTFOLIO_COLLECTION`). **401** / **400** invalid id / **404** not owned. |
| PATCH | `/api/portfolios/{portfolioId}` | Body `{ "name": string }` (1–200 chars). **200** `{ "data": ... }`. |
| GET | `/api/portfolios/default` | **200** `{ "data": ... }` default portfolio summary; provisions default portfolio + account + watchlist when missing (aligned with `provisionDefaultPortfolioForUser`). |
| POST | `/api/portfolios/default` | **200** `{ "data": ..., "synced": true }` same as GET + sync flag; **500** on provision failure (same user-facing message as Next). |
| GET | `/api/portfolios/current` | Same as **GET** `/api/portfolios/default`. |
| GET | `/api/portfolios/{portfolioId}/accounts` | **200** `{ "data": [...] }` account rows with embedded **positions** from `portfolio_positions`. Provisions defaults if account list empty. |
| POST | `/api/portfolios/{portfolioId}/accounts` | Body `{ "name", "type"?, "extAccountId"?, "cashBalance"? }`. **201** `{ "data": row }`. |
| PATCH | `/api/portfolios/{portfolioId}/accounts/{accountId}` | Patch `name` / `cashBalance` / `extAccountId` (at least one). **200** `{ "data": ... }` BSON document as JSON map. |
| GET | `/api/portfolios/{portfolioId}/watchlist` | **200** `{ "data": { ...watchlist, symbols, symbolsDetailed }, "metadata" }`. Query `quotes=1` adds `symbolsWithQuotes` with `quote: null` per row (live Yahoo quotes not implemented on JVM yet — `metadata.symbolLookupEnabled` is **false** until a quote provider is wired). |
| PATCH | `/api/portfolios/{portfolioId}/watchlist` | Body: `addSymbols` / `addEntries` / `removeSymbols` / `dedupe` (same rules as Next; caps per patch from `app.atxfinance.max-watchlist-symbols-per-patch`, default 20). **400** `Invalid payload` if no mutation. |

## Positions (session cookie, Mongo CRUD)

Same BFF contract as Next `src/app/api/positions/**`. Query params `portfolioId` and `accountId` are required for **GET** and **DELETE**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/positions` | Query `portfolioId`, `accountId`. **200** `{ "data": [...] }` rows from `portfolio_positions` for that account. **400** missing query / **401** / **404** account not in portfolio (`Account not found`). |
| POST | `/api/positions` | Legacy body `{ portfolioId, accountId, symbol, qty, avgCost }` or OpenAPI-style `{ portfolioId, accountId, ticker, type?, shares?, contracts?, ... }` (same normalization as Next). **201** `{ "data": ... }`. **400** invalid payload (legacy + openapi parse errors in `details`) or validation; **404** account not in portfolio; position validation errors mirror Next (`code` + `error`). |
| DELETE | `/api/positions/{positionId}` | Query `portfolioId`, `accountId`. **200** `{ "ok": true }`. **404** account not in portfolio or position not found. |

## OpenAPI / Swagger UI

SpringDoc OpenAPI 2.x (see `services/atxfinance-backend/build.gradle.kts`):

| Purpose | URL (local) |
|---------|-------------|
| Swagger UI | `http://localhost:8080/swagger-ui.html` (may redirect to `/swagger-ui/index.html`) |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |

## Configuration (Mongo)

Resolution order for Spring Data Mongo URI (high level):

1. **`MONGODB_URI_B64`** — if set, `MongoUriEnvPostProcessor` decodes and injects `spring.data.mongodb.uri` at highest precedence (same pattern as the core Next.js app).
2. Else **`spring.data.mongodb.uri`** from `application.yml` / env: `MONGODB_URI` or `SPRING_DATA_MONGODB_URI` or default `mongodb://localhost:27017/${MONGODB_DB_NAME:atxfintechdb}`.

Docker Compose sets `SPRING_DATA_MONGODB_URI` explicitly for the `atxfinance-backend` service unless overridden by `.env` / `MONGODB_URI_B64`.

## Testing

- **JVM unit tests:** from `services/atxfinance-backend`: `./gradlew test`
- **Repo gate (Node):** `npm run ci:gate` includes `tests/smoke/backend-http-api-parity.test.ts` for doc ↔ Kotlin parity (no live server).

## Related

- **Consolidating product APIs in Spring (migration plan):** `docs/ops/api-consolidation-spring-backend.md`
- Runbook-style notes: `docs/ops/junie-guidelines-atxfinance-backend.md`
- Local stack: `DEVELOPMENT.md` → *Local Setup (Backend → Frontend)*
