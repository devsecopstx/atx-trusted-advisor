# atxfinance-backend — HTTP API (Kotlin / Spring Boot)

**Base URL (local Compose):** `http://localhost:8080`  
**Scope:** Scheduler / worker service built from repo-root `Dockerfile` and `services/atxfinance-backend`. This is **not** the Next.js App Router API (`http://localhost:3000/api/*`).

Canonical route list is enforced by `tests/smoke/backend-http-api-parity.test.ts` (Vitest) against Kotlin sources + this document.

## Health & ops

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/actuator/health` | Spring Boot Actuator liveness/readiness (`management.*`). Response is standard actuator JSON (e.g. `{ "status": "UP" }` when authorized to see details per config). |
| GET | `/api/health` | **Compatibility shim:** Mongo via `MongoClient`; **presence-only** secrets flags; **`details.redis`**: `ok` \| `error` \| `skipped` (skipped when `REDIS_URL` unset). |
| GET | `/api/backend/health` | **SRE / diagnostics:** service name, UTC time, `activeProfiles`, masked Mongo URI (`uriMasked`), mongo ping, **`details.redis`** (same semantics as `/api/health`), env flags including `REDIS_URL_present`. HTTP **200** even when nested `details.mongo.status` is `error` (inspect body). |

## Portfolios (session cookie, Mongo CRUD)

Same contracts as the matching Next.js App Router handlers when the core app **BFF-proxies** to this service (`ATXFINANCE_BACKEND_ORIGIN`). Forward the browser `Cookie` header (session name `xf_core_session`, HMAC signed with `AUTH_SECRET` or `X_OAUTH_CLIENT_SECRET` — same as Next).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portfolios/{portfolioId}` | **200** `{ "data": { ... } }` summary payload (accounts from `portfolio_accounts`, portfolio from `tenant_portfolio` / `TENANT_PORTFOLIO_COLLECTION`). **401** / **400** invalid id / **404** not owned. |
| PATCH | `/api/portfolios/{portfolioId}` | Body `{ "name": string }` (1–200 chars). **200** `{ "data": ... }`. |
| GET | `/api/portfolios/default` | **200** `{ "data": ... }` default portfolio summary; provisions default portfolio + account + watchlist when missing (aligned with Next `provisionDefaultPortfolioForUser`). Repeat provision does **not** reset **`extAccountId`** or **`type`** on an **existing** default account (**≥3.7.3**). |
| POST | `/api/portfolios/default` | **200** `{ "data": ..., "synced": true }` same as GET + sync flag; **500** on provision failure (same user-facing message as Next). |
| GET | `/api/portfolios/current` | Same as **GET** `/api/portfolios/default`. |
| GET | `/api/portfolios/{portfolioId}/accounts` | **200** `{ "data": [...] }` account rows with embedded **positions** from `portfolio_positions`. Provisions defaults if account list empty. |
| POST | `/api/portfolios/{portfolioId}/accounts` | Body `{ "name", "type"?, "extAccountId"?, "cashBalance"? }`. **201** `{ "data": row }`. |
| PATCH | `/api/portfolios/{portfolioId}/accounts/{accountId}` | Patch any of: `name`, `cashBalance`, `extAccountId`, `type`, `riskProfile`, `outlook` (at least one key). `riskProfile`: `conservative` \| `balanced` \| `growth` or JSON `null` to clear. `outlook`: `bullish` \| `neutral` \| `bearish` or aliases (`growth`→bullish, `balanced`→neutral, …) or `null` to clear. **`409`** if `brokerImportLocked` and body includes **`type`** only (`extAccountId` remains patchable). **200** `{ "data": ... }` updated account document as JSON map. |
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

