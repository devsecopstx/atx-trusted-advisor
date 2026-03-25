# atxFinance Core App Development

## Scope

Core backend and UI for atxFinance **admin operations** and **signed-in app_user** accounts:

- user access request management
- task scheduling metadata
- user broker/portfolio/account defaults
- notification defaults
- app_user surfaces: xChat, xCoach, xStrategyBuilder, portfolio (`/portfolio`; legacy `/xfinance` redirects), watchlist (`/watchlist`), recommendations (`/recommendations`) with shared header (profile, logout, feedback, optional DB chip)
- signed-in/guest product naming: **`src/app/ui/product-brand-constants.ts`** (**atx Trusted Advisor** + **whitelabel** in xChat header and global footer); default app-role backend persona is **atx-trusted-advisor**

### Documentation tree

Engineering and ops Markdown lives under **`atx-docs/`** (there is no top-level **`docs/`** folder). Start at [`atx-docs/README.md`](atx-docs/README.md): **`sre-ops`** (BFF, Spring HTTP, secrets), **xchat** (prompts, tools, multi-agent), **branding** / **options** RAG, **PLAN.md** (backlog).

## Tech Stack

The repo ships **two runnable tiers**: the **Next.js core app** (browser UI + product APIs) and the **atxfinance-backend** worker (Kotlin/Spring). Local dev typically runs MongoDB + `atxfinance-backend` via Docker Compose, then the Next dev server on the host (see *Local Setup* below).

### Frontend (core app UI)

- **Next.js** (App Router) — React UI under `src/app/*` (admin console, app_user surfaces: `/xchat`, `/portfolio`, `/watchlist`, etc.).
- **Styling** — Tailwind + `--xf-*` design tokens (`atx-docs/design-system/atxfinance-brand-kit.css`); see branding rules in `.cursor/rules/xfinance-branding.mdc`.

### Core application API (Next.js server)

