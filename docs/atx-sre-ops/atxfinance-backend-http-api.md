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

## App user recommendations (`app_user_recommendations`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/recommendations` | **200** `{ "data": [...] }`. **401** / **403** if session roles cannot log in (mirrors Next `canUserLogin`). |
| POST | `/api/recommendations` | **201** `{ "data": ... }`. Body aligned with Next (`title`, optional `summary`, `scopeTags`, `payload`, `status`). **400** on invalid body. |
| GET | `/api/recommendations/{recommendationId}` | **200** `{ "data": ... }` or **404**. Tenant scope matches legacy Next `withTenantScope`. |

## Portfolio recommendations (`portfolio_recommendations`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portfolios/{portfolioId}/recommendations` | **200** `{ "data": [...] }` or **404** if portfolio not accessible. |
| POST | `/api/portfolios/{portfolioId}/recommendations` | **201** `{ "data": ... }` or **404** / **400** (invalid payload). |

## Strategy options (Yahoo + synthetic fallback)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/strategy-options/expirations` | Query `underlying` (required). **200** `{ underlying, expirationDates }` or **400** / **500** on Yahoo failure. |
| GET | `/api/strategy-options` | Query `underlying`, `expiration`, optional `strike`. **200** option chain JSON (Yahoo when available, else synthetic model). **401** if unauthenticated. |

## Strategy jobs (Phase 1 orchestrator, Mongo)

Session cookie + **`viewer`+** roles (`canUserLogin`). Isolation: **`userId` + `tenantId` + `emailAccountId`** (body `emailAccountId` optional; defaults to normalized session email or `"primary"`). Collection **`strategy_jobs`** (override `STRATEGY_JOBS_COLLECTION`). Rate limit: **`STRATEGY_MAX_JOBS_HOURLY`** (default **12**) creations per scope per rolling hour — **429** `rate_limited`. **`STRATEGY_SOFT_WARN_JOBS_HOURLY`** (default **8**) surfaces `meta.softWarn` on **201**. Optional header **`Idempotency-Key`**: replay within **24h** returns **200** `{ data, meta: { idempotentReplay: true } }`.

**Indexes (ops):** compound `{ userId: 1, tenantId: 1, emailAccountId: 1, createdAt: -1 }` for rate-limit counts; optional partial unique on `{ userId, tenantId, emailAccountId, idempotencyKey }` where `idempotencyKey` exists (not created by the app yet — add via Atlas/ops when volume warrants).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/strategy-jobs` | **201** `{ "data", "meta" }` — starts slot collection (`status`: `collecting`). **200** idempotent replay. **429** rate limited. |
| GET | `/api/strategy-jobs/{jobId}` | **200** `{ "data" }` job state, `nextPrompt` / `nextChoices` for current slot, or **404**. |
| POST | `/api/strategy-jobs/{jobId}/turns` | Body `{ "message": string }` (free-text slots) or `{ "choice": number }` (1-based for numbered slots). **200** `{ "data" }`; **400** `job_not_collecting` / `invalid_turn_payload`; **404** not found. When all slots filled, `status` becomes **`slots_complete`** (LLM finalizer = Chunk 2). |

## User feedback

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/user-feedback` | **201** `{ "ok": true }`. Body `{ "message", "page"? }`. Posts to **`SLACK_WEBHOOK_URL`** when set (same as Next). |