Session cookie + **`viewer`+** roles (`canUserLogin`). Isolation: **`userId` + `tenantId` + `emailAccountId`** (create body `emailAccountId` optional; defaults to normalized session email or `"primary"`). **GET** / **turns** must use the **same** normalized `emailAccountId` as the job (optional query `emailAccountId` on GET; optional body field on turns — if omitted, server uses the same default as create). Collection **`strategy_jobs`** (override `STRATEGY_JOBS_COLLECTION`). Rate limit: **`STRATEGY_MAX_JOBS_HOURLY`** (default **12**) per rolling hour — **429** `rate_limited`. When **`REDIS_URL`** is set, an hourly Redis counter is the primary fuse (keyed to **`tenantId` + `userId` + normalized `emailAccountId`**, same scope as Mongo count); Mongo still queried for `meta` / soft warn. When unset, Mongo count only. **`STRATEGY_SOFT_WARN_JOBS_HOURLY`** (default **8**) surfaces `meta.softWarn` on **201**. Optional header **`Idempotency-Key`**: replay within **24h** returns **200** `{ data, meta: { idempotentReplay: true } }`.

**Indexes + TTL:** ensured on backend startup (`StrategyJobMongoIndexes`): **`idx_strategy_jobs_scope_created_desc`** `{ tenantId, userId, emailAccountId, createdAt }` for list + hourly count; **`idx_strategy_jobs_scope_status_created_desc`** adds `status` before `createdAt` for status-scoped reads; partial **`idx_strategy_jobs_idempotency_partial`** (same keys + `idempotencyKey`, only when `idempotencyKey` exists). **`STRATEGY_JOBS_TTL_DAYS`** (default **90**, **`0`** = off) sets `expiresAt` on create and TTL index **`ttl_strategy_jobs_expires_at`** on `expiresAt`. See `atx-docs/sre-ops/mongo-indexing-guide.md`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/strategy-jobs` | Query `limit` 1–50 (default **20**), optional `emailAccountId` (must match normalized scope). **200** `{ "data": { "jobs": [...] } }` — newest first; each job summary matches `jobToDataMap` (includes `createdAt` / `updatedAt` epoch ms when present). |
| POST | `/api/strategy-jobs` | **201** `{ "data", "meta" }` — starts slot collection (`status`: `collecting`). **200** idempotent replay. **429** rate limited. |
| GET | `/api/strategy-jobs/{jobId}` | Optional query `emailAccountId` (must match job after normalization). **200** `{ "data" }` job state, `nextPrompt` / `nextChoices` for current slot, or **404**. |
| POST | `/api/strategy-jobs/{jobId}/turns` | Body `{ "message": string }` or `{ "choice": number }` (1-based); optional `emailAccountId` (must match job). **200** `{ "data" }`; **400** `job_not_collecting` / `invalid_turn_payload`; **404** not found. When all slots filled, `status` becomes **`slots_complete`** and **`artifactStatus`** is set to **`pending`**; the LLM finalizer runs async (or sync for `global_admin` when **`STRATEGY_FINALIZER_SYNC_FOR_GLOBAL_ADMIN=true`**). |
| GET | `/api/strategy-jobs/{jobId}/artifact` | Optional query `emailAccountId` (must match job). Job must be **`slots_complete`**. **200** `{ "data": { "artifactStatus", … } }` — while **`pending`** / **`running`**, poll; **`ready`** includes `artifactMarkdown`, `artifactJson`, `artifactModel`; **`failed`** includes `errorCode` / `errorMessage` (structured codes, no silent fallback). **400** `artifact_not_ready` if job not `slots_complete`. **404** not found. |

**Next.js BFF:** Browsers call the same paths on the **Next** host (`src/app/api/strategy-jobs/*`). Next forwards to Spring when **`ATXFINANCE_BACKEND_ORIGIN`** is set and **`shouldProxyAdminUsersToBackend()`** is true (`src/lib/backend-bff.ts`, same gate as portfolios and strategy-options). If the proxy does not run, Next returns **503** `service_unavailable` with an operator hint (unset origin vs loopback + dev). There are **no** `ATXFINANCE_BACKEND_PROXY_*` toggles — disable BFF by unsetting **`ATXFINANCE_BACKEND_ORIGIN`**. See **`AGENTS.md`** / **`.env.example`**.

**Finalizer env (JVM):** `STRATEGY_FINALIZER_MODEL` (default `grok-4-1-fast-reasoning`), `STRATEGY_FINALIZER_SYNC_FOR_GLOBAL_ADMIN`, `STRATEGY_FINALIZER_MULTI_AGENT_FOR_GLOBAL_ADMIN`, optional `STRATEGY_TEAM_KB_COLLECTION_ID` (else team KB from `XAI_TEAM_ID` when it resolves to `collection_*`), optional `STRATEGY_FINALIZER_NON_ADMIN_MODEL` when multi-agent is not used. Requires `XAI_API_KEY` (same as xChat).

## User feedback

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/user-feedback` | **201** `{ "ok": true }`. Body `{ "message", "page"? }`. Posts to **`SLACK_WEBHOOK_URL`** when set (same as Next). |

## Admin (global_admin session)

**Next-only admin routes (not implemented on this JVM service):** Options-strategy catalog and Mongo-backed preferences — `GET|POST /api/admin/options-strategy`, `GET|PATCH|DELETE /api/admin/options-strategy/{strategyId}`, `GET /api/admin/options-strategy-preferences`, `GET|PATCH /api/admin/options-strategy-preferences/{preferenceId}`. Documented under the core app OpenAPI tag **`admin-options-strategy`** and [`guides/api-endpoints.md`](../guides/api-endpoints.md).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/bootstrap-status` | **200** bootstrap/index/seed snapshot. Uses env **`ADMIN_SEED_EMAIL`** (same as Next). |
| GET | `/api/admin/audit` | **200** `{ "data": [...] }` with optional filters (`entityType`, `entityId`, `action`, `actor`, `from`, `to`, `limit`). |
| GET | `/api/admin/access-requests` | **Global admin only.** **200** `{ "data": [...] }`. Query `status`: `open` (default) \| `all` \| single status (`new`, `triaged`, `pending`, `approved`, `rejected`, `expired`). Rows include `user` / `reviewedByUser` summaries from **`core_users`** and optional `latestAuditEvent`. |
| POST | `/api/admin/access-requests` | **Global admin only.** Create on behalf of a user: body `userId` **or** `email`, `requestedRole`, `reason` (≥5 chars), optional `requestedPlan`, optional `status`. **201** with `meta.resolvedUserId`. **409** if pending exists. |
| GET | `/api/admin/access-requests/{requestId}` | **Global admin only.** **200** `{ "data": { ...request, auditTrail: [...] } }` or **404**. |
| PATCH \| PUT | `/api/admin/access-requests/{requestId}` | **Global admin only.** Update plan (`requestedPlan`), role (`requestedRole`), tenant (`targetTenantId`, hex or `""` to clear), optional `reviewNote`, and/or `status` (`approved`\|`rejected`). Payload must include at least one of `status`, `requestedPlan`, `requestedRole`, `targetTenantId` (not `reviewNote` alone). **Next.js:** `approved` requires the same request to send non-empty `targetTenantId`, `requestedPlan`, and `requestedRole`; row must have `tenantId` after updates or **400** (`access_request_tenant_required`). Applies **`requestedRole`** to `core_users`, subscription plan, `upsertTenantMembership`, default portfolio provision; optional `reviewNote` on the row + audit. **409** if already reviewed. Kotlin parity: align `DefaultPortfolioProvisionService` / review validation with Next when BFF handles approval. |
| DELETE | `/api/admin/access-requests/{requestId}` | **Global admin only.** **200** `{ "data": { deleted, requestId } }` or **404**. **400** invalid id. |
| GET \| POST | `/api/admin/users` | **Global admin only.** List **`core_users`** (query `limit` 1–500, default 100) with `latestAuditEvent`; or create user (**201**) with `email`, `role`, `subscriptionPlan`, `status`. **409** duplicate email. Non–`global_admin` creates **`core_tenant_memberships`** `member` for session tenant. |
| GET | `/api/admin/users/approved` | **Global admin only.** **200** `{ "data": [...] }` — approved access requests + tenant **`global_admin`** users without duplicate rows (parity with Next `listApprovedUsers`). |
| GET \| PUT \| DELETE | `/api/admin/users/{userId}` | **Global admin only.** **GET** user + `auditTrail`; **PUT** partial update (≥1 field); **DELETE** — **destructive:** purges Mongo rows tied to that user id and normalized email (portfolios + nested book, memberships, settings, access requests, xChat logs, app recommendations, options prefs, feature usage, strategy jobs, login audit, bootstrap profile, `access-request-bootstrap:{email}` tasks), then removes **`core_users`**. **400** if `userId` equals session user (cannot delete self). **409** duplicate email on email change. |
| PATCH | `/api/admin/users/{userId}/role` | **Global admin only.** Body `{ "role" }`. **200** `{ userId, role }`. |
| PATCH | `/api/admin/users/{userId}/plan` | **Global admin only.** Body `{ "subscriptionPlan" }`. **200** `{ userId, subscriptionPlan }`. |
| PATCH | `/api/admin/users/{userId}/email` | **Global admin only.** Body `{ "email" }`. **409** duplicate email. |
| GET \| PUT | `/api/admin/users/{userId}/settings` | **Global admin only.** **`admin_user_settings`** + `metadata.linkedCollections` (default + bootstrap + assigned persona). **PUT** validates published persona when `assignedPersonaId` set. **404** missing settings or persona. |
| GET \| POST | `/api/admin/tasks` | **Global admin only.** **GET** **200** `{ "data": [...] }` from **`admin_scheduled_tasks`** (tenant-scoped, `limit` default 50). **POST** **201** `{ "data": ... }` — body `name`, `category` (must match Kotlin **`ALLOWED_CATEGORIES`** / Next **`SCHEDULED_TASK_CATEGORIES`** — includes e.g. `price_scanner`, `options_scanner`, `sync-broker`, `rebalance`, `compliance`, `notifications`, `user-history`, `watchlist_price_scanner`, and Phase 3 ids: `corporate_events_scanner`, `income_cash_flow_projector`, `options_expiration_roll_manager`, `risk_concentration_scanner`, `tax_loss_harvest_scanner`), `scheduleCron`, `enabled`; default `nextRunAt` +5m. **400** invalid payload. **Note:** Scanner categories are **executed on Next** (`task-runner.ts`); Kotlin create/list may still be used for parity when BFF is enabled. |
| POST | `/api/admin/tasks/{taskId}/run` | **Global admin only.** Executes task simulation, writes **`admin_task_runs`**. **200** `{ "data": { "runId", "status", "output" } }`. **404** unknown task. |
| GET | `/api/admin/task-runs` | **Global admin only.** **200** `{ "data": [...] }` recent runs from **`admin_task_runs`** (tenant-scoped, `limit` default 50). |
| POST | `/api/admin/scheduler/tick` | **Global admin only.** Loads due enabled tasks (`nextRunAt` ≤ now) for the **session tenant**, runs each. **200** `{ "data": { "processed", "results" } }`. **Production:** the JVM also runs an internal **60s** poller (`AdminSchedulerPoller`) for **all** tenant-level due tasks with `triggeredBy` **`system-scheduler`** — no external cron required when backend **min-instances ≥ 1**. |
| GET \| POST | `/api/admin/deploy-note-configs` | **Global admin only.** List (query `limit` 1–200, `environment` staging\|production) or create deploy-note config. **200** `{ "data": [...] }`, **201** on create. |
| GET \| PUT \| DELETE | `/api/admin/deploy-note-configs/{configId}` | **Global admin only.** Get, update (partial), or delete config. **404** when not found. |
| GET \| POST | `/api/admin/delivery-channels` | **Global admin only.** Platform delivery channels (`admin_delivery_channels`): `name`, `deliveryTarget` (`in_app` \| `slack` \| `email`), optional `slackWebhookUrl` (required for Slack — `https://hooks.slack.com/services/…` only), optional `emailTo` (required for `email` — recipient address; SMTP via same env as portfolio desk email). |
| GET \| PATCH \| DELETE | `/api/admin/delivery-channels/{channelId}` | **Global admin only.** Get, partial update, or delete channel. **404** when not found. |
| POST | `/api/admin/delivery-channels/{channelId}/test` | **Global admin only.** Sends test text `hello from atx \| tenant=… \| at=…` to Slack, SMTP (`email`), or returns an in-app acknowledgement when `deliveryTarget` is `in_app`. Optional env (JVM): **`DESK_DELIVERY_CHANNEL_TEST_TO`** (valid email) redirects the SMTP test recipient; **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`** overrides subject (max 200 chars). JSON may include **`usedEnvRecipientOverride: true`** when the env recipient was used. **400** if recipient/subject resolution fails; **502** if Slack post or SMTP send fails. **Note:** Next.js product traffic for tenant delivery-channels is **not** BFF-proxied; this row documents Spring parity for direct backend callers. |
| POST | `/api/admin/import/broker` | **Global admin only.** Merrill/Fidelity holdings CSV import. Body: `portfolioId`, `broker` (merrill\|fidelity), `exportType` (holdings), `csv`, `mappings` (broker account ref → core account id), optional `fidelityHoldingsDefaultAccountRef`, optional `dryRun`. **200** `{ "results": [...] }` or `{ "dryRun": true, "accounts": [...] }`. |
| GET \| POST | `/api/admin/portfolios` | **Global admin only.** **GET** **200** `{ "data": [...] }` — portfolios with `accountCount`, `totalCashBalance`, `userDisplayName`, `userEmail` (parity with Next). **POST** **201** `{ "data": portfolio }` — body `userId`, `name`, optional `isDefault`, `tenantId`, `broker_type`. **400** on validation / duplicate name. |
| GET \| PATCH \| DELETE | `/api/admin/portfolios/{portfolioId}` | **Global admin only.** **GET** **200** `{ "data": { …portfolio, accountCount, totalCashBalance } }` or **404**. **PATCH** body optional fields `name`, `ext_broker_ref`, `broker_type`, `riskProfile`, `outlook`, `isDefault` (true clears other defaults for user) — **200** `{ "data": … }` or **400**/**404**. **DELETE** cascades positions, portfolio recommendations, alerts, delivery channels, accounts, watchlists, then portfolio — **200** `{ "ok": true }` or **404**. |
| GET | `/api/admin/portfolios/{portfolioId}/accounts` | **Global admin only.** **200** `{ "data": { portfolio, accountCount, totalCashBalance, accounts } }` (same envelope as Next `admin/portfolios/[portfolioId]/accounts`); **404** invalid id or portfolio missing. |
| POST | `/api/admin/portfolios/{portfolioId}/accounts` | **Global admin only.** Body `name` (required), optional `type` (merrill\|fidelity\|etrade), `extAccountId`, `cashBalance`. **201** `{ "data": account }`. **400** invalid JSON / validation. |
| PATCH | `/api/admin/portfolios/{portfolioId}/accounts/{accountId}` | **Global admin only.** At least one of `name`, `cashBalance`, `extAccountId`, `type`, `isDefault` (true clears other defaults), `riskProfile`, `outlook`. **200** `{ "data": account }`. **404** not found. |
| DELETE | `/api/admin/portfolios/{portfolioId}/accounts/{accountId}` | **Global admin only.** **200** `{ "ok": true }`. **400** last account or not found. |
| GET \| PATCH | `/api/admin/portfolios/{portfolioId}/watchlist` | **Global admin only.** Parity with Next admin watchlist: **GET** **200** `{ "data": { …watchlist } }` (ensures row + default symbol); **404** portfolio missing. **PATCH** body: `addSymbols`, `addEntries`, `removeSymbols`, `dedupe`, `riskProfile`, `outlook` (same semantics as Next); **400** invalid payload; **404** portfolio/watchlist. |
| GET \| POST | `/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions` | **Global admin only.** **GET** **200** `{ "data": { portfolioId, portfolioName, portfolioUserId, account, positions[] } }` (shaped like Next). **POST** stock / option / cash payloads (detailed + legacy) — **201** `{ "data": position }`; **400** validation; **404** portfolio/account. |
| GET \| POST | `/api/admin/portfolios/{portfolioId}/recommendations` | **Global admin only.** **`portfolio_recommendations`** scoped to portfolio owner + tenant. **POST** body `symbol`, `action` (buy\|sell\|hold\|watch), optional `note`, `accountId`, `quantity`, `targetPrice`. |
| PATCH \| DELETE | `/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}` | **Global admin only.** **PATCH** partial update (symbol, action, note, quantity, targetPrice, status). **DELETE** **200** `{ "ok": true }`. |
| GET \| POST | `/api/admin/portfolios/{portfolioId}/alerts` | **Global admin only.** **`portfolio_alerts`**. **POST** `title`, `severity` (info\|warning\|critical), optional `body`, `status`, `symbol`. |
| PATCH \| DELETE | `/api/admin/portfolios/{portfolioId}/alerts/{alertId}` | **Global admin only.** **PATCH** partial fields; **DELETE** `{ "ok": true }`. |
| GET \| POST | `/api/admin/portfolios/{portfolioId}/delivery-channels` | **Global admin only.** **`portfolio_delivery_channels`**. **POST** `kind` (email\|slack_webhook\|sms\|push), `label`, `destination`, optional `enabled`. |
| PATCH \| DELETE | `/api/admin/portfolios/{portfolioId}/delivery-channels/{channelId}` | **Global admin only.** **PATCH** partial; **DELETE** `{ "ok": true }`. |

