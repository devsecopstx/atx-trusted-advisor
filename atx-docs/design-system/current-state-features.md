# atxfinance-backend — Current State (Architecture & Features)

Last updated: 2026-04-03

Scope: Kotlin/Spring Boot service that acts as a scheduler/worker and thin HTTP API for portfolio, admin, strategy jobs, and RAG-support operations. Built and deployed from the monorepo (`services/atxfinance-backend`).

**Roadmap & gaps (consolidated index):** [`atx-docs/PLAN.md`](../PLAN.md) — priorities, BFF/auth deferred work, OptionsStrategyEngine (**245n** shipped; see [`strategy-engine.md`](./xStrategyBuilder/strategy-engine.md)), audit lineage, Stripe follow-ons, branding/UI deferrals. **Outstanding-only backlog + reviewer ops hooks:** [`atx-docs/PLAN.md`](../PLAN.md) (align with [`.cursor/agents/reviewer.md`](../../.cursor/agents/reviewer.md) — Secret Manager / deploy docs when SMTP or BFF changes).

**Charts (Next.js):** ApexCharts for xStrategyBuilder / xOptions — [charts-apex.md](./charts-apex.md). **Watchlist price alerts (Next scanner):** thresholds + cooldown documented in `PLAN.md` shipped **240n** (`src/modules/watchlist/price-alert-service.ts`).

- Runtime: Kotlin, Spring Boot, JDK 21
- Build: Gradle (`build.gradle.kts`), repo-root Dockerfile builds this module
- Data: MongoDB (Spring Data Mongo)
- Scheduling & coordination: Spring @Scheduled + ShedLock (Mongo lock collection)
- Messaging: Google Pub/Sub publisher (DLQ ready; consumer to be wired)
- Observability: Micrometer (GMP scrape) + OpenTelemetry (OTLP) stubs
- HTTP: REST controllers (health, portfolio, admin, strategy, RAG)

## Frontend tech stack summary (core app)

Companion frontend for this backend runs in the same monorepo as the Next.js core app.

- Framework: Next.js App Router (`src/app/*`)
- Language/runtime: TypeScript + React 19
- Styling: Tailwind CSS + brand design tokens (`atx-docs/design-system/atxfinance-brand-kit.css`, `--xf-*`)
- Validation and typing: Zod + strict TypeScript checks (`npm run typecheck`)
- Docs/API UX: OpenAPI inventory endpoint (`GET /api/openapi`) + admin Swagger surface (`/admin/api-docs`)
- Data/auth integration: session-cookie auth (`xf_core_session`), Mongo-backed APIs via Next route handlers under `src/app/api/*`, optional BFF proxying to Spring backend with **`ATXFINANCE_BACKEND_ORIGIN`** (staging/prod: **HTTPS** public backend origin, **no `:8080`** on the hostname; local Next-only dev often `http://127.0.0.1:8080` for the Kotlin service URL — Spring itself does **not** read this var for SMTP)
- Tooling gates: ESLint, Vitest, CI gate (`npm run ci:gate`)

Frontend quick references:

- App + API implementation: `src/app/`
- Shared modules/services: `src/modules/`
- Dev setup guide: `atx-docs/guides/local-development.md`
- API inventory guide: `atx-docs/guides/api-endpoints.md`


## 1) Boot & Configuration

- Entry: `com.atxfinance.backend.Application`
- Config props: `com.atxfinance.backend.config.AtxfinanceProperties` (`app.atxfinance.*`)
- Mongo URI resolution: `MongoUriEnvPostProcessor` + `MongoUriResolver`
  - Accepts `MONGODB_URI` (plain or base64) or `MONGODB_URI_B64` and injects `spring.data.mongodb.uri` early
- Scheduling: `SchedulingConfig` enables `@EnableScheduling` and ShedLock with a dedicated `schedulerTaskExecutor`
- Pub/Sub: `PubSubConfig` (`app.pubsub.project-id`, `app.pubsub.topic`, `app.pubsub.dlq-topic`) creates a `Publisher` when configured

