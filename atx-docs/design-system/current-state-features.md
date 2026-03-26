### atxfinance-backend — Current State Architecture & Features (concise)

#### What this service is
- Kotlin/Spring Boot microservice that backs the core app with portfolio CRUD, positions/watchlists, recommendations, RAG file handling, admin utilities, and scheduled jobs.
- Designed to be Cloud Run–friendly: stateless HTTP, external MongoDB, optional Google Pub/Sub, Micrometer/OTEL observability.

#### Runtime tech stack
- Language/Framework: Kotlin 2x + Spring Boot (Web, Actuator)
- Persistence: MongoDB (Spring Data)
- Distributed scheduling: ShedLock backed by Mongo
- Messaging: Google Pub/Sub (optional; producer only for now)
- Observability: Micrometer Prometheus registry + OpenTelemetry tracing (OTLP)
- API docs: springdoc OpenAPI UI (Swagger)

Key files:
- `services/atxfinance-backend/build.gradle.kts` — dependencies/config
- `.../src/main/kotlin/com/atxfinance/backend/Application.kt` — app entry
- `.../config/*` — properties, Mongo URI resolver, scheduling, Pub/Sub wiring
- `.../web/*` — HTTP controllers (user/admin/API)
- `.../portfolio/*`, `.../recommendation/*`, `.../rag/*`, `.../strategy/*` — domain services

#### Configuration & environment
- Mongo URI resolution supports plain or base64-encoded values.
  - Env keys checked: `MONGODB_URI`, `MONGODB_URI_B64`, `SPRING_DATA_MONGODB_URI`
  - Resolver: `MongoUriResolver.resolve(...)`
- App properties: `AtxfinanceProperties` (prefix `app.atxfinance`) define Mongo collection names and feature limits (e.g., `maxWatchlistSymbols`, collection IDs, strategy quotas).
- Pub/Sub properties: `app.pubsub.project-id`, `app.pubsub.topic`, `app.pubsub.dlq-topic` (publisher bean created only when present).
- Common envs referenced in health/logic: `DEFAULT_TENANT_SLUG`, `TENANT_PORTFOLIO_ORG_KEY`, `AUTH_SECRET` (for session cookie signature in tests).

#### Security & session model (current)
- Session cookie: name defaults to `xf_core_session` from `AtxfinanceProperties.sessionCookieName`.
- `SessionCookieParser` decodes and verifies a signed, URL-safe base64 payload (`enc.sig`), yielding `userId`, `tenantId`, etc.
- Controllers use `SessionCookieParser.resolveSessionUser(cookieHeader, cookieName)` and return 401 when missing/invalid.
- Role/authorization scaffolding exists in `session/PlatformRoles.kt`; fine-grained policy is minimal today (enforced mostly by ownership checks and admin routes segregation).

#### HTTP surface (selected groups)
Health & diagnostics:
- `GET /api/health` — compatibility health (Mongo and secret presence)
- `GET /api/backend/health` — detailed health: active profiles, effective Mongo URI (masked), ping, env flags
- Actuator: `GET /actuator/health` (standard)
- Swagger UI: `GET /swagger-ui.html`

Portfolios & nested resources (user-facing):
- `GET /api/portfolios/{portfolioId}` — summary payload for a portfolio (requires session)
- `PATCH /api/portfolios/{portfolioId}` — rename; validates presence/length
- Additional nested endpoints exist across controllers:
  - `PortfolioSubresourcesController`, `PositionsController`, `PortfoliosDefaultController` (default portfolio provisioning), `Positions*`, `Watchlist*`

Recommendations (user/portfolio):
- `GET/POST /api/app-user-recommendations/*` via `AppUserRecommendationsController`
- `GET/POST /api/portfolio-recommendations/*` via `PortfolioRecommendationsController`
- Backed by `recommendation/*` services and Mongo collections defined in props

RAG file & chunk handling (xAI collections):
- `RagFilesController` for ingest and readiness checks
- Services: `RagFileUploadService`, `RagFileReadinessService`, `RagTextChunker`, `Xai*Client`
- Collections: `xai_collections`, `xchat_rag_chunks`