## Admin (global_admin session)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/bootstrap-status` | **200** bootstrap/index/seed snapshot. Uses env **`ADMIN_SEED_EMAIL`** (same as Next). |
| GET | `/api/admin/audit` | **200** `{ "data": [...] }` with optional filters (`entityType`, `entityId`, `action`, `actor`, `from`, `to`, `limit`). |
| GET | `/api/admin/access-requests` | **Global admin only.** **200** `{ "data": [...] }`. Query `status`: `open` (default) \| `all` \| single status (`new`, `triaged`, `pending`, `approved`, `rejected`, `expired`). Rows include `user` / `reviewedByUser` summaries from **`core_users`** and optional `latestAuditEvent`. |
| POST | `/api/admin/access-requests` | **Global admin only.** Create on behalf of a user: body `userId` **or** `email`, `requestedRole`, `reason` (≥5 chars), optional `requestedPlan`, optional `status`. **201** with `meta.resolvedUserId`. **409** if pending exists. |
| GET | `/api/admin/access-requests/{requestId}` | **Global admin only.** **200** `{ "data": { ...request, auditTrail: [...] } }` or **404**. |
| PATCH \| PUT | `/api/admin/access-requests/{requestId}` | **Global admin only.** Review: body `status` (`approved`\|`rejected`) and/or `requestedPlan`. Plan-only updates **200**; approval applies **`global_admin`** role + subscription plan + default portfolio provision (`DefaultPortfolioProvisionService`). Full xAI/bootstrap async pipeline remains Next-only — JVM writes audit `bootstrap_deferred` or `alert-user-not-sync-warning` when email missing. **409** if already reviewed. |
| DELETE | `/api/admin/access-requests/{requestId}` | **Global admin only.** **200** `{ "data": { deleted, requestId } }` or **404**. **400** invalid id. |
| GET \| POST | `/api/admin/users` | **Global admin only.** List **`core_users`** (query `limit` 1–500, default 100) with `latestAuditEvent`; or create user (**201**) with `email`, `role`, `subscriptionPlan`, `status`. **409** duplicate email. Non–`global_admin` creates **`core_tenant_memberships`** `member` for session tenant. |
| GET | `/api/admin/users/approved` | **Global admin only.** **200** `{ "data": [...] }` — approved access requests + tenant **`global_admin`** users without duplicate rows (parity with Next `listApprovedUsers`). |
| GET \| PUT \| DELETE | `/api/admin/users/{userId}` | **Global admin only.** **GET** user + `auditTrail`; **PUT** partial update (≥1 field); **DELETE** user. **409** duplicate email on email change. |
| PATCH | `/api/admin/users/{userId}/role` | **Global admin only.** Body `{ "role" }`. **200** `{ userId, role }`. |
| PATCH | `/api/admin/users/{userId}/plan` | **Global admin only.** Body `{ "subscriptionPlan" }`. **200** `{ userId, subscriptionPlan }`. |
| PATCH | `/api/admin/users/{userId}/email` | **Global admin only.** Body `{ "email" }`. **409** duplicate email. |
| GET \| PUT | `/api/admin/users/{userId}/settings` | **Global admin only.** **`admin_user_settings`** + `metadata.linkedCollections` (default + bootstrap + assigned persona). **PUT** validates published persona when `assignedPersonaId` set. **404** missing settings or persona. |
| GET \| POST | `/api/admin/tasks` | **Global admin only.** **GET** **200** `{ "data": [...] }` from **`admin_scheduled_tasks`** (tenant-scoped, `limit` default 50). **POST** **201** `{ "data": ... }` — body `name`, `category` (`sync-broker` \| `rebalance` \| `compliance` \| `notifications`), `scheduleCron`, `enabled`; default `nextRunAt` +5m. **400** invalid payload. |
| POST | `/api/admin/tasks/{taskId}/run` | **Global admin only.** Executes task simulation, writes **`admin_task_runs`**. **200** `{ "data": { "runId", "status", "output" } }`. **404** unknown task. |
| GET | `/api/admin/task-runs` | **Global admin only.** **200** `{ "data": [...] }` recent runs from **`admin_task_runs`** (tenant-scoped, `limit` default 50). |
| POST | `/api/admin/scheduler/tick` | **Global admin only.** Loads due enabled tasks (`nextRunAt` ≤ now), runs each. **200** `{ "data": { "processed", "results" } }`. |
| GET \| POST | `/api/admin/deploy-note-configs` | **Global admin only.** List (query `limit` 1–200, `environment` staging\|production) or create deploy-note config. **200** `{ "data": [...] }`, **201** on create. |
| GET \| PUT \| DELETE | `/api/admin/deploy-note-configs/{configId}` | **Global admin only.** Get, update (partial), or delete config. **404** when not found. |
| POST | `/api/admin/import/broker` | **Global admin only.** Merrill/Fidelity holdings CSV import. Body: `portfolioId`, `broker` (merrill\|fidelity), `exportType` (holdings), `csv`, `mappings` (broker account ref → core account id), optional `fidelityHoldingsDefaultAccountRef`, optional `dryRun`. **200** `{ "results": [...] }` or `{ "dryRun": true, "accounts": [...] }`. |

**Audit semantics:** `actor` filter behavior can differ between Next (regex on email/username) and Kotlin (exact userId/email/username match) — see `docs/atx-sre-ops/audit-lineage-and-controls.md`.

## RAG files (inventory + upload)

RAG **file inventory** is stored in Mongo collection **`xai_collections`** (legacy name `xchat_rag_files` may still exist for one-off migrations). Text chunks for semantic fallback remain in **`xchat_rag_chunks`**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/rag/files` | **Global admin only.** **200** `{ "data": [...] }` from `xai_collections` (optional `scope` query). |
| POST | `/api/rag/files` | **Global admin only.** `multipart/form-data` with field **`file`** and optional **`scope`** (default `global`). Uploads to xAI `POST /v1/files` (`XAI_API_KEY`, optional `XAI_BASE_URL`; default `https://api.x.ai/v1` from `tenant_defaults.yaml` when unset), inserts into `xai_collections`, chunks text-like files into `xchat_rag_chunks`. **201** `{ "data": ... }`. **400** bad input. **413** too large (max 5 MiB file). |
| GET | `/api/rag/files/{fileId}/readiness` | **Global admin only.** Polls xAI file metadata, updates Mongo `xaiProcessingStatus`, returns **200** `{ "data": { "fileId", "xaiFileId", "readiness", "processingStatus", "message?", "checkedAt" } }`. **404** file not found. **400** invalid file id. |