**BFF registry:** proxied admin portfolio paths are listed in `src/lib/bff-proxy-routes.ts` (Next `proxyRequestToBackend` first, then local fallback).

**Audit semantics:** `actor` filter behavior can differ between Next (regex on email/username) and Kotlin (exact userId/email/username match) — see `./audit-lineage-and-controls.md`.

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
2. Else **`spring.data.mongodb.uri`** from `application.yml` / env: `MONGODB_URI` or `SPRING_DATA_MONGODB_URI` or default `mongodb://localhost:27017/${SPRING_DATA_MONGODB_DATABASE:${MONGODB_DB_NAME:atxfinance}}`.
3. **`spring.data.mongodb.database`** is **not** set in `application.yml`: the database name comes from the **`MONGODB_URI` path** (same as Next.js `getDb()`). Optional env `MONGODB_DB_NAME` / `SPRING_DATA_MONGODB_DATABASE` is for local overrides only; **`ATX_DEPLOY_TARGET` does not append `-stage` / `-prod` to the DB name.**

Docker Compose sets `SPRING_DATA_MONGODB_URI` explicitly for the `atxfinance-backend` service unless overridden by `.env` / `MONGODB_URI_B64`.

## Auth / OAuth (dual-run: Next-primary + JVM parity)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/x/login` | **JVM:** PKCE `state` + `code_verifier`, optional **`REDIS_URL`** PKCE row, Set-Cookie `xf_x_oauth_*`, redirect to X authorize URL. **503** if `X_OAUTH_CLIENT_ID` missing. **429** when Redis-backed auth rate limit exceeded. |
| GET | `/api/auth/x/callback` | **JVM:** Exchange code, issue `xf_core_session` (same shape as Next). Verifier from cookies or Redis PKCE store. **429** when Redis-backed rate limit exceeded. |