Options strategy & jobs (phase 1):
- `StrategyOptionsController`, `StrategyJobsController`
- Services: `StrategyJobService`, `StrategyOptionsYahooClient` (fetch from Yahoo Finance)
- Rate/volume limits: `strategyMaxJobsHourly`, `strategySoftWarnJobsHourly` in props

Admin surface (segregated controllers under `/api/admin/...`):
- Access requests, bootstrap, users, portfolios (accounts, positions, watchlists), alerts, delivery channels
- Scheduled tasks: CRUD and runs tracking
- Audit: `AdminAuditController`, services under `audit/*`
- Deploy note config management

#### Persistence layout (Mongo collections)
Configured via `AtxfinanceProperties` (defaults shown):
- Core domain: `tenant_portfolio`, `portfolio_accounts`, `portfolio_watchlists`, `portfolio_positions`
- Personas & access: `xchat_personas`, `admin_access_requests`, `core_users`, `core_tenant_memberships`
- Recommendations: `app_user_recommendations`, `portfolio_recommendations`
- Admin/ops: `admin_audit_events`, `admin_scheduled_tasks`, `admin_task_runs`, `admin_user_settings`, `admin_user_bootstrap_profiles`, `admin_deploy_note_configs`
- RAG/XAI: `xai_collections`, `xchat_rag_chunks`, `xchat_logs`
- Strategy orchestration: `strategy_jobs`
- ShedLock uses its own `shedLock` collection in the configured database

#### Scheduling & background work
- `@EnableScheduling` with ShedLock (`SchedulingConfig`):
  - Mongo-backed `LockProvider` ensures single execution across replicas
  - Thread pool executor `scheduler-` with 4 threads
- Example tasks in `scheduling/SampleScheduledTasks.kt` (pattern for real jobs)
- Long-running/async work should publish to Pub/Sub; a pull-subscriber is not yet part of this module (producer-only wiring currently).

#### Messaging (Google Pub/Sub)
- `PubSubConfig` creates a `Publisher` when `app.pubsub.project-id` and `app.pubsub.topic` are set
- Credentials provider defaults to `NoCredentialsProvider` locally (no-op); in GCP, Application Default Credentials are expected
- DLQ topic property reserved (`dlq-topic`), not yet wired to publisher in this module

#### Observability
- Micrometer Prometheus registry enabled (scrape via Google Managed Prometheus when deployed)
- OTEL bridge + OTLP exporter for distributed traces (use `OTEL_EXPORTER_OTLP_ENDPOINT` when available)

#### Local development & testing
- Build/test: `cd services/atxfinance-backend && ./gradlew test`
- Run locally: `./gradlew bootRun` (requires a Mongo URI; embedded Mongo is used in tests only)
- Integration tests use embedded MongoDB (`de.flapdoodle.embed.mongo`) and cover key HTTP flows:
  - `BackendHttpApiCrudIntegrationTest` exercises `/api/backend/health`, portfolio CRUD, accounts, watchlist, positions
- Health endpoints provide hints when env secrets are missing

#### Deployment baseline (Cloud Run)
- Stateless; externalize Mongo, secrets, and Pub/Sub config
- Suggested resources: 1 vCPU, 1 GiB, concurrency 1; min=0, max≈5 (staging baseline from README)
- Health: `/actuator/health` and `/api/backend/health` for richer diagnostics

#### Notable constraints / TODOs
- Authorization is basic; admin endpoints rely on segregation and session-derived ownership checks; future: formal RBAC/ABAC
- Pub/Sub: producer configured; consumer/subscriber service is external or future work
- Validation exists for key payloads (e.g., portfolio rename, positions normalization) but may need expansion for broader data shapes
- Default collection names and limits in `AtxfinanceProperties` can be overridden via Spring configuration

#### Quick links (repo paths)
- Module root: `services/atxfinance-backend/`
- Controllers: `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/web/`
- Config: `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/config/`
- Domain services: `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/{portfolio,recommendation,rag,strategy}/`
- Tests: `services/atxfinance-backend/src/test/kotlin/com/atxfinance/backend/`