## Personas (`xchat_personas`, session + roles)

Session cookie must include **`roles`** (JSON array) so Kotlin can enforce **`global_admin`** for mutations (same as Next `requireAdminSession`). Legacy role `admin` is treated as `global_admin`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/personas` | **200** `{ "data": [...] }`. Non–global-admin: `status=published` only. Global admin: optional `?status=draft\|published\|archived`, or all personas. Each row may include `latestAuditEvent` (admin only) from `admin_audit_events`. |
| POST | `/api/personas` | **Global admin only.** **201** `{ "data": ... }`. **409**/`PERSONA_NAME_CONFLICT` on duplicate normalized name. **413** if `Content-Length` > 32 KiB. |
| GET | `/api/personas/{personaId}` | **Global admin only.** **200** `{ "data": { ...persona, auditTrail: [...] } }` or **404**. |
| PUT | `/api/personas/{personaId}` | **Global admin only.** **200** `{ "data": ... }`. **400** invalid payload (incl. file_search collection rules), **404**, **409** name conflict. |
| DELETE | `/api/personas/{personaId}` | **Global admin only.** **200** `{ "ok": true }` or **404**. |

**Note:** Kotlin validates persona payloads and `xapi`/`file_search` rules in line with the Next.js zod schemas; error shapes may differ slightly (e.g. `details` flatten).

## Access requests (`admin_access_requests`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/access-requests` | Body `{ "requestedRole"?: "advisor"\|"operator"\|"viewer", "reason": string (3–500) }`. **201** `{ "ok": true, "data": { requestedRole, status, requestedAt } }`. **409** if a pending request exists for the same user + role. Inserts **`admin_audit_events`** (`self_requested`) and posts to **`SLACK_WEBHOOK_URL`** when configured (parity with Next). |

## OpenAPI / Swagger UI

SpringDoc OpenAPI 2.x (see `services/atxfinance-backend/build.gradle.kts`):

| Purpose | URL (local) |
|---------|-------------|
| Swagger UI | `http://localhost:8080/swagger-ui.html` (may redirect to `/swagger-ui/index.html`) |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |

## Configuration (Mongo)

Resolution order for Spring Data Mongo URI (high level):

1. **`MONGODB_URI_B64`** — if set, `MongoUriEnvPostProcessor` decodes and injects `spring.data.mongodb.uri` at highest precedence (same pattern as the core Next.js app).
2. Else **`spring.data.mongodb.uri`** from `application.yml` / env: `MONGODB_URI` or `SPRING_DATA_MONGODB_URI` or default `mongodb://localhost:27017/${SPRING_DATA_MONGODB_DATABASE:${MONGODB_DB_NAME:atxfinancedb}}`.
3. **`spring.data.mongodb.database`** is set explicitly from `SPRING_DATA_MONGODB_DATABASE` or `MONGODB_DB_NAME` (default `atxfinancedb`) when using the default URI.

Docker Compose sets `SPRING_DATA_MONGODB_URI` explicitly for the `atxfinance-backend` service unless overridden by `.env` / `MONGODB_URI_B64`.

## Auth / OAuth (Next-primary; Spring cutover planned)

**Today:** X OAuth **start** and **`GET /api/auth/x/callback`** run on the **Next.js** core app (`src/app/api/auth/x/*`). This Spring service validates the same **`xf_core_session`** cookie as Next when requests are BFF-proxied or forwarded with the browser `Cookie` header.

**Planned:** Spring-owned callback, Redis-backed PKCE, and dual-run cutover — see [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md) and the *Auth callback contract* in [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md).

## Testing

- **JVM unit tests:** from `services/atxfinance-backend`: `./gradlew test`
- **Repo gate (Node):** `npm run ci:gate` includes `tests/smoke/backend-http-api-parity.test.ts` for doc ↔ Kotlin parity (no live server).

## Related

- **Auth / OAuth dual-run (gaps + checklist):** [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md)
- **Consolidating product APIs in Spring (migration plan):** `docs/atx-sre-ops/api-consolidation-spring-backend.md`
- Runbook-style notes: `docs/atx-sre-ops/junie-guidelines-atxfinance-backend.md`
- Local stack: `DEVELOPMENT.md` → *Local Setup (Backend → Frontend)*