**Production default:** OAuth **start** still hits **Next** (`src/app/api/auth/x/login`); BFF may proxy **`GET /api/auth/x/callback`** to Spring when `AUTH_CALLBACK_USE_SPRING` + `ATXFINANCE_BACKEND_ORIGIN` are set. This Spring service validates **`xf_core_session`** like Next for all BFF-proxied APIs.

**Redis / Memorystore:** PKCE storage, OAuth path rate limits, strategy-job quota — [spring-redis-memorystore.md](./spring-redis-memorystore.md). Full dual-run checklist: [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md) · [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md).

## Testing

- **JVM unit tests:** from `services/atxfinance-backend`: `./gradlew test`
- **Repo gate (Node):** `npm run ci:gate` includes `tests/smoke/backend-http-api-parity.test.ts` for doc ↔ Kotlin parity (no live server).

## Related

- **Auth / OAuth dual-run (gaps + checklist):** [`auth-oauth-spring-dual-run.md`](./auth-oauth-spring-dual-run.md)
- **Consolidating product APIs in Spring (migration plan):** `./api-consolidation-spring-backend.md`
- Runbook-style notes: `./junie-guidelines-atxfinance-backend.md`
- Local stack: `DEVELOPMENT.md` → *Local Setup (Backend → Frontend)*