Key env/config (examples)
- `spring.data.mongodb.uri` (derived automatically from `MONGODB_URI`/`MONGODB_URI_B64` if present)
- `MONGODB_URI`, `MONGODB_URI_B64` (legacy), `SPRING_DATA_MONGODB_URI`
- `app.pubsub.project-id`, `app.pubsub.topic`
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional local tracing)


## 2) Module/Package Overview

- `config/` — properties, Mongo URI resolver, ShedLock and executor wiring
- `web/` — REST controllers (health, portfolio CRUD, admin, strategy, RAG, auth callbacks)
- `portfolio/` — portfolio CRUD, nested resources, payload normalization/validation
- `admin/` — admin services (deploy notes, scheduled tasks, positions/accounts/watchlist, platform **`admin_delivery_channels`** CRUD: `in_app` \| `slack` \| **`email`** with `emailTo`; JVM path uses `DeskSmtpSender` when SMTP env is set)
- `audit/` — audit writers and admin query surface
- `strategy/` — options strategy job orchestration, Yahoo client, **`OptionsStrategyEngine`** (weighted scoring + JVM `options_scanner` dry run — [`strategy-engine.md`](./xStrategyBuilder/strategy-engine.md)); product **280** remains the umbrella for scanner + interactive surfaces
- `rag/` — RAG file ingestion helpers (mime, chunker, xAI collection client)
- `pubsub/` — Pub/Sub publisher config
- `session/` — session cookie parsing/writing, roles, auth env secrets
- `auth/`, `identity/`, `notify/` — OAuth callback flow stubs, identity helpers, Slack webhooks, and **desk SMTP** (`DeskSmtpSender` / Angus Mail) for admin test-send and parity with Next `src/lib/desk-smtp.ts`


## 3) Data Model (Mongo Collections)

Collection names are centralized in `AtxfinanceProperties` (prefix `app.atxfinance.*`). Notable collections:
- Core/app: `tenant_portfolio`, `portfolio_accounts`, `portfolio_watchlists`, `portfolio_positions`
- Personas & users: `xchat_personas`, `core_users`, `core_tenant_memberships`, `admin_user_settings`, `admin_user_bootstrap_profiles`
- Admin ops: `admin_audit_events`, `admin_scheduled_tasks`, `admin_task_runs`, `admin_deploy_note_configs`, `admin_delivery_channels` (platform Slack / **email** / in-app; task `deliveryChannelTarget` → run summaries)
- Recommendations & alerts: `app_user_recommendations`, `portfolio_recommendations`, `portfolio_alerts`, `portfolio_delivery_channels`
- RAG: `xai_collections`, `xchat_rag_chunks`, `xchat_logs`
- Strategy orchestration: `strategy_jobs`


## 4) HTTP API Surface (selected)

Health and diagnostics
- `GET /actuator/health` — Spring Actuator
- `GET /api/health` — compatibility shim (basic service + Mongo/secrets check)
- `GET /api/backend/health` — details: active profiles, masked Mongo URI, host/db, ping status

Portfolio (session cookie required; cookie name from `app.atxfinance.session-cookie-name`)
- `GET /api/portfolios/{portfolioId}` — summary payload for the session user
- `PATCH /api/portfolios/{portfolioId}` — rename portfolio (validates name, 1..200)

Additional controllers exist for admin and app surfaces (names reflect intent; see package `web/`):
- Admin: access requests, audit, bootstrap, import broker, portfolio accounts/alerts/delivery-channels/positions/recommendations/watchlist, tenant **Tasks** (`/admin/tasks`), **platform delivery channels** (`/api/admin/delivery-channels` — `email` uses SMTP same family as portfolio desk mail), users, deploy-note-configs
- App: recommendations (`AppUserRecommendationsController`, `PortfolioRecommendationsController`), positions & portfolio subresources, personas, strategy jobs/options, RAG files, auth callback

OpenAPI: SpringDoc 2.x is configured in Gradle (see `atx-docs/sre-ops/atxfinance-backend-http-api.md`). Swagger UI: `GET /swagger-ui.html`.


## 5) Scheduling & Concurrency

- Spring `@Scheduled` tasks (see `scheduling/SampleScheduledTasks.kt`) coordinate via ShedLock (Mongo `shedLock` collection)
- Default max lock duration: `PT5M` (see `@EnableSchedulerLock`)
- Dedicated thread pool executor `scheduler-` (core/max size 4)
- Intended for fault-tolerant, multi-instance operation