- **HTTP APIs** — Route handlers in `src/app/api/*` (auth, personas, xChat, portfolios, admin, OpenAPI inventory, etc.).
- **Language & validation** — TypeScript + **Zod** for request/env parsing.
- **Data** — **MongoDB** (primary app database; canonical default name **`atxfinance`** — one logical DB per deployment; tenant isolation is document-level (`tenantId` / org keys). Stage/prod use separate connection strings.

#### MongoDB database naming (ops)

- The app **does not require** different database *names* per environment. Typical patterns:
  - **Separate Atlas clusters** (or serverless instances) per stage/prod, each URI ending with the same path segment (e.g. `/atxfinance`), **or**
  - **Different database names in the URI path** on one cluster (e.g. `…mongodb.net/atxfinance_stage` vs `…/atxfinance_prod`) — purely an **ops / governance** choice, not enforced by application code.
- Set the target DB in **`MONGODB_URI`** (or local fallback + optional **`MONGODB_DB_NAME`** for the path segment when not embedded in the URI).

#### Local Mongo: reuse or start (`npm run mongo:up`)

- `scripts/dev/mongo-up.sh` loads **`.env`**, then if **`mongosh`** is available, pings **`127.0.0.1:27017`**. If **`MONGO_ROOT_PASSWORD`** is set, uses **`MONGO_ROOT_USERNAME`** / **`MONGO_ROOT_PASSWORD`** (default user **`admin`**, same as **`docker-compose.yml`** — not **`ADMIN_X_USERNAME`**, which is X OAuth only). If password is unset/empty, pings without auth (same as app **`getMongoUri`** when password empty). Force no-auth: **`MONGODB_NO_AUTH=true`**. Full override: **`MONGO_PING_URI`**. A failed ping (e.g. wrong creds or another process on **27017**) falls through to **`docker compose up -d mongodb`**.
- If ping succeeds, Compose is **skipped** (reuse your already-running Mongo).
- Otherwise it runs **`docker compose up -d mongodb`** and waits for the container healthcheck — use before **`npm run seed:admin`** or **`npm run local:bootstrap`** for a clean admin seed against Compose defaults.
- Override the ping URI only if needed: **`MONGO_PING_URI`**.

### atxfinance-backend (scheduler / worker service)

- **Runtime** — **Kotlin**, **Spring Boot**, **JDK 21**; build with **Gradle** (`services/atxfinance-backend`, `gradlew`).
- **Role** — Fault-tolerant scheduler/worker surface (ShedLock + Mongo, Pub/Sub integration path, observability hooks); **not** a replacement for Next.js product APIs.
- **HTTP** — Actuator and app health/compatibility routes on port **8080** when run via Compose; contract summary in **`atx-docs/sre-ops/atxfinance-backend-http-api.md`** and **`services/atxfinance-backend/README.md`**.
- **Strategy jobs (Phase 1 orchestrator)** — Mongo **`strategy_jobs`** (override **`STRATEGY_JOBS_COLLECTION`**). Rolling hourly create cap **`STRATEGY_MAX_JOBS_HOURLY`** (default 12) and soft-warn threshold **`STRATEGY_SOFT_WARN_JOBS_HOURLY`** (default 8). Next BFF proxies **`/api/strategy-jobs`** to Spring when **`ATXFINANCE_BACKEND_ORIGIN`** is set; without BFF, those routes return **503**.
- **Container** — Repo-root **`Dockerfile`** builds the JAR from `services/atxfinance-backend`; **`docker-compose.yml`** wires `atxfinance-backend` + `mongo:8`.

### Integrations (cross-cutting)

- **LLM / tools:** [xAI](https://docs.x.ai/overview) API is the **integration standard** for xChat (Responses, chat completions, batch, collections). See **`atx-docs/xchat/xai-api-standard.md`** for repo mapping and deep links.
- **POST `/v1/responses` (xChat):** Outbound bodies use **`instructions`** for the system prompt (xAI API field name — not `system_prompt`). Tool-loop **continuation** turns send **`previous_response_id`** only and **omit** `instructions`, per API rules. Implementation: `respondWithXaiToolLoop` / `respondWithXai` in `src/lib/xai.ts`; batch JSONL items use the same shape in `src/modules/xchat/batch-service.ts`. **`502`** from `POST /api/xchat/ask` includes truncated upstream text in **`details`** for operators.

### Local dev run order (summary)

| Step | What to start | Typical command / URL |
| --- | --- | --- |
| 1 | **MongoDB** (`mongo:8` in Compose) | With `npm run dev:stack` or `npm run dev:backend` — `localhost:27017` |
| 2 | **atxfinance-backend** (Spring; waits on Mongo healthy) | Same Compose up — health: `http://localhost:8080/actuator/health` |
| 3 | **Next.js core app** (UI + `src/app/api/*`) | After backend healthy: `npm run dev:stack` continues here, or `npm run dev` / `npm run dev:frontend` — `http://localhost:3000` |

Detailed env, verification URLs, and troubleshooting live in **Local Setup** below; this table is the single-line sequence only (not duplicated there).

## Platform roles vs tenant membership (session)

Session payload (`SessionUser` in `src/lib/auth.ts`):

| Field | Name in docs | Meaning |
| --- | --- | --- |
| `roles` | **Platform roles** | `global_admin` \| `advisor` \| `operator` \| `viewer` — app-wide capability. Use `isGlobalAdmin()` / `canUserLogin()` from `src/modules/identity/authorization.ts`. Legacy session value `admin` is normalized to `global_admin` via `normalizeCoreRole()` / `normalizeCoreRoles()` (single source of truth). |
| `tenantRole` | **Tenant membership role** | `tenant_admin` \| `member` for `tenantId` — billing/tenant ops; **does not** grant `/admin`. Treat as **app_user** vs **tenant admin** at the tenant level; product plans default to **free** until billing ships. |

### Product rules

- **Surfaces (policy module):** `src/modules/surface-policy.ts` lists **app_user product** path prefixes (`/xchat`, `/xstrategybuilder`, `/portfolio`, `/watchlist`, `/recommendations`) and helpers `isAppUserProductPath`, `isAdminConsolePath`. **`app_user`** in docs means platform roles `advisor` \| `operator` \| `viewer` — not a literal Mongo role string. **`admin_console`** means `/admin/*` for `global_admin` only.
- **Edge proxy:** `src/proxy.ts` redirects unauthenticated browser requests on protected app_user and admin paths (including `/admin`, `/xchat`, `/portfolio`, `/watchlist`, `/xstrategybuilder`, `/recommendations`, and matching `/api/*`) to `/login?next=…` when the session cookie is missing; API calls without a cookie get `401`. RBAC (`global_admin`) remains enforced in `src/app/admin/layout.tsx`.
- **Admin console** (`/admin/*`, `requireGlobalAdminSession` / `requireAdminSession`): **only** `global_admin` (after normalization). The admin layout redirects everyone else to `/xchat`.
- **App_user surfaces** (approved login): `advisor`, `operator`, `viewer` — xChat, xCoach, xStrategyBuilder, Portfolio (`/portfolio`), Watchlist (`/watchlist`), Recommendations (`/recommendations`). Shared chrome: `AppUserApprovedHeader` (`src/app/ui/app_user-approved-header.tsx`) = product links (`AppUserProductNav`) + `AppUserHeaderSession` (profile popover, logout, feedback modal, optional Mongo host/db pill per `shouldShowAppUserDbLabel()` in `src/lib/env.ts`).
- **Access requests** are **onboarding**, not a role: unapproved users have no login-allowed platform role (unless `ALLOW_ANY_X_USER_LOGIN`); after approval, admins assign a platform role (typically `viewer`).

**Feature flags** (e.g. `ALLOW_ANY_X_USER_LOGIN`) are **env-driven capabilities** — do not represent them as platform roles in Mongo.

### Glossary: app users, access, portfolios, and “account”

- **App user (docs term `app_user`):** The **signed-in product user** using xChat, portfolio, watchlist, etc. In Mongo, this is **not** a role string named `app_user` — capability is **`viewer` \| `operator` \| `advisor`** (platform roles on the Core user). See the session table above.
- **Who creates “users” for the product:** **`global_admin`** manages **`admin_access_requests`**: triage → approve/reject → assign a **platform role**. That approval path (plus OAuth sign-in) is what makes someone an **app user** in the product sense.
- **Portfolio:** Mongo collection for the user’s **book** (name, `isDefault`, broker metadata). Each app user should have a **default portfolio** (`isDefault: true`). **`provisionDefaultPortfolioForUser`** (`src/modules/core-admin/repository.ts`) runs from OAuth and on first portfolio touch. **If there is no default portfolio yet**, provision it (same helper or first `/portfolio` / portfolio API access) before assuming accounts or positions exist.
- **Portfolio account (`portfolio_accounts`):** In docs and UI copy, **“account”** means this row unless we explicitly say **user account** / **sign-in**. It is a **custodian / brokerage account under a portfolio** — child of **`portfolios`**, not the auth identity. The **default portfolio account** is created during provision (`isDefault: true`, paper **`cashBalance`** default). **Balance** = `cashBalance` on the account document. **Holdings** (long stock, options as positions) live in **`portfolio_positions`**, linked by **`accountId`** (and `portfolioId`, `userId`) with `symbol`, `qty`, `avgCost`. A user may have **multiple** portfolio accounts under one portfolio (`insertPortfolioAccountForUser` adds **`isDefault: false`** rows).

#### Required / optional fields for a **new** portfolio account (`insertPortfolioAccountForUser`)

Implementation: `InsertPortfolioAccountInput` + `insertPortfolioAccountForUser` in `src/modules/core-admin/repository.ts`.

| Field | Required | Notes |
| --- | --- | --- |
| `userId` | **yes** | Owner id (hex string). |
| `portfolioId` | **yes** | Valid ObjectId; portfolio must exist and be owned by `userId` (session-scoped read). |
| `name` | **yes** | Non-empty after trim; max **200** chars. Empty name → insert returns `null`. |
| `tenantId` | **yes** | Valid **24-hex** `ObjectId` string; tenant scope on the document. Missing, empty, or invalid → insert returns `null`. |
| `type` | no | `merrill` \| `fidelity` \| `etrade` (`AccountType`); defaults to **`fidelity`**. |
| `extAccountId` | no | External/broker stable ref; if omitted, server generates `atx-<suffix>`. |
| `cashBalance` | no | Non-negative finite number; otherwise defaults to **`DEFAULT_ACCOUNT_CASH_BALANCE`** (25_000 paper default in repository). |

Mongo document always includes `portfolioId`, `userId`, `name`, `type`, `extAccountId`, `isDefault` (**`false`** for this API), `cashBalance`, `createdAt`, `updatedAt`, and **`tenantId`** (`ObjectId`).

## Required Environment Keys

Use `.env` only (do not use `.env.local` for this app).

- `MONGODB_URI` (plain `mongodb://` / `mongodb+srv://`, or base64-encoded; GCP Secret Manager can keep the same resource name `MONGODB_URI_B64` mapped to env `MONGODB_URI` in Cloud Run)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY` (required for management/KB collection operations)
- `XAI_MANAGEMENT_BASE_URL` (optional override; defaults to `https://management-api.x.ai/v1`)
- `XAI_CHAT_MODEL` (optional; canonical default **`grok-4-1-fast-reasoning`** — xAI client default, Admin → Create xPersona preset, and **`POST /api/xchat/ask`** when the resolved persona has no `model`; set in `.env` locally and via GitHub **Variables** / Cloud Run env on deploy — see workflows `deploy-cloud-run.yml` / `deploy-cloud-run-production.yml`)
- `X_OAUTH_CLIENT_ID` (raw client id from X app, not base64-encoded)
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET` (recommended for session signing)
- `ALLOW_ANY_X_USER_LOGIN` (optional feature flag; set `true` to allow any authenticated X user into `/xchat` with non-admin permissions, default disabled)
- `ENABLE_XCHAT_DEBUG` (optional; set `true` to emit detailed xChat payload logs — RAG context, prompts, tools — for expert learning; default `false`; configure Cloud Logging retention e.g. 30 days at project or log-bucket level; taxonomy and privacy: **`atx-docs/xchat/xchat-debug-logging.md`**)
- `X_OAUTH_CALLBACK_URL` (optional; defaults to current request origin + `/api/auth/x/callback`)
- `ADMIN_SEED_EMAIL` (required for `npm run seed:admin` and OAuth seed-admin promotion; **no default** — set explicitly in `.env`)
- `ADMIN_X_USERNAMES` (optional allowlist, comma-separated)
- `SLACK_WEBHOOK_URL` (optional; Slack incoming webhook for access-request notifications and **app_user feedback** from `POST /api/user-feedback`)
- `APP_USER_SHOW_DB_ENDPOINT` (optional; set `true` to show the Mongo host/db chip in the app_user header when `NODE_ENV=production` — e.g. beta staging builds)

## xAI chat completions smoke (dev / SRE)

With `XAI_API_KEY` in `.env`, verify the runtime key against the public chat API:

- `npm run smoke:xai-chat` — calls `https://api.x.ai/v1/chat/completions` (non-streaming, default model `grok-4-1-fast`). Optional: `XAI_SMOKE_MODEL`, `XAI_CHAT_COMPLETIONS_URL`. Implementation: `scripts/ops/xai-chat-completions-smoke.sh`.

## Local Setup (Backend → Frontend)

Follow these steps to run the backend first, then the frontend. **Run-order cheat sheet:** Mongo → `atxfinance-backend` → `npm run dev` — see *Tech Stack* → **Local dev run order (summary)** (table not repeated here).

1. Install dependencies
   - `npm install`
2. Create your env file
   - `cp .env.example .env`
   - Tip: Leave `MONGODB_URI` unset for local development so the app uses the local Docker Mongo (`atxfinance` path).
3. (Optional) Source admin username from admin_seed.csv and set local Mongo password
   - `export ADMIN_X_USERNAME=$(awk -F, 'NR==2{print $2}' admin_seed.csv)`
   - `export MONGO_ROOT_PASSWORD=`  # change if desired
   - Omit `MONGODB_DB_NAME` unless you need a non-default DB path (code default is `atxfinance`).
4. Start backend + MongoDB (Docker Compose, from repo root)
   - **Ordered one-shot (backend first, then Next):** `npm run dev:stack` — runs `docker compose up -d`, waits until `http://localhost:8080` health responds, then starts `npm run dev:frontend` in the foreground. Ctrl+C stops the Next process only; run `docker compose down` when you want to stop Mongo + the backend container.
   - **Host Kotlin backend + Next (no backend Docker image):** `npm run dev:host` — runs `bash scripts/dev/bootrun-atxfinance-backend.sh` (Gradle `bootRun`), waits for `:8080` health, then Next dev. Mongo must already be up (e.g. `docker compose up -d mongodb` or Atlas). Ctrl+C stops Next and SIGTERM to the JVM. VS Code / Cursor: task **Dev build (host: Gradle bootRun → Next, no backend Docker)**.
   - **Attached Compose logs (no Next):** `npm run dev:backend`
   - **BFF — portfolio + positions on Spring:** set `ATXFINANCE_BACKEND_ORIGIN=http://127.0.0.1:8080` in `.env`. Next proxies to Kotlin (forwards `Cookie`) for every `{ method, path }` in `src/lib/bff-proxy-routes.ts` (canonical list). That includes app-user portfolios + positions + recommendations + strategy surfaces, and **global-admin** portfolio CRUD, accounts, **watchlist**, **account positions** (`GET`/`POST …/accounts/:accountId/positions` only — not `PATCH`/`DELETE` by position id), **recommendations / alerts / delivery-channels / portfolio-scoped tasks**, deploy-notes, import/broker, tasks/scheduler, etc. Use the same `AUTH_SECRET` (or `X_OAUTH_CLIENT_SECRET`) and Mongo DB name on both processes.
   - **Admin portfolios — BFF vs Next fallback:** With origin set, the paths above hit Spring; **`PATCH`/`DELETE /api/admin/portfolios/:portfolioId/accounts/:accountId/positions/:positionId`** remains **Next-only** until it is added to `bff-proxy-routes.ts` with a Kotlin handler. UI: **`/admin/portfolios`** (tenant books; **Tenant org ref** → **`ext_broker_ref`**; default book ↔ **`tenantPortfolioOrgKey`** on **`core_tenants`**, default **`org-atx-finance`**; **Manage accounts** → **`/admin/portfolios/:id/accounts`**; **Manage watchlist** → **`GET`/`PATCH /api/admin/portfolios/:id/watchlist`**), **`/admin/broker-import`**. Legacy **`/admin/accounts`** → **`/admin/portfolios`**.
   - Behavior:
     - Compose always starts `mongo:8` with:
       - `MONGO_INITDB_DATABASE=${MONGODB_DB_NAME:-atxfinance}`
       - `MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME:-admin}`
       - `MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-}` (empty allowed — no default password)
     - The Spring service receives `SPRING_DATA_MONGODB_URI` pointing at `mongodb:27017` (credentials match **`MONGO_ROOT_*`**; **`authSource=admin`** when a password is set — see `docker-compose.yml`).
     - If **`MONGODB_URI`** is set in `.env`, `MongoUriEnvPostProcessor` resolves it (plain or base64) and injects `spring.data.mongodb.uri` at **highest precedence**, overriding the Compose-supplied `SPRING_DATA_MONGODB_URI` (Atlas / remote Mongo path).
5. Verify backend
   - Actuator: http://localhost:8080/actuator/health (standard Spring Boot JSON)
   - SRE diagnostics: http://localhost:8080/api/backend/health (masked Mongo URI, profile flags — see **`atx-docs/sre-ops/atxfinance-backend-http-api.md`**)
   - Compatibility: http://localhost:8080/api/health
   - Swagger UI: http://localhost:8080/swagger-ui.html (may redirect to `/swagger-ui/index.html`); OpenAPI JSON: `/v3/api-docs`
6. Start frontend (Next.js dev server)
   - `npm run dev:frontend`
   - App URL: http://localhost:3000
7. Seed core admin user + default tenant (first-time only)
   - Ensure `.env` has `ADMIN_SEED_EMAIL=you@example.com`
   - **Sign in with X (no email on profile):** X userinfo often omits `email`. Set **`ADMIN_SEED_X_USER_ID`** to your X account’s numeric id (same string as `data.id` from `GET /2/users/me`), then run **`npm run seed:admin`** so `core_users.xAccount` is pre-linked. The X OAuth callback also reads `ADMIN_SEED_X_USER_ID` so first login works even before re-seeding. Optional: `ADMIN_SEED_X_USERNAME`, `ADMIN_SEED_X_DISPLAY_NAME` for seed output only (login refreshes profile).
   - **`MONGODB_URI` can stay unset** when using local Docker Mongo — `seed:admin` and the Next.js app use the same localhost fallback as `src/lib/env.ts` (`scripts/lib/resolve-mongo-uri.mjs`): no credentials unless **`MONGO_ROOT_PASSWORD`** is set.
   - **`npm run local:bootstrap`** — starts **only** `mongodb` via Compose, waits until healthy, then runs **`seed:admin`** (convenience for a fresh machine).
   - Or after Mongo is up: **`npm run seed:admin`**
8. Stop services and view logs
   - Stop backend + Mongo: `Ctrl+C` in the Compose terminal, or `docker compose down`
   - View backend logs: `docker logs -f atxfinance-backend`
   - View Mongo logs: `docker logs -f atxfinance-mongodb`
9. Troubleshooting
   - If port 27017 is already in use, stop other Mongo instances or change the published port in `docker-compose.yml`.
   - To force local Mongo (and ignore Atlas), ensure `MONGODB_URI` is unset in your environment when starting the backend.
   - To use Atlas in dev, set `MONGODB_URI` (plain URI or base64) before `npm run dev:backend`.

### Clean local Mongo + seed (fallback URI)

Use this when you want a **local Compose Mongo** without Atlas and with the same connection defaults as the app.

| Goal | Command |
| --- | --- |
| Start **only** Mongo, wait until healthy | `npm run mongo:up` (`scripts/dev/mongo-up.sh`) |
| Stop Mongo container | `npm run mongo:down` |
| Fresh volume + seed admin (**wipes** `atxfinance_mongo_data`) | `RESET_LOCAL_MONGO=1 npm run mongo:reset` |
| **Each dev session:** wipe Mongo volume + seed, then host JVM backend + Next | `npm run dev:host:fresh` (sets `DEV_WIPE_LOCAL_MONGO=1` for `dev:host`) |
| **Each dev session:** wipe volume + Docker backend + Next (seed **after** backend healthy) | `npm run dev:stack:fresh` |
| One-shot: Mongo up + seed (keeps existing volume) | `npm run local:bootstrap` |

**`MongoServerError: Authentication failed` (local):** Ensure **`MONGODB_URI`** is unset. If local Mongo runs **without auth** (legacy volume), add **`MONGODB_NO_AUTH=true`** to `.env` or leave **`MONGO_ROOT_PASSWORD`** empty. If Compose initialized a **non-empty** root password, set **`MONGO_ROOT_USERNAME`** / **`MONGO_ROOT_PASSWORD`** to match **`docker-compose.yml`**. Restart Next after changing `.env` (Mongo client is cached).

`mongo:reset` requires **`RESET_LOCAL_MONGO=1`** to avoid accidental data loss. After a reset, run **`npm run dev:host`**, **`npm run dev:stack`**, or **`docker compose up`** as needed.

### Two terminals — Mongo already running (clear logs)

Use **separate shells** so Gradle/Spring logs and Next logs do not interleave.

| Terminal | Command | URL |
| --- | --- | --- |
| **1 — Kotlin backend (host JVM, no backend Docker)** | `npm run dev:spring` (same as `bash scripts/dev/bootrun-atxfinance-backend.sh`) | http://localhost:8080 |
| **2 — Next.js** | `npm run dev:frontend` | http://localhost:3000 |

Requirements: **Mongo** reachable on `localhost:27017` with the same credentials as `.env` / Compose (see *Clean local Mongo + seed*). The boot script sources repo **`.env`** and sets `SPRING_DATA_MONGODB_URI` from `MONGODB_URI` or defaults (legacy `MONGODB_URI_B64` is still resolved by Spring’s post-processor when `MONGODB_URI` is unset).

VS Code / Cursor: run tasks **Start Backend (Gradle bootRun, no Docker)** in one terminal and **Start Frontend (Next Dev)** in another (each **Run Task** opens its own terminal when not using a compound task).

### Notes on the new root-based Docker build (backend)

- The backend `Dockerfile` now lives at the repo root and builds the service under `services/atxfinance-backend`.
- `docker-compose.yml` includes two services:
  - `mongodb` on port 27017 with named volume `atxfinance_mongo_data`
  - `atxfinance-backend` on port 8080, connected to MongoDB using `SPRING_DATA_MONGODB_URI=mongodb://mongodb:27017/atxfinance`
- Typical developer loop:
  - Start/refresh backend: `npm run dev:backend` (rebuilds image if sources changed)
  - Run frontend dev: `npm run dev:frontend`
- If you need to run only MongoDB locally without the backend container: `docker compose up -d mongodb` — then **`npm run dev:spring`** in one terminal and **`npm run dev:frontend`** in another (see *Two terminals — Mongo already running*). Or use **`npm run dev:host`** to chain them in one process when you do not need split logs.
- Workspace tasks: **Start Backend (Gradle bootRun, no Docker)** and **Start Frontend (Next Dev)** (one task per terminal), or **Dev build (host: …)** for a single combined flow.

## Developer Prereqs (gh + local gate)

Before changing deployment settings or running release workflows, verify:

1. GitHub CLI auth:
   - `gh auth status`
   - **PRs / org GraphQL (`gh pr view`, `gh pr list`, …):** if **`GH_TOKEN`** is set in your shell, the CLI uses that PAT **instead of** the keyring login. A PAT without **`read:org`** then fails with missing-scope errors on org repos. For interactive PR work, run **`unset GH_TOKEN`** (or remove it from the shell profile / env that loads before `gh`), then **`gh auth status`** — the account with **`read:org`** (often keyring / `gho_`) should show **Active account: true**. Re-export `GH_TOKEN` only when a script or CI needs the narrow token.
2. GitHub permissions:
   - You can read/write repo variables and environment secrets.
   - You can dispatch workflows.
3. Local release gate:
   - `npm ci`
   - `npm run ci:gate && npm run build`

## Cursor agents & skills (repo-local)

Use this when picking a **Cursor Cloud / Composer persona** or finding a **workflow skill** without spelunking the whole `.cursor` tree.

### Agent personas (`.cursor/agents/`)

YAML files define **narrow roles** — no secrets; operational steps stay in this doc and **`AGENTS.md`**.

| File | Intent |
|------|--------|
| **`backend.yaml`** | Kotlin **atxfinance-backend**, BFF migration, Spring HTTP parity, `services/atxfinance-backend/**`, `ATXFINANCE_BACKEND_ORIGIN` |
| **`reviewer.yaml`** | Pre-merge **review** — `npm run lint`, `typecheck`, `test`, `ci:gate`; scope to changed files |
| **`frontend.yaml`** | **UI/UX + branding** — `src/app/**`, `atx-docs/design-system/**`, tokens/a11y; avoid unrelated API/domain edits |

Full detail and commit-message convention (**`chore: aTx⚡ …`**) — **`.cursor/agents/README.md`**.

Optional: **`.cursor/worktrees.json`** names git worktrees; each entry’s `setup` may stamp `ROLE=…` into **`.cursor/.frontend`**, **`.cursor/.backend`**, or **`.cursor/.reviewer`** (local convenience only).

### Skills (`.cursor/skills/*/SKILL.md`)

Reusable procedures (deploy, backend runbook, audit review, test gate). Examples:

| Topic | Skill |
|-------|--------|
| Ship validation | `test-commit-push`, `test-lint`, `ci-failure` |
| Spring backend | `backend-start-local`, `backend-architecture`, `backend-runbook` |
| GCP deploy | `deploy-staging`, `deploy-production`, `sre-gcp-foundation` |
| Design / risk | `atxdesign-review`, `atxdesign-review-audit`, `atxdesign-review-adversarial` |
| Docs | `generate-docs`, `sre-docs-ops` |

**Rule:** Skill `.md` files must **not** embed literal app versions — version lives in **`package.json`** only (`src/lib/app-version.ts`).

## Cursor Cloud Agent Setup (Atlas Mode)

Use this setup when running in Cursor Cloud with MongoDB Atlas. Do not start local MongoDB.

### Cloud Agent Rules

- Do not run `docker compose up -d` for MongoDB in cloud agents.
- Use Atlas connection via `MONGODB_URI` (plain or base64).
- Keep app/runtime secrets in GCP Secret Manager, not in repo.
- Use `npm ci` before validation/build commands.

### Minimum Cloud Runtime Env Keys

- `MONGODB_URI` (GSM secret may still be named `MONGODB_URI_B64`)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

### Cloud Build/Validation Sequence

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. Optional full gate: `npm run ci:gate`

## OAuth Host Consistency

OAuth flow cookies are host-scoped. Keep these values aligned to avoid `missing_oauth_cookie_context`:

- Browser host you use (`127.0.0.1`)
- `X_OAUTH_CALLBACK_URL` host (if explicitly set)
- X app redirect URI in developer settings

If they do not match exactly, state/verifier cookies can be missing on callback.

### Login Error Routing Notes

- `email_link_required`: X OAuth succeeded but X did not return an email claim **and** the user still has no login-allowed platform role. Use the link-email form on `/login` to bind a real email, **or** complete X OAuth again after an admin approves the access request (placeholder `@x.identity.local` users can sign in once they have e.g. `viewer`).
- `access_request_pending`: account exists but has no login-allowed role (`global_admin`, `advisor`, `operator`, `viewer`). **Docs term `app_user` is not a DB role** — session must include one of `advisor` / `operator` / `viewer` (or `global_admin`) for `canUserLogin()`; see `src/modules/identity/authorization.ts`.
- If the entered email already belongs to an approved admin account, `/api/auth/link-email` now unlinks stale X mappings and re-links to the approved user.
- For Atlas-only setups, if login/link-email email matches `ADMIN_SEED_EMAIL` (must be set in env), auth flow auto-applies seeded global-admin role and tenant membership. Local Mongo is not required.
- **Self-service access:** After sign-in, users request product roles via **`POST /api/access-requests`** with JSON `{ "reason": "…", "requestedRole"?: "viewer" | "operator" | "advisor" }` (defaults to `viewer`). This is the unified path when Next serves the route; with BFF enabled, the same URL may proxy to Spring. **`global_admin` is not allowed** on that endpoint (elevated roles use admin APIs or seed only).
- **`npm run seed:admin`** creates or updates the `ADMIN_SEED_EMAIL` user with **`global_admin`** and, if missing, one **approved** `admin_access_requests` row (`requestedRole: global_admin`) as an audit paper trail. Duplicate **open** requests for the same user + role are blocked by a partial unique Mongo index on **`(userId, requestedRole)`** where **`status` ∈ `new` | `triaged` | `pending`** (`uniq_admin_access_requests_user_requestedRole_actionable`), ensured on first access-request write and by the seed script.
- **RAG source tree (`atx-rag-collection/`):** Markdown/PDFs/YAML uploaded to xAI **trusted-advisor tenant** collections when **`npm run seed:admin`** runs with **`XAI_API_KEY`**, **`XAI_MANAGEMENT_API_KEY`**, and team id; **`SKIP_SEED_XAI_RAG_INGEST=1`** skips upload. Ingest creates **`atx-trusted-advisor-<dev|stage|prod>`** plus segment buckets (**`…-finance-reference-docs`**, **`…-xpersonas`**, **`…-example-prompts`**, **`…-options-strategy`**, etc.) — **`scripts/lib/seed-xai-rag-ingest.mjs`**, **`atx-rag-collection/README.md`**. **Layout:** each ingestible file lives at **`folderName/fileName`** where **folder name equals the file stem** (e.g. `wheel/wheel.md`) so RAG path tags stay stable. **Mongo `xchat_personas` from disk (Admin → Personas):** after Mongo writes, **`seed:admin`** automatically runs the same logic as **`npm run seed:xpersonas`** (default root **`atx-rag-collection/xpersonas`** — one upsert per **`.yaml` / `.yml` / frontmatter `.md`** spec) so xAI collections and app persona rows stay aligned. **`SKIP_SEED_XPERSONAS=1`** skips that step (e.g. CI). Re-run personas only: **`npm run seed:xpersonas`**. **`SEED_XPERSONAS_MODE`** defaults to **`merge`**; **`replace`** overwrites prompts / `xapi` / scalars and refreshes `xaiCollection` when a collection id resolves — in **`NODE_ENV=production`**, **`replace`** logs a loud warning and **`SEED_XPERSONAS_STRICT=1`** exits non-zero. See **`atx-rag-collection/atx-rag-collection.md`** (Persona YAML + sync).
- `bootstrap_failed`: tenant membership, `resolveAuthContext`, or **session cookie creation** threw after X OAuth succeeded. (**Default portfolio provisioning** is best-effort: failures log `[auth/x/callback] default portfolio provision non-fatal` and no longer block the session — portfolio is created lazily on `/portfolio` or `GET /api/portfolios/default`.) Check **Cloud Run logs** for `[auth/x/callback] session bootstrap failed` (Mongo index errors, duplicate keys, or DB connectivity). User is redirected to `/login` with this code instead of a raw **500** when the catch path is deployed.

### App_user HTTP 500

If **`/admin` works** but **`/xchat` or `/portfolio` returns 500** (staging or prod):

1. Confirm **`GET /api/health`** returns `200` with `status: ok` (rules out broken `MONGODB_URI` for that revision).
2. **Cloud Run → Logs** — filter for the request path and `Error` / `x/callback` / `getDefaultPortfolio`. **Legacy data:** if `userId` on `tenant_portfolio` / `portfolio_*` was stored as BSON `ObjectId` while the session uses a hex string, reads used to miss; repository queries now match both shapes and normalize `userId` to string on provision. **Admin `GET /api/admin/portfolios`** joins `core_users` via `normalizeMongoUserIdHex` so legacy ObjectId `userId` values do not throw at the API layer.
3. **OAuth callback** — empty env values like `X_OAUTH_CALLBACK_URL=` (literal empty) used to fail `getEnv()` at runtime; optional URL vars now treat blank as unset. Ensure **`X_OAUTH_CALLBACK_URL`** in production matches the live host if set explicitly.
4. **New app_user first login** — `provisionDefaultPortfolioForUser` runs in the callback; if it throws, sign-in still completes and the portfolio is provisioned on first Portfolio page or API access. Hard failures in membership/session still yield `bootstrap_failed`.
5. Clear site cookies and retry sign-in if the session cookie was signed with a rotated **`AUTH_SECRET`** (invalid cookies yield logged-out behavior, not usually 500).

## Validation Commands

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Smoke tests: `npm run smoke:verify`
- xAI management key-create smoke (opt-in): `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true npm run smoke:xai-key-create`
- Seed admin: `npm run seed:admin` (includes **`seed:xpersonas`** from **`atx-rag-collection/xpersonas`** unless **`SKIP_SEED_XPERSONAS`**)
- Seed xPersonas from disk → Mongo only: `npm run seed:xpersonas` (default root **`atx-rag-collection/xpersonas`** — `.yaml` / `.yml` / frontmatter **`.md`**). Override folder: `npm run seed:xpersonas -- --root atx-rag-collection/options-strategy` (or pass a repo-relative path as the only positional arg). When the root folder name is **`options-strategy`**, the default xAI collection display name resolves to **`atx-trusted-advisor-<dev|stage|prod>-options-strategy`** (else **`…-xpersonas`**). Per-file override: YAML/frontmatter **`xai_collection_name`**. Optional **`SKIP_SEED_XPERSONAS`**, **`SEED_XPERSONAS_MODE`**, **`SEED_XPERSONAS_STRICT`**. Omit **`model`** in files to inherit **`XAI_CHAT_MODEL`** or **`grok-4-1-fast-reasoning`**.
- Sync xPersonas via admin HTTP CRUD (dev server must be up): `XF_CORE_SESSION=<signed cookie payload> npm run sync:xpersonas:http -- --root atx-rag-collection/options-strategy` (optional **`SYNC_PERSONAS_BASE_URL`**, default **`http://127.0.0.1:3000`**; alias env **`SYNC_PERSONAS_SESSION`**). Same file rules and collection naming as Mongo path.

### Seed admin against remote staging (from your laptop)

`npm run seed:admin` always targets whatever **`MONGODB_URI`** resolves to (`scripts/lib/resolve-mongo-uri.mjs`, same rules as the app). There is **no separate “staging seed” flag** — point the URI at the **staging** cluster/database and run the same script.

**Operator steps (typical):**

1. **Auth:** `gcloud auth login` with a principal that can **access** Secret Manager on the **staging** GCP project (`secretAccessor` on the secret versions you need).
2. **Staging URI:** Read the same material Cloud Run uses — usually secret **`MONGODB_URI_B64`** (name is historical; value may be **plain** `mongodb+srv://…` or **base64** of that string — match how the secret was written). Example:
   ```bash
   export MONGODB_URI="$(gcloud secrets versions access latest --secret=MONGODB_URI_B64 --project="<staging-project-id>" | tr -d '\n')"
   ```
   If the stored value is base64-wrapped, decode once so **`MONGODB_URI`** is a real `mongodb://` / `mongodb+srv://` string (see `parseMongoConnectionString` in `src/lib/env.ts`).
3. **Database name:** Staging Cloud Run sets **`ATX_DEPLOY_TARGET=stage`** → default logical DB **`atxfinance-stage`** when not overridden. Ensure the URI path (or **`MONGODB_DB_NAME`**) matches what the **deployed** service uses so you do not seed the wrong database. **xAI RAG ingest:** set **`ATX_DEPLOY_TARGET=stage`** (or **`staging`**) in the same env file so team collections are named **`atx-trusted-advisor-stage`** (not **`…-dev`**). Explicit deploy tier wins over local **`NODE_ENV=development`** in `scripts/lib/tenant-defaults-seed.mjs`.
4. **`ADMIN_SEED_EMAIL`:** Set to the same admin email you use for staging (often aligned with secret **`ADMIN_SEED_EMAIL`** in GSM). Required for the script; idempotent upsert for that user.
5. **xAI / RAG:** With **`XAI_API_KEY`** + **`XAI_MANAGEMENT_API_KEY`** set locally, seed can **upload** `atx-rag-collection/` to team collections. Use **`SKIP_SEED_XAI_RAG_INGEST=1`** if you only want Mongo/bootstrap work. **`SKIP_XAI_POST_SEED_VERIFY=1`** skips the post-seed hello script.
6. **Network:** Atlas (or self-hosted) must allow your **current IP** (or use **Cloud Shell** / a VPC-attached runner so the URI works from that environment).
7. **Run:** Put the above in a **local-only** env file (e.g. `.env.stage` or `.env.staging.local`, gitignored) and either run **`npm run seed:admin:stage`** (uses **`--env-file=.env.stage`**) or the generic `node --env-file=<path> scripts/seed-admin-user.mjs`. Default **`npm run seed:admin`** loads **`.env`** only.

**Security:** Treat a staging/prod **`MONGODB_URI`** like production credentials — never commit; rotate if leaked. Prefer **break-glass** local runs for rare fixes, or a **workflow_dispatch** CI job that runs seed with OIDC + GSM (no URI on laptops) if the team needs repeatability.

**Admin hub button?** **Not recommended** for full **`seed:admin`** from the browser: it would require **global_admin**-only gated server action, strong audit, and you would still be executing **high-privilege** bootstrap (tenants, users, personas, optional xAI ingest) against live data — easy to misuse. Prefer **operator runbook** (this section) or a **narrow** future tool (e.g. “sync disk xPersonas to Mongo only” with explicit scope) if product needs self-serve ops. **`GET /api/admin/bootstrap-status`** already surfaces bootstrap gaps without running seed remotely.

- Backfill legacy xchat identity fields: `npm run migrate:xchat-identity`
- BFF admin **migration slices** — **PR 3** (tasks + scheduler cutover) and **PR 4** (deploy-note-configs + broker import): operator checklists in [`atx-docs/sre-ops/api-consolidation-spring-backend.md`](./atx-docs/sre-ops/api-consolidation-spring-backend.md) (§ *PR 3 & PR 4 — real migration slices*).

## Cloud Agent Config Freeze (Backoffice Core)

Use this when locking Cursor cloud-agent and deployment config before first GCP rollout.

### Freeze Checklist

- [ ] Domain model fixed: frontend `fintech-advisor.ai`, backoffice `atx.fintech-advisor.ai`
- [ ] Staging host fixed: `staging.atx.fintech-advisor.ai`
- [ ] Separate GCP projects selected (`staging` and `production`)
- [ ] Single X OAuth app configured with both callback URLs
- [ ] GitHub Environments `staging` and `production` created
- [ ] Workflow env vars set and validated in `.github/workflows/deploy-cloud-run.yml` and `.github/workflows/deploy-cloud-run-production.yml`
- [ ] GitHub environment secrets set (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`)
- [ ] Cloud Run runtime secrets provisioned (Secret Manager recommended)

### GCP Secret Manager — Required Secrets (Staging & Production)

These must exist in GCP Secret Manager for each project. The deploy workflow mounts them via `--set-secrets`.

**Single source of truth (Cloud Run runtime):** App credentials exist only in **GCP Secret Manager** per project. The deploy workflows mount them with `gcloud run deploy … --set-secrets` and verify each name with `gcloud secrets describe` **after** OIDC to Google Cloud (see `.github/workflows/deploy-cloud-run.yml` and `.github/workflows/deploy-cloud-run-production.yml`). Do **not** store `XAI_*`, `X_OAUTH_*`, `AUTH_SECRET`, `MONGODB_URI_B64`, `ADMIN_SEED_EMAIL`, or `SLACK_WEBHOOK_URL` in GitHub Environment secrets — GitHub should hold **only** the OIDC deploy credentials (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`).

**GitHub deploy service account (IAM):** The service account in `GCP_SERVICE_ACCOUNT_EMAIL` must be allowed `secretmanager.secrets.get` on each target project (staging and production) so `gcloud secrets describe` succeeds in CI. Grant **`roles/secretmanager.viewer`** or **`roles/secretmanager.admin`** on the project (e.g. `fintech-advisor-staging`). If the job logs `PERMISSION_DENIED: secretmanager.secrets.get` but secrets exist in Console, this binding is missing. Note: **`roles/secretmanager.secretAccessor` alone does not include `secrets.get`** (metadata); runtime mounting still relies on the Cloud Run service agent’s accessor grants when you deploy with `--set-secrets`.

**Merge / deploy preflight:** Pushes to `main` run the staging deploy job. If required GCP secrets are missing, the job fails at **Verify required Secret Manager secrets** (after `npm run build` and GCP auth). Before merging changes that must ship to staging immediately, confirm the **staging** GCP project already has every secret in the table below (or accept a red deploy and fix GSM before retrying).

`ALLOW_ANY_X_USER_LOGIN` is **not** a GCP secret: the workflow sets it from the GitHub **variable** of that name (default `false`). Use **`true` only on staging** if you want any signed-in X user on `/xchat`; on **production**, leave it unset or `false`.

| Secret name | Purpose | Required |
| --- | --- | --- |
| `MONGODB_URI_B64` | Mongo connection string (typically base64 of the URI in GSM); Cloud Run maps it to env **`MONGODB_URI`** | Yes |
| `XAI_API_KEY` | xAI API key for chat completions | Yes |
| `XAI_MANAGEMENT_API_KEY` | xAI management key for collection ops | Yes |
| `X_OAUTH_CLIENT_ID` | X OAuth 2.0 client ID (raw, not base64) | Yes |
| `X_OAUTH_CLIENT_SECRET` | X OAuth 2.0 client secret | Yes |
| `AUTH_SECRET` | Session signing secret (min 16 chars) | Yes |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook (may be empty string) | Yes (create secret; use empty payload if unused) |
| `ADMIN_SEED_EMAIL` | Plain admin bootstrap email (same semantics as local `.env`) | Yes |

Create missing secrets with:

```bash
# Example for staging project
for SECRET in MONGODB_URI_B64 XAI_API_KEY XAI_MANAGEMENT_API_KEY X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET AUTH_SECRET SLACK_WEBHOOK_URL ADMIN_SEED_EMAIL; do
  gcloud secrets create "$SECRET" --project="<staging-project-id>" --replication-policy=automatic 2>/dev/null || true
  echo -n "<value>" | gcloud secrets versions add "$SECRET" --project="<staging-project-id>" --data-file=-
done
```

Automated preflight (recommended before any deploy):

```bash
npm run ops:secrets:verify:staging
npm run ops:secrets:verify:prod
```

### Sync production Secret Manager from `.env.prod` (local)

Cloud Run mounts the eight secrets in the table above. Keep `.env.prod` gitignored; it is a convenience snapshot, not the source of truth in Git.

1. **GCP**: Authenticate and select the production project (or export `GCP_PROJECT_ID_PROD`).
2. **Dry-run** (no writes):  
   `bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --env-file .env.prod`
3. **Apply** (adds new secret versions; same names the deploy workflow expects):  
   `bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --env-file .env.prod --execute`  
   If a name is missing in Secret Manager, add `--create-missing` once alongside `--execute`.
4. **GCP `ADMIN_SEED_EMAIL`**: Ensure the `ADMIN_SEED_EMAIL` secret exists in the **production** project and matches `.env.prod` (the deploy workflow mounts it from Secret Manager like the other runtime secrets — not from GitHub).
5. **Callback URL**: Production uses `X_OAUTH_CALLBACK_URL=${{ vars.PROD_BASE_URL }}/api/auth/x/callback` from the workflow. Do **not** point `PROD_BASE_URL` or any prod callback at `127.0.0.1`. Your X Developer Portal app must list the same HTTPS callback host.
6. **Roll forward**: Deploy a new Cloud Run revision (workflow or manual) so the service picks up `*:latest` secret versions.

Keys in `.env.prod` such as `GOOGLE_CLIENT_*`, `GITHUB_*`, or `XAI_TEAM_ID` are **not** part of the default `--set-secrets` bundle unless you extend the workflow.

### Production-only OAuth env checklist (GH + GCP)

Use this checklist before or after a production callback/login incident:

- [ ] **GitHub Environment secrets (production)** contain only OIDC deploy identity:
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_SERVICE_ACCOUNT_EMAIL`
- [ ] **GitHub Environment secrets do not contain OAuth runtime keys**:
  - `X_OAUTH_CLIENT_ID`
  - `X_OAUTH_CLIENT_SECRET`
- [ ] **GCP Secret Manager (production project)** contains OAuth runtime keys:
  - `X_OAUTH_CLIENT_ID`
  - `X_OAUTH_CLIENT_SECRET`
- [ ] **Cloud Run production runtime env** mounts OAuth keys from Secret Manager refs (not literal values).
- [ ] **Cloud Run production runtime env** sets:
  - `X_OAUTH_CALLBACK_URL=https://atx.fintech-advisor.ai/api/auth/x/callback`

Interactive helper (auth checks + env/project prompts + optional deploy trigger):

```bash
npm run ops:rotate:oauth
```

Quick validation commands:

```bash
# GH production env secrets: should show OIDC keys only
gh secret list --env production

# GCP prod OAuth secrets: both should exist
for s in X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET; do
  gcloud secrets describe "$s" --project fintech-advisor-prod --format="value(name)"
done

# Cloud Run prod env: callback URL + secretKeyRef wiring
gcloud run services describe xfinance-core-prod \
  --project fintech-advisor-prod \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### GitHub Environment Variables

Set these with GitHub Variables (`vars.*`), either repo-scoped or environment-scoped.

| Variable | Staging | Production |
| --- | --- | --- |
| `GCP_PROJECT_ID_STAGING` | `<your-staging-project-id>` | same value (staging-only variable) |
| `GCP_PROJECT_ID_PROD` | same value (prod-only variable) | `<your-prod-project-id>` |
| `CLOUD_RUN_REGION` | `us-central1` (recommended) | `us-central1` (recommended) |
| `CLOUD_RUN_SERVICE_STAGING` | `atxfinance-core-staging` | same value (staging-only variable) |
| `CLOUD_RUN_SERVICE_PROD` | same value (prod-only variable) | `atxfinance-core-prod` |
| `STAGING_BASE_URL` | `https://staging.atx.fintech-advisor.ai` | same value (staging-only variable) |
| `PROD_BASE_URL` | same value (prod-only variable) | `https://atx.fintech-advisor.ai` |
| `EXPECTED_GITHUB_REPOSITORY` | `devsecopstx/xfinance` | same value |
| `EXPECTED_GITHUB_OWNER` | `devsecopstx` | same value |
| `ALLOW_ANY_X_USER_LOGIN` | Optional `true` for open `/xchat` smoke testing | **Do not set** (or `false`) — registered users only |
| `ENABLE_XCHAT_DEBUG` | Optional `true` for detailed xChat payload logs (RAG, prompts) | Optional `true`; ensure Cloud Logging retention ≥30 days for debug logs |
| `XAI_CHAT_MODEL` | Optional override (workflow default **`grok-4-1-fast-reasoning`** if unset) | Same — keep aligned with `.env.example` |

### GitHub CLI Setup (Variables + Secrets)

Use this once GCP resources exist.

```bash
# Required inputs
STAGING_PROJECT_ID="<your-staging-project-id>"
PROD_PROJECT_ID="<your-prod-project-id>"
STAGING_WIP="<staging-workload-identity-provider-resource>"
PROD_WIP="<prod-workload-identity-provider-resource>"
STAGING_SA="<staging-deploy-sa>@${STAGING_PROJECT_ID}.iam.gserviceaccount.com"
PROD_SA="<prod-deploy-sa>@${PROD_PROJECT_ID}.iam.gserviceaccount.com"
GH_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# Repo variables used by workflow (vars.*)
gh variable set GCP_PROJECT_ID_STAGING --repo "$GH_REPO" --body "$STAGING_PROJECT_ID"
gh variable set GCP_PROJECT_ID_PROD --repo "$GH_REPO" --body "$PROD_PROJECT_ID"
gh variable set CLOUD_RUN_REGION --repo "$GH_REPO" --body "us-central1"
gh variable set CLOUD_RUN_SERVICE_STAGING --repo "$GH_REPO" --body "atxfinance-core-staging"
gh variable set CLOUD_RUN_SERVICE_PROD --repo "$GH_REPO" --body "atxfinance-core-prod"
gh variable set STAGING_BASE_URL --repo "$GH_REPO" --body "https://staging.atx.fintech-advisor.ai"
gh variable set PROD_BASE_URL --repo "$GH_REPO" --body "https://atx.fintech-advisor.ai"
gh variable set EXPECTED_GITHUB_REPOSITORY --repo "$GH_REPO" --body "$GH_REPO"
gh variable set EXPECTED_GITHUB_OWNER --repo "$GH_REPO" --body "${GH_REPO%%/*}"

# Optional: staging only — any signed-in X user can use /xchat. Production: omit this variable (defaults to false).
gh variable set ALLOW_ANY_X_USER_LOGIN --repo "$GH_REPO" --env staging --body "true"

# Environment secrets (deploy OIDC only — app secrets stay in GCP Secret Manager)
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env staging --body "$STAGING_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env staging --body "$STAGING_SA"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env production --body "$PROD_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env production --body "$PROD_SA"
```

### Short Ops Task (status snapshot)

Stage/prod URLs and latest deploy: **`npm run status:deploy`** (script: `scripts/ops/print-deploy-status.sh`). Full snapshot including CI:

```bash
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)" && \
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)" && \
echo "latest_ci:" && gh run list --workflow "CI" --limit 1 && \
echo "latest_staging_deploy:" && gh run list --workflow "Deploy Cloud Run" --limit 1 && \
echo "latest_production_deploy:" && gh run list --workflow "Deploy Cloud Run Production" --limit 1
```

**Deploy flow:** a push to **`main`** runs **staging** only (**Deploy Cloud Run** — no production jobs in that file). **Production** uses **Deploy Cloud Run Production** (`.github/workflows/deploy-cloud-run-production.yml`): **`workflow_dispatch` only**, **`confirm_manual_prod=yes`** (optional **`deployment_notes`** for Slack). **Staging redeploy:** **Deploy Cloud Run → Run workflow**. Optional: **Settings → Environments → `production` → Required reviewers** for approval before `gcloud run deploy`.

**Frontend verify (shared):** [`.github/actions/node-verify/action.yml`](.github/actions/node-verify) centralizes Node 22 setup, `npm ci`, lint, typecheck, `actions/cache` on `.next/cache`, and `NODE_ENV=production` `npm run build`. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs it then Vitest with JUnit. Staging/production deploy workflows run a **`verify`** job (same action + `npm run test`) before the deploy job checks out again for `gcloud run deploy --source .` (Cloud Build still produces the container image).

### Deploy Cloud Run: common failures

- **`Cannot update environment variable [ALLOW_ANY_X_USER_LOGIN] to string literal because it has already been set with a different type`** — The live service still maps that name to Secret Manager. The workflow passes `--remove-secrets=ALLOW_ANY_X_USER_LOGIN` before setting literals so the next revision can switch to env literals.
- **`ADMIN_SEED_EMAIL` type clashes** — The workflow clears prior Cloud Run bindings (`--remove-secrets` + `--remove-env-vars`) before mounting `ADMIN_SEED_EMAIL` from Secret Manager. If deploy still fails, confirm the secret exists in the **target GCP project** and the deploy SA has `secretAccessor`.

### GitHub Environment Secrets

Only **OIDC deploy identity** — do not add app runtime secrets here (they belong in GCP Secret Manager only):

| Secret | Staging | Production |
| --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `<staging-provider-resource-name>` | `<prod-provider-resource-name>` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `<staging-deploy-sa>@<staging-project>.iam.gserviceaccount.com` | `<prod-deploy-sa>@<prod-project>.iam.gserviceaccount.com` |

Cloud Run deploy workflows set **`ATX_DEPLOY_TARGET`** (`stage` on staging, `deploy` on production) so the default logical DB is **`atxfinance-<target>`** when **`MONGODB_DB_NAME`** is unset (see `resolveDefaultMongoDatabaseName` in `src/lib/env.ts`). Override with **`MONGODB_DB_NAME`** or the database path inside **`MONGODB_URI`** so Atlas and the app agree. `XAI_TEAM_ID` in `.env.example` is a dev hint only; it is not mounted by the deploy workflow unless you add it to Secret Manager and the deploy mapping.

Set after creating environments:

```bash
GH_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env staging --body "$STAGING_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env staging --body "$STAGING_SA"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env production --body "$PROD_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env production --body "$PROD_SA"
```

### Org/Repo Migration OIDC Fix

If **Deploy Cloud Run** (staging) or **Deploy Cloud Run Production** fails at `Authenticate to Google Cloud` with `unauthorized_client` and `attribute condition`, update both GCP providers and service account bindings to the current repo:

```bash
REPO="devsecopstx/xfinance"
STAGING_PROJECT_ID="fintech-advisor-staging"
PROD_PROJECT_ID="fintech-advisor-prod"

STAGING_PROJECT_NUMBER="$(gcloud projects describe "$STAGING_PROJECT_ID" --format='value(projectNumber)')"
PROD_PROJECT_NUMBER="$(gcloud projects describe "$PROD_PROJECT_ID" --format='value(projectNumber)')"

gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project "$STAGING_PROJECT_ID" \
  --location global \
  --workload-identity-pool github-pool \
  --attribute-condition "assertion.repository=='$REPO'"

gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project "$PROD_PROJECT_ID" \
  --location global \
  --workload-identity-pool github-pool \
  --attribute-condition "assertion.repository=='$REPO'"

gcloud iam service-accounts add-iam-policy-binding "github-deployer@${STAGING_PROJECT_ID}.iam.gserviceaccount.com" \
  --project "$STAGING_PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${STAGING_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

gcloud iam service-accounts add-iam-policy-binding "github-deployer@${PROD_PROJECT_ID}.iam.gserviceaccount.com" \
  --project "$PROD_PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROD_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --env staging \
  --body "projects/${STAGING_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --env staging \
  --body "github-deployer@${STAGING_PROJECT_ID}.iam.gserviceaccount.com"

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --env production \
  --body "projects/${PROD_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --env production \
  --body "github-deployer@${PROD_PROJECT_ID}.iam.gserviceaccount.com"
```

### GitHub Environment Protection Rules

For availability and change control:

- `staging`:
  - No required reviewers (fast feedback).
- `production`:
  - **Required reviewers enabled** (at least one operator) — the **Deploy Cloud Run Production** job targets `environment: production`, so approvals gate production deploys after workflow dispatch.
  - Restrict admin bypass where possible.
  - Optional branch policy to limit deploy sources to `main` and release tags.

### Cloud Run Runtime Secrets (per environment)

Required (GCP Secret Manager; mounted by **Deploy Cloud Run** and **Deploy Cloud Run Production** workflows):

- `MONGODB_URI` (GSM secret often still named `MONGODB_URI_B64`; deploy maps it to env `MONGODB_URI`)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `SLACK_WEBHOOK_URL` (value may be empty)
- `ADMIN_SEED_EMAIL`

`ADMIN_X_USERNAMES` is **not** in the default Cloud Run deploy workflow env lists; set it on the Cloud Run service manually if you use the global-admin X username allowlist in that environment.

### Recommendations and Pub/Sub (optional)

- **Mongo:** collection `app_user_recommendations` (see `src/modules/recommendations/repository.ts`). App_user APIs: `GET`/`POST /api/recommendations`, `GET /api/recommendations/{id}` — scoped to session `userId` + `tenantId`.
- **Env (not in default deploy workflow):** `RECOMMENDATIONS_PUBSUB_TOPIC` (short topic id, e.g. `recommendations.v1`) and a project id: `GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT` or `GCP_PROJECT`. If either is unset, publish is skipped (local dev / CI need no emulator).
- **Event body (JSON):** `event` (`created` \| `updated`), `recommendationId`, `userId`, `tenantId`, `status`, `occurredAt` (ISO), `correlationId`, `scopeTags` (string array). **Attributes:** `event`, `userId`, `tenantId` for pull-filtering before loading full docs from Mongo.
- **IAM:** grant the **core app** Cloud Run service account `roles/pubsub.publisher` on the topic. A **future worker/agent** service account gets `roles/pubsub.subscriber` on a dedicated subscription (filter in app by `userId` / `tenantId` / tags as needed).
- **atxfinance-backend (BFF on):** `RecommendationEventPublisher` publishes the same shape after Mongo insert when `RECOMMENDATIONS_PUBSUB_TOPIC` + project id are set (parity with Next when the proxy is off).

### App user alerts and Pub/Sub (optional, future)

- **Client helper:** `src/lib/pubsub/alerts-publish.ts` — `publishAppUserAlertEvent` when `ALERTS_PUBSUB_TOPIC` and a project id are set; no-op otherwise.
- **Event body:** `event`, `alertId`, `userId`, `tenantId`, `kind`, `severity`, `occurredAt`, optional `payload`, `correlationId`. **Attributes:** `event`, `userId`, `tenantId`, `kind`, `severity`.

### OAuth Callback URLs (single X app)

- `https://atx.fintech-advisor.ai/api/auth/x/callback`
- `https://staging.atx.fintech-advisor.ai/api/auth/x/callback`

### GCP Environment Recreate (atx Apex)

For a full GCP recreate with `atx` instead of `core` subdomain, see [.cursor/skills/gcp-env-atx-recreate/SKILL.md](.cursor/skills/gcp-env-atx-recreate/SKILL.md). Standalone gcloud setup from the monorepo root; no GitHub Actions required for the recipe itself.

### Immediate Rollout TODO (Raw Deploy + Route53)

Use this ordered checklist for first live rollout:

- [ ] Create runtime secrets in both GCP projects (`fintech-advisor-staging`, `fintech-advisor-prod`)
- [ ] Deploy staging raw (`gcloud run deploy ...` to `atxfinance-core-staging`)
- [ ] Validate staging health (`GET https://staging.atx.fintech-advisor.ai/api/health`)
- [ ] Deploy prod raw (`gcloud run deploy ...` to `atxfinance-core-prod`)
- [ ] Add Route53 records for mapped domains

Route53 TODO details:

- [ ] Create/verify `atx.fintech-advisor.ai` DNS record target from GCP domain mapping output
- [ ] Create/verify `staging.atx.fintech-advisor.ai` DNS record target from GCP domain mapping output
- [ ] Set low TTL during cutover (for example, 60-300 seconds)
- [ ] Confirm DNS propagation with `dig` before final health checks
- [ ] Replace temporary Atlas allow-all access (`0.0.0.0/0`) with GCP static egress IP allowlist after validation
- [ ] Ensure `cloudbuild.googleapis.com` is enabled in prod before first `--source` deploy workflow run
- [ ] Create prod domain mapping (`atx.fintech-advisor.ai`) after first successful prod service deploy

## Deploy/Rollback Operations

### Promotion flow

- Push to `main`:
  - deploy **staging** and run health checks
  - **does not** promote to production (production workflow has **no** `push` trigger)
- Manual **Deploy Cloud Run Production** dispatch: **`confirm_manual_prod=yes`**
  - production deploy from the selected branch/ref (verify staging before running); optional **Required reviewers** on the `production` environment add a second approval gate
- Health checks are centralized in `scripts/ops/health-check-with-fallback.sh` for consistent behavior across deploy and rollback workflows.

### Manual rollback (workflow)

Use GitHub Actions workflow `Rollback Cloud Run` with:

- `target`: `staging` or `production`
- `revision`: known good Cloud Run revision (for example, `atxfinance-core-prod-00023-abc`)

The workflow:

1. Shifts 100% traffic to the selected revision.
2. Validates `/api/health` on custom domain.
3. Falls back to `run.app` URL health check if custom domain fails.

### Manual rollback (gcloud fallback)

```bash
# List revisions (replace service/project)
gcloud run revisions list \
  --service atxfinance-core-prod \
  --region us-central1 \
  --project fintech-advisor-prod

# Shift traffic to a known good revision
gcloud run services update-traffic atxfinance-core-prod \
  --region us-central1 \
  --platform managed \
  --to-revisions atxfinance-core-prod-00023-abc=100
```

## API Endpoints

### Health and auth

- `GET /api/health`
- `GET /api/openapi` (OpenAPI 3.1 current-state inventory used by admin Swagger UI)
- `GET /api/auth/x/login`
- `GET /api/auth/x/callback`
- `POST /api/auth/link-email` (email-first fallback link flow)
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Self-service access requests

- `POST /api/access-requests` (authenticated users request their own access; sends Slack notification if `SLACK_WEBHOOK_URL` is configured)

### App_user feedback

- `POST /api/user-feedback` — session required; JSON `{ "message": string (3–4000 chars), "page"?: string }`. Always returns **201** `{ "ok": true }` on success. If `SLACK_WEBHOOK_URL` is set, posts a Slack message (same webhook as access requests); if unset, logs only (see `sendSlackNotification`).

### Admin — access requests

- `GET /api/admin/access-requests`
- `POST /api/admin/access-requests`
- `GET /api/admin/access-requests/:requestId`
- `PATCH /api/admin/access-requests/:requestId`
- `PUT /api/admin/access-requests/:requestId`
- `DELETE /api/admin/access-requests/:requestId`

### Admin — users

- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/users/approved`
- `GET /api/admin/users/:userId`
- `PUT /api/admin/users/:userId`
- `DELETE /api/admin/users/:userId`
- `PATCH /api/admin/users/:userId/email`
- `PATCH /api/admin/users/:userId/plan`
- `PATCH /api/admin/users/:userId/role`
- `GET /api/admin/users/:userId/settings`
- `PUT /api/admin/users/:userId/settings`

### Admin — tasks and scheduler

- `GET /api/admin/tasks`
- `POST /api/admin/tasks`
- `POST /api/admin/tasks/:taskId/run`
- `POST /api/admin/scheduler/tick`
- `GET /api/admin/task-runs`

### Admin — audit and bootstrap

- `GET /api/admin/audit`
- `GET /api/admin/bootstrap-status`

### Personas

- `GET /api/personas`
- `POST /api/personas`
- `GET /api/personas/collections`
- `GET /api/personas/collections/:collectionId` (RAG index stats: documentCount, chunkCount, fileCount, indexStatus)
- `POST /api/personas/collections`
- `GET /api/personas/:personaId`
- `PUT /api/personas/:personaId`
- `DELETE /api/personas/:personaId`
- `POST /api/personas/:personaId/collection/create`
- `POST /api/personas/:personaId/collection/link-files`
- `POST /api/personas/:personaId/verify-collection`
- `POST /api/personas/:personaId/publish` (admin — publishes persona, creates version snapshot)
- `POST /api/personas/:personaId/archive` (admin — archives persona, creates snapshot)
- `POST /api/personas/:personaId/rollback` (admin — `{targetVersion}`, restores from snapshot)
- `GET /api/personas/:personaId/versions` (admin — list version history)

### Portfolios

- `GET /api/portfolios/default` (any signed-in user — returns caller’s default portfolio; admin console uses the same endpoint)
- `GET /api/portfolios/:portfolioId/accounts`
- `PATCH /api/portfolios/:portfolioId/accounts/:accountId` (caller-owned account metadata: name, cash, external ref)
- `GET /api/portfolios/:portfolioId/watchlist` (optional `?quotes=1` for Yahoo quote enrichment)
- `PATCH /api/portfolios/:portfolioId/watchlist` — `addSymbols` / `removeSymbols` (max 20 per array), `dedupe: true`, optional `name`, or **`addEntries`** (max 20 per request): `{ symbol, lineType?, strategy?, quantity?, entryPrice? }` for CSV import and metadata merges. Optional desk fields (same enums as custodian accounts): **`riskProfile`** `conservative`|`balanced`|`growth`, **`outlook`** `growth`|`income`|`balanced`|`aggressive` — use `null` to clear. Admin mirror: **`PATCH /api/admin/portfolios/:id/watchlist`**. List size cap: **75** symbols per watchlist (`src/modules/watchlist/constants.ts`). UI: **`/watchlist`** — Import/Export CSV (`src/app/watchlist/ui/watchlist-console.tsx`); parser: `src/modules/watchlist/parse-watchlist-csv.ts` maps **Entry Price** / **Entry** first, then falls back to **Price** / Last / Close columns into `entryPrice` when re-importing exports. Sample sheet: `atx-docs/branding/atxfinance-watchlist.csv`. **TODO(options-scanner):** watchlist **Rationale** column in the UI is a placeholder until options-scanner fills it.
- `PATCH /api/admin/portfolios/:portfolioId` (global admin) — book-level **`riskProfile`** and free-text **`outlook`** (distinct from per-account outlook slugs); UI: **Admin → Accounts** book card + **`PATCH`** on the portfolio resource.
- `GET /api/positions?portfolioId=&accountId=` (list holdings for an owned account)
- `POST /api/positions` (upsert stock lot for an owned account; same user session as portfolio owner)
- `DELETE /api/positions/:positionId?portfolioId=&accountId=` (remove a lot from an owned account)

### Admin broker import (holdings)

- `POST /api/admin/import/broker` (`global_admin` only) — Merrill or Fidelity **holdings** CSV, same request shape as xfinance-strategy `POST /api/import/broker`: `portfolioId`, `broker`, `exportType: "holdings"`, `csv`, `mappings` (broker account key → core `portfolio_accounts` id), optional `fidelityHoldingsDefaultAccountRef`, optional `dryRun` for parse-only preview. Parsed rows match strategy/OpenAPI `Position` (`ticker`, `shares`, `purchasePrice`, `type`); **stock** rows become Mongo positions (`symbol`, `qty`, `avgCost`); option/cash rows are skipped. UI: **Admin → Portfolios**.

### RAG files

- `GET /api/rag/files` — scoped Mongo-backed file metadata (legacy / other flows)
- `POST /api/rag/files` — upload pipeline for scoped files
- Admin **RAG collections** (`/admin/rag-files`) lists xAI collections via `GET /api/personas/collections` (management API — read-only in UI)

### xStrategyBuilder (options chain)

- UI: `/xstrategybuilder/strategy-options` — signed-in app_user; loads Yahoo expirations + option chain (same behavior family as xfinance-strategy `GET /api/options` and `GET /api/options/expirations`).
- `GET /api/strategy-options/expirations?underlying=TSLA` — normalized `YYYY-MM-DD` expiration list (session required).
- `GET /api/strategy-options?underlying=TSLA&expiration=2026-02-27&strike=250` — combined call/put chain per strike; `dataSource` is `yahoo` or `synthetic` fallback (session required).
- Implementation: `src/modules/strategy-options/options-chain.ts`, `src/modules/strategy-options/expirations.ts`.

### xChat

- `POST /api/xchat/ask` (supports atxfinance tool loop when the **resolved** persona includes the `atxfinance` tool)
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

**Market data path (API-first tooling):**

- `atxfinance` tool operation `market_quote` uses Yahoo (`yahoo-finance2`) as a dedicated quote source for higher fidelity than generic web search.
- **Price source-of-truth (current):** Yahoo Finance (`yahoo-finance2`) via `getYahooMarketQuote()` in `src/modules/xchat/market-data.ts`.
- **Where to change provider later:** update `src/modules/xchat/market-data.ts` (provider client + normalization contract), then keep `market_quote` routing in `src/modules/xchat/tool-executor.ts` aligned so both `atxfinance.market_quote` and `yahoo_finance` tool calls resolve through the same provider path.
- **Disclaimer source of truth:** `MARKET_DATA_DISCLAIMER` in `src/modules/xchat/market-data.ts` (returned with market quote payloads).
- `web_search` remains available for narrative context; quote-sensitive responses should prefer `market_quote`.

**xChat turn artifact retention (policy/compliance):**

- `POST /api/xchat/ask` appends each prompt/response turn to the user's xAI collection and stores evidence pointers in `xchat_logs` (`requestId`, `correlationId`, `xaiTurnFileId`, `xaiTurnPayloadHash`).
- Retention policy is **30 days** for xAI turn artifacts (`XCHAT_TURN_RETENTION_DAYS=30` in `src/modules/core-admin/access-request-bootstrap.ts`).
- Turn documents include `retentionExpiresAt` metadata; cleanup/attestation jobs should purge expired xAI artifacts and emit proof logs/audit events.

**Default published xChat personas (operators should keep both in `published` status):**

| Persona | Audience | `nameNormalized` | Purpose |
|---|---|---|---|
| **Super-Agent** | `global_admin` | `super-agent` | Full admin tool surface (web/X/collections/atxfinance) |
| **atx-trusted-advisor** | All other signed-in roles | `atx-trusted-advisor` | Trusted advisor baseline persona (`default-xpersonas.ts`) |

Seed creates **Super-Agent**; run **`npm run seed:xpersonas`** to upsert **atx-trusted-advisor** (and other YAML personas). In staging/production, **publish both defaults** so governance, directory (`GET /api/personas` for non-admins), and ops docs stay aligned.

**Persona resolution (`POST /api/xchat/ask`):** The active persona is chosen from the **signed-in user’s roles**, not from the client. The optional body field `personaId` is **deprecated and ignored** (kept for backward-compatible clients).

| Session roles | Persona used | `nameNormalized` key |
|---|---|---|
| Includes `global_admin` | **Super-Agent** | `super-agent` |
| Otherwise | **atx-trusted-advisor** | `atx-trusted-advisor` |

- If **Super-Agent** is missing for an admin session, the route returns **503** with guidance to run `npm run seed:admin` or create the persona in Admin → Personas.
- If **atx-trusted-advisor** is missing for a non-admin session, it is created from defaults on first ask (`ensureDefaultTrustedAdvisorPersonaExists` in `src/modules/xchat/repository.ts`). Prefer running `npm run seed:xpersonas` so YAML-backed system prompts/tooling stay canonical.
- Success responses include `data.personaName` (human-readable persona name).

Personas may store batch-style `collections_search` tools; outbound xAI requests map those to `file_search` + `vector_store_ids` (`src/lib/xai-tools.ts`).

**Product scope:** Non-admin xChat is framed for finance / advisory Q&A via the **atx-trusted-advisor** persona `systemPrompt`. There is still no separate server-side topic classifier; admin **Super-Agent** remains broader. Further tightening is persona-governance and product work (see `.cursor/skills/xdesign-review/SKILL.md` deferrals).

<a id="api-docs-validation"></a>

### API docs validation (pre/post deploy)

Validate docs surfaces as part of release checks:

1. `GET /api/openapi` returns HTTP 200 and includes documented paths for all `src/app/api/**/route.ts` handlers.
2. `GET /admin/api-docs` loads Swagger UI in an authenticated admin session.
3. `tests/integration/openapi-current-state-coverage.test.ts` passes in CI (`npm run ci:gate`), preventing route/doc drift.
4. `tests/integration/openapi-document-build.test.ts` asserts the generated OpenAPI 3.1 document shape (info, paths, security schemes, override merge) so builder regressions fail in CI.

## Access Request State Machine

Statuses: `new` → `triaged` → `pending` → `approved` | `rejected` | `expired`

| From | Valid transitions |
|---|---|
| `new` | `triaged`, `approved`, `rejected`, `expired` |
| `triaged` | `pending`, `approved`, `rejected`, `expired` |
| `pending` | `approved`, `rejected`, `expired` |
| `approved` | (terminal) |
| `rejected` | (terminal) |
| `expired` | (terminal) |

SLA: requests expire after 7 days (`ACCESS_REQUEST_SLA_DAYS`). Policy validation in `src/modules/core-admin/access-policy.ts`.

## Persona Governance

Personas have a `status` field: `draft` (default), `published`, `archived`.

- **Publish**: creates an immutable version snapshot in `xchat_persona_versions`, bumps `version`, sets `publishedAt`.
- **Archive**: creates a snapshot, sets `status=archived`. Archived personas are hidden from non-admin users.
- **Rollback**: restores a persona from a previous version snapshot by target version number.
- Non-admin users (`GET /api/personas`) only see `published` personas.
- Admin can filter by `?status=draft|published|archived`.
- All actions create audit events (`entityType: "xpersona"`).
- Admin persona UIs show a **linked collections** count: unique ids from `xaiCollection.collectionId` plus `file_search` / `collections_search` tool `collection_ids` (`src/modules/xchat/persona-linked-collections.ts`).

## Plan Limits and Cost Controls

Plan tiers defined in `src/modules/xchat/plan-limits.ts`:

| Limit | Free | Pro | Enterprise |
|---|---|---|---|
| Prompts/day | 5 | 200 | 2,000 |
| Max turns | 3 | 5 | 10 |
| Max tool calls | 2 | 10 | 20 |
| Batch | No | Yes (100 items) | Yes (500 items) |
| Monthly budget | — | $50 | $500 |
| Model escalation | — | grok-4-latest (>500 chars) | grok-4-latest (>200 chars) |

Tool result caching in `src/modules/xchat/tool-cache.ts` (60s TTL, 200 max entries).

## xPersona Collection Endpoint Notes

- `GET /api/personas/collections` returns `{ data: CollectionInventoryItem[] }` for admin onboarding collection selection (includes RAG index stats when xAI API provides them).
- `GET /api/personas/collections/:collectionId` returns enriched stats for a single collection (documentCount, chunkCount, fileCount, indexStatus).
- `POST /api/personas/collections` accepts `{ name: string }` and creates a new xAI collection for onboarding.
- xPersona can be created without a bound xAI collection (`xaiCollection.collectionId` empty). This enables step-by-step onboarding before RAG wiring.
- Management operations require `XAI_MANAGEMENT_API_KEY`.
- The key used for management operations must have Collections permissions enabled (read for listing and write for creating/linking as needed).
- Current Finance collection id for operations: `collection_b75e188e-e7e6-4aa8-8e01-23caf0946236`.
- Error responses include stable `code` values for operator troubleshooting:
  - `missing_management_key`
  - `upstream_unauthorized`
  - `upstream_forbidden`
  - `upstream_error`
  - `validation_error`
  - `invalid_json`
  - `payload_too_large`

## Multi-tenant Seed Verification

After running `npm run seed:admin`, verify:

0. **xAI keys** — With `XAI_API_KEY` and/or `XAI_MANAGEMENT_API_KEY` set, seed runs **`verify-xai-hello`** (minimal chat “hello world” + management collections list). Failures exit non-zero so miskeys are caught before starting Next. Skip with **`SKIP_XAI_POST_SEED_VERIFY=1`**. Run alone: **`npm run verify:xai-hello`**.
1. `core_users` has the email from `ADMIN_SEED_EMAIL` with role `global_admin`
2. `core_tenants` has `slug: atxfinance-core` with `isDefault: true`
3. `core_tenant_memberships` has one default membership linking the admin user and default tenant
4. `xchat_personas` contains default **Super-Agent** persona with:
   - `nameNormalized: "super-agent"`
   - `systemPrompt` set to the Architect administrative prompt
   - `xaiCollection.collectionId: "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"` (Finance collection)
   - `xapi.tools`: `web_search`, `x_search`, `file_search` (Finance collection ids), and `atxfinance`
5. **xFinance** (`nameNormalized: "xfinance"`): not created by seed — the first non-admin `POST /api/xchat/ask` creates it from `default-xpersonas.ts` if absent. **Publish** this persona for non-admin xChat (FinExpert); prefer an explicit seeded or hand-crafted row in Admin → Personas so environments stay clear.
6. `tenant_portfolio` (singular; legacy: `portfolio_portfolios` or `tenant_portfolios`) contains one default portfolio for the seeded admin user with `tenantPortfolioOrgKey` defaulting to `org-atx-finance` (override via `TENANT_PORTFOLIO_ORG_KEY`).
7. `portfolio_accounts` contains one default account (`type: "fidelity"`, **`extAccountId`: `ext_account_xref`**) linked to that default portfolio — same ref as `provisionDefaultPortfolioForUser` and Spring `DefaultPortfolioProvisionService` (broker CSV / import alignment).
8. `portfolio_watchlists` contains `DefaultWatchlist` linked to that default portfolio with `symbols: [{ symbol: "TSLA" }]`.

**Existing databases:** run once per environment:

`npm run migrate:tenant-portfolio`

Re-running `npm run seed:admin` should remain idempotent (no duplicates).

## Batch Knowledge Base Workaround

For batch workflows, use this retrieval pattern:

1. Pre-search target collections with `POST /v1/documents/search` (xAI API).
2. Inject the returned snippets into each JSONL batch item as contextual text.
3. Submit the enriched JSONL batch request.

This is the current workaround when direct "Knowledge Base" wiring is not available in batch mode.

### Collection upload/link workflow (required two-step)

To make files visible inside a collection, perform both steps:

1. Upload file with standard xAI API key (`XAI_API_KEY`) to get a `file_id`.
2. Attach that file to the collection with management key (`XAI_MANAGEMENT_API_KEY`).

#### Practical Bash example

```bash
# 0) Set KB collection id (use the same `XAI_TEAM_ID` value when it is a `collection_*` id)
export XAI_TEAM_ID="collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"

# 1) Upload file using standard key
UPLOAD_RESPONSE="$(curl -sS -X POST https://api.x.ai/v1/files \
  -H "Authorization: Bearer ${XAI_API_KEY}" \
  -F "file=@./finance-kb.md")"
echo "${UPLOAD_RESPONSE}"

# 2) Parse uploaded file id (requires jq)
FILE_ID="$(echo "${UPLOAD_RESPONSE}" | jq -r '.id')"

# 3) Attach uploaded file to collection using management key
curl -sS -X POST "https://management-api.x.ai/v1/collections/${XAI_TEAM_ID}/documents/${FILE_ID}" \
  -H "Authorization: Bearer ${XAI_MANAGEMENT_API_KEY}"
```

### Team API-key create smoke (safe template)

Use environment variables (do not hardcode live tokens in source):

- `XAI_TEAM_ID`
- `XAI_MANAGEMENT_API_KEY`
- `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true`

The smoke test calls:

```bash
POST https://management-api.x.ai/auth/teams/${XAI_TEAM_ID}/api-keys
```

with payload shape:

```json
{
  "name": "atxfinance-smoke-<timestamp>",
  "acls": ["api-key:model:*", "api-key:endpoint:*"],
  "qps": 3,
  "qpm": 10,
  "tpm": null
}
```

## Design and Branding

- **Branding prompts and tags:** `atx-docs/branding/atxfinance-brand-prompts.md`, `atx-docs/branding/atxfinance-branding-tags.md`, `atx-docs/branding/atxfinance-color-palette.md`, `atx-docs/branding/atxfinance-typography.md`
- **Design system:** `atx-docs/design-system/atxfinance-brand-kit.md`, `atx-docs/design-system/atxfinance-brand-kit.css`
- **Admin console UX:** Admin surfaces follow a clean, low-noise style (console.x.ai inspired). See `atx-docs/design-system/atxfinance-brand-kit.md` § Admin Console Direction. UX review findings: `atx-docs/xchat/xdesign-review-admin-console-ux.md`

## Admin Step-by-Step Validation (xChat readiness)

1. Run `npm run seed:admin`.
2. Confirm **Super-Agent** and **xFinance** are visible in admin personas and **published** (default xChat personas).
3. Confirm default portfolio/account surfaces load for the seeded admin user.
4. Open `/xchat` and run a prompt — persona is **implicit** (Super-Agent for `global_admin`, xFinance for other roles); there is no persona picker. For API-only checks, use `POST /api/xchat/ask` with a signed session cookie (see `AGENTS.md`).
5. Optionally create/select an xAI collection and re-run validation with RAG enabled on **Super-Agent**.

### Authenticated smoke checklist (admin session)

Use this checklist to validate "admin can start using xChat" in an authenticated browser session:

1. Start app: `npm run dev`.
2. Open `http://localhost:3000/login` and complete admin login.
3. Open `/admin/personas`:
   - verify **Super-Agent** and **xFinance** are visible and published,
   - verify no-collection mode is allowed,
   - verify collection-dependent actions show clear guidance when collection is not bound.
4. Open `/dashboard` or `/holdings`:
   - verify default portfolio/account data surfaces load for seeded admin.
5. Open `/xchat`:
   - submit a prompt and verify a response returns (implicit persona: Super-Agent for seeded admin).
6. Optional RAG validation:
   - bind a collection,
   - run file sync/recheck actions,
   - ask xChat a prompt expected to hit collection context.

## Example Payloads

### Create Access Request

`POST /api/admin/access-requests`

```json
{
  "userId": "usr_123",
  "requestedRole": "operator",
  "reason": "Needs broker reconciliation access"
}
```

### Create Access Request By Email (manual admin entry)

`POST /api/admin/access-requests`

```json
{
  "email": "analyst@atxfinance.ai",
  "requestedRole": "operator",
  "reason": "Onboarding from admin console"
}
```

### Create Scheduled Task

`POST /api/admin/tasks`

```json
{
  "name": "Daily Broker Sync",
  "category": "sync-broker",
  "scheduleCron": "0 2 * * *",
  "enabled": true
}
```

### Upsert User Admin Settings

`PUT /api/admin/users/usr_123/settings`

```json
{
  "broker": {
    "provider": "alpaca",
    "accountRef": "alpaca-main",
    "enabled": true
  },
  "portfolio": {
    "riskProfile": "balanced",
    "baseCurrency": "USD",
    "rebalanceFrequencyDays": 14
  },
  "account": {
    "accountStatus": "active",
    "maxConcurrentSessions": 3,
    "timezone": "America/New_York"
  },
  "notificationDefaults": {
    "email": true,
    "push": true,
    "sms": false,
    "digestHourUTC": 13
  }
}
```



## SRE Runbook: Local Health, Tests, and CI Gate

This project includes smoke checks and SRE-focused tests to prevent config/secrets regressions and infra drift.

- Commands
  - `npm run smoke:verify` — runs smoke tests only (env parity, docker-compose sanity)
  - `npm run test` — full test suite
  - `npm run typecheck` — TypeScript type check
  - `npm run lint` — ESlint
  - `npm run ci:gate` — runs lint + typecheck + tests; recommended for PRs

- Env hygiene
  - `.env.example` is kept in sync with runtime-required keys from `src/lib/env.ts` (`REQUIRED_RUNTIME_ENV_VARS`).
  - Smoke tests prevent committing obvious live secrets (e.g., `pk_live_...`, long `xai-...` tokens) in `.env.example` or `tennat_defaults.yaml`.
  - Use Secret Manager for all real keys in staging/prod. Keep repository defaults empty or clearly fake.

- Docker Compose sanity
  - `docker-compose.yml` must define `mongodb` and `atxfinance-backend` services and expose ports 27017 and 8080 respectively.
  - A `healthcheck` on backend or `depends_on: condition: service_healthy` should be present so `mongodb` becomes ready before backend starts relying on it.

- Backend health endpoint
  - `GET /api/backend/health` returns service status, active profiles, and masked Mongo connection information.

- Push policy (PR checklist)
  - [ ] `npm run ci:gate` passes locally
  - [ ] No real secrets in repo files (`.env.example`, `tennat_defaults.yaml`, docs, scripts)
  - [ ] New env keys are added to `.env.example` and validated in `src/lib/env.ts`

  ### Backend dependency version management

  The Spring Boot backend (`services/atxfinance-backend`) uses a Gradle Version Catalog to avoid hard‑coding dependency and plugin versions.

  - Catalog file: `services/atxfinance-backend/gradle/libs.versions.toml`
    - Defines versions for: Spring Boot, Kotlin, SpringDoc, ShedLock, OpenTelemetry, and the Google Cloud BOM.
    - Plugin versions are managed via `plugins` aliases in the catalog.
  - Build script: `services/atxfinance-backend/build.gradle.kts`
    - Uses `alias(libs.plugins.…)` for plugin versions.
    - Uses `implementation(platform(libs.gcp.bom))` for Google Cloud libraries.
    - Uses `libs.springdoc.webmvc.ui`, `libs.shedlock.spring`, `libs.shedlock.mongo`, `libs.otel.otlp` for library coordinates without inline versions.
    - Spring Boot starters and Micrometer libraries rely on Spring Boot’s dependency management — no explicit versions in the module file.

  How to bump versions:
  - Edit `libs.versions.toml` and change the relevant entry under `[versions]`.
  - For Google Cloud client libraries, update the `gcp-bom` version — individual GCP deps then follow the BOM.
  - Re‑sync Gradle or run `./gradlew build` to apply.