## 6) Messaging (Google Pub/Sub)

- Publisher bean created when `app.pubsub.project-id` and `app.pubsub.topic` are set
- Uses `NoCredentialsProvider` by default locally; relies on ADC when deployed
- DLQ topic name tracked in props (`dlqTopic`) for consumer wiring — **subscriber/consumer not implemented in this module** (platform follow-on; see release checklist § Infra)


## 7) Auth & Session

- Session cookie parsing: `session/SessionCookieParser` with cookie name from `AtxfinanceProperties.sessionCookieName` (default `xf_core_session`)
- Roles scaffold in `session/PlatformRoles`
- OAuth callback surface present (`web/AuthCallbackController`, `auth/OAuth*`, `identity/*`) — minimal wiring; full OAuth flow is owned by the frontend/BFF


## 8) RAG Integration

- Upload/readiness helpers under `rag/` handle file type/mime decisions and chunking (`RagTextChunker`)
- HTTP clients for xAI collections/upload endpoints (`XaiCollectionDocumentsClient`, `XaiFileUploadClient`)
- Collections: `xai_collections`, `xchat_rag_chunks`, `xchat_logs`


## 9) Observability

- Micrometer metrics designed for Google Managed Prometheus
- OpenTelemetry export via OTLP endpoint if configured (`OTEL_EXPORTER_OTLP_ENDPOINT`)
- Health endpoints (above) expose environment & Mongo connectivity diagnostics


## 10) Testing

- Unit/integration tests live under `src/test/kotlin` (e.g., `BackendHealthControllerTest`, `BackendHttpApiCrudIntegrationTest`)
- Run from module root: `./gradlew test`


## 11) Build & Run

Local dev
```
cd services/atxfinance-backend
chmod +x ./gradlew  # once if needed
./gradlew bootRun   # env can be sourced from repo-root .env
```
Container/JAR
- Repo-root `Dockerfile` builds the JAR from this module and runs it under Java 21


## 12) Deployment Baseline (Cloud Run)

- Concurrency: 1; CPU: 1 vCPU; Memory: 1 GiB
- Min/Max instances (staging example): `min=0`, `max=5`
- Exposes HTTP on `:8080`


## Roadmap pointer (companion Next.js app)

The Next.js core app (`src/app`, `src/modules`) owns **xChat** (`/api/xchat/*`), rich **persona governance**, and most **OAuth** session behavior today. BFF proxying to this service is enabled per `bff-proxy-routes.ts` when `ATXFINANCE_BACKEND_ORIGIN` is set; **xChat streaming stays Next-authoritative** until explicitly migrated. See **`PLAN.md`** § BFF routing gaps and **`api-consolidation-spring-backend.md`**.

### Desk email (portfolio + platform)

When **`SMTP_HOST`**, **`SMTP_USER`**, **`SMTP_PASS`**, and **`DESK_EMAIL_FROM`** are set (optional **`SMTP_PORT`**, TLS flags per env — see repo `.env.example` / `src/lib/env.ts`):

- **Next:** Portfolio desk notifications (`portfolio_delivery_channels` kind **`email`**, price-alert path, etc.) send via `src/lib/desk-smtp.ts`.
- **Spring:** Proxied admin paths (e.g. **`POST /api/admin/delivery-channels/test`**) send via **`DeskSmtpSender`**; **`EmailSendFailed`** surfaces as **502** on the API.
- **PR / ops:** With BFF on, **both** Cloud Run services that can handle those code paths need the same SMTP secret bindings — [deploy-and-ops.md](../guides/deploy-and-ops.md). UI: **`/admin/delivery-channels`**.

---
References
- Service README: `services/atxfinance-backend/README.md`
- SRE/API details: `atx-docs/sre-ops/atxfinance-backend-http-api.md`
- Consolidated release / gap index: `atx-docs/PLAN.md`
- Deploy, verify, desk SMTP on BFF: `atx-docs/guides/deploy-and-ops.md`
- Portfolio & admin data contracts in `src/main/kotlin/com/atxfinance/backend` (packages noted above)
