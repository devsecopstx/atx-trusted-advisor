# AGENTS Runbook

## Scope

Operational runbook for engineers/agents working in `atxfinance` core admin app.

**Cursor personas & skills:** see **DEVELOPMENT.md** → *Cursor agents & skills (repo-local)* and **`.cursor/agents/README.md`**.

## Standard Local Flow

1. `cp .env.example .env` — set `ADMIN_SEED_EMAIL`; if you use **Sign in with X** and X does not return an email, also set **`ADMIN_SEED_X_USER_ID`** (your X numeric user id) so seed + OAuth can attach `xAccount` to the admin row. For Docker Mongo with auth, set **`MONGODB_URI`** to `mongodb://admin:<password>@127.0.0.1:27017/<db>?authSource=admin` (password defaults to **`localdev`** in `docker-compose.yml` when `MONGO_ROOT_PASSWORD` is empty).
2. `npm install`
3. `npm run mongo:up` — MongoDB service only, waits for healthy — **or** `docker compose --env-file .env up -d` for Mongo + backend container
4. `npm run seed:admin` — **or** `npm run local:bootstrap` to run step 3 + seed in one shot
5. `npm run dev`

**Docker Mongo `Authentication failed` (mongosh / Next.js):** (1) Init runs only on an **empty** data volume — run **`npm run mongo:docker-recreate`** to wipe the Compose volume and re-init with **`admin`/`localdev`**. (2) If recreate **passes** but **host** `mongosh` still fails, **another `mongod` is usually bound to host TCP 27017** (common: Homebrew Mongo). Docker’s Mongo is then on a different published port or unreachable; stop the other service (`brew services stop mongodb-community`) or change **`mongodb` `ports`** in `docker-compose.yml` to e.g. **`27018:27017`** and use **`27018` in `MONGODB_URI`**. Avoid **`export MONGO_ROOT_PASSWORD=`** (empty) before `docker compose up` — it overrides `.env`.

**Seed defaults (`ADMIN_SEED_EMAIL`):** `core_users.subscriptionPlan` is **`basic`**; bootstrap `admin_access_requests` uses **`requestedPlan: basic`** when the paper row is first inserted; default xChat persona is **advisor** from **`atx-docs/rag-collection/xpersonas/advisor/advisor.yaml`**. Re-running **`seed:admin`** sets **`subscriptionPlan`** back to **`basic`** for that email. **`seed:admin`** also runs **`scripts/ops/sync-scheduled-tasks-from-spec.ts --apply --tenant=<seeded tenant>`** (unless **`SKIP_SEED_SCHEDULED_TASKS_SYNC=1`**) so **`/admin/tasks`** lists default tenant-level scheduled jobs; same as **`npm run ops:scheduled-tasks:sync -- --apply --tenant=…`**.

**Wipe local DB and re-seed:** `RESET_LOCAL_MONGO=1 npm run mongo:reset` (destructive — removes the Compose Mongo volume).

## Validation Gates

- Lint: `npm run lint`
- Types: `npm run typecheck`
- Tests: `npm run test`
- Integration-only: `npm run test:integration` (optional; `npm run test` already includes `tests/integration/**`)
- Live integration (optional): `npm run test:integration:live` (spins isolated Docker Compose stack: Mongo + atxfinance-backend + Redis; contract checks under `tests/live`; keeps default test suite hermetic)
- Build: `npm run build`
- CI gate: `npm run ci:gate`
- Release gate: `npm run ci:gate && npm run build`

OpenAPI inventory is guarded by route parity + document build tests under `tests/integration/openapi-*.test.ts` (see `DEVELOPMENT.md#api-docs-validation`).

Deploy: Cloud Run runtime secrets are **GCP Secret Manager only** (verified in workflow via `gcloud secrets describe`). GitHub Environment secrets are **OIDC only** (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`). See `DEVELOPMENT.md` → *GCP Secret Manager* and *GitHub Environment Secrets*.

## Surfaces: app_user vs admin_console

- **admin_console:** `/admin/*` and `/api/admin/*` — `global_admin` only (`src/proxy.ts` sends unauthenticated users to `/xchat` for protected paths; layout/API still enforce role).
- **app_user:** The **signed-in product user** (xChat, portfolio, watchlist, etc.). Routes live under prefixes in `src/modules/surface-policy.ts` (`APP_USER_PRODUCT_PATH_PREFIXES`). Capability is platform roles **`viewer`**, **`operator`**, **`advisor`** — **not** a literal Mongo role string `app_user`. Admins onboard users via **Access requests** (`admin_access_requests`): approve and assign a role. **`global_admin`** may still use app_user routes (e.g. xChat from the admin topbar).
- **Docs term “account” (portfolio):** Means a **`portfolio_accounts`** row under the user’s **default portfolio** (custodian account with **`cashBalance`**); **holdings** are **`portfolio_positions`**. See **DEVELOPMENT.md** → *Glossary: app users, access, portfolios, and “account”* and *Required / optional fields for a new portfolio account*.

## Production validation (post-deploy)

After merging and deploying to production (or staging first):

1. **Health:** `GET https://<base>/api/health` → `200` with `status: ok` and `version` (semver from `package.json` at build; use to verify staging/prod vs UI footer).
2. **Admin:** Sign in as `global_admin` → `/admin` loads; use **Hub → xChat** or the topbar **xChat** link to open `/xchat` without leaving the admin shell’s sibling routes. `GET /api/personas` → `200` with session cookie.
3. **App_user:** Sign in with X as a user who has platform role **`viewer`**, **`operator`**, or **`advisor`** (Admin → Access approved + role assigned). **The string `app_user` is not a role** — use those roles. Then `/xchat` loads full chat (not plans only); `POST /api/xchat/ask` → `200` (not `401`).
4. If still `401` / `access_request_pending` / guest xChat: confirm Mongo user has `roles` including one of `advisor`/`operator`/`viewer` (`canUserLogin` in `src/modules/identity/authorization.ts`). Optional dev: `ALLOW_ANY_X_USER_LOGIN=true` (not for prod unless intended).
5. See `.cursor/skills/deploy-production/SKILL.md` and `DEVELOPMENT.md` for deploy + rollback; run **`npm run status:deploy`** for URLs and latest workflow runs.

## Critical Env Keys

- `MONGODB_URI`
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `SLACK_WEBHOOK_URL`
- `ADMIN_SEED_EMAIL`
- `STRIPE_WEBHOOK_SECRET`

## Quick Health Checks

- API health: `GET /api/health`
- OpenAPI inventory: `GET /api/openapi`
- Swagger UI (admin): `GET /admin/api-docs`
- Auth callback path configured in X app: `/api/auth/x/callback`
- **Spring OAuth cutover (dual-run):** `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` — gaps vs approved contract, `/xchat?error=` matrix, operator checklist
- Personas API: `GET /api/personas`
- xChat ask API: `POST /api/xchat/ask` — **published defaults:** **advisor** (global_admin), **atx-trusted-advisor** (app roles); **RAG / file_search collection scope** is **only** what is declared on the resolved persona (`xaiCollection` + tool `collection_ids`), not env defaults or implicit user/team merges. **Effective xAI model** comes from the **resolved persona’s `model`**, else **`XAI_CHAT_MODEL`** or **`grok-4-1-fast-reasoning`** (see `.env.example`); optional `personaId` / admin-assigned persona selects persona — **no** request-body `model` override. Optional JSON **`portfolioId`** (24-char hex, **owned** portfolio) scopes workspace preload and `atx_function` to that book (same idea as `/watchlist?portfolioId=`). **`/xchat?portfolioId=`** sets the same scope server-side and syncs the workspace cookie via `POST /api/user/workspace-portfolio`. Watchlist tool/snapshot rows include **`targetEntryNotional100xDisplay`** (100× Yahoo — matches Watchlist **Target entry** column) and desk **`entryPrice`** / **`targetEntryDisplay`**. **`xapi.tools`** are used as stored (include **`atx_function`** / `yahoo_finance` on the persona when needed; UI citation slug remains `atxfinance` / `XF_CITE:atxfinance`).
- **xAI API standard:** [xAI docs overview](https://docs.x.ai/overview) + repo map **`atx-docs/xchat/xai-api-standard.md`**
- xAI chat API key smoke (dev/SRE): `npm run smoke:xai-chat` with `XAI_API_KEY` in `.env` — see `DEVELOPMENT.md` § *xAI chat completions smoke*
- Market price source-of-truth (current): Yahoo Finance via `yahoo-finance2` (`src/modules/xchat/market-data.ts`); quote-related prompts/tools should route through `market_quote` / `yahoo_finance` rather than narrative web-only lookups
- Watchlist (app_user): `/watchlist` — CSV **Import/Export**; `PATCH /api/portfolios/:id/watchlist` accepts `addEntries` (`lineType`, `strategy`, `quantity`, `entryPrice`) for merged rows, plus optional **`riskProfile`** / **`outlook`** desk fields (`null` clears). Reference CSV: `atx-docs/branding/atxfinance-watchlist.csv`
- xOptions (app_user): `/xoptions` — stepped strategy builder; `GET /api/app-user/find-options/bootstrap` returns context + top holdings + hot watchlist in one round-trip (page also uses workspace snapshot cache for holdings when rev matches xChat preload). `GET /api/app-user/find-options/context` remains for narrow callers; both include `scoringFactors` + `optionsApproved` (Mongo `optionsTradingEnabled` or `XOPTIONS_ASSUME_OPTIONS_APPROVED`, optional `NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL`). **Layout:** `src/app/xoptions/layout.tsx` imports `portfolios-dashboard.css` (with `xoptions.css`) so **`WorkspaceProductSidebar`** rail uses `portfolios-workspace-sidebar__*` glyph sizing — same pattern as **`xchat/layout.tsx`**. **Soft theme:** `html[data-xf-ui="soft"]` maps `--xf-xoptions-surface` to `--xf-bg-900` in `globals.css`; symbol chart panel follows `data-xf-ui` for Apex light/dark chrome. See `atx-docs/xchat/xoptions-strategy-builder.md`.
- Role default (ops/support): default onboarding role for xOptions/strategy-job paths is **`operator`** (Admin → Manage Users create default, self/public access-request defaults, OAuth/link-email auto-created pending access requests).
- App_user feedback: `POST /api/user-feedback` (session cookie) — optional Slack via `SLACK_WEBHOOK_URL`; UI entry: xChat / xCoach / portfolio / watchlist header **Feedback**
- **App_user 500 while admin works:** see [DEVELOPMENT.md — App_user HTTP 500](DEVELOPMENT.md#app_user-http-500); check Cloud Run logs for `[auth/x/callback]` and Mongo/provisioning errors

## Quick Ops Status Task

Stage/prod URLs and latest deploy run: **`npm run status:deploy`** (runs `scripts/ops/print-deploy-status.sh`; requires `gh`).

Runtime secret preflight (stage/prod):

```bash
npm run ops:secrets:verify:staging
npm run ops:secrets:verify:prod
```

**Staging** `ops:secrets:verify:staging` also requires **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`** (Sign in with Google). Sync them with `npm run ops:secrets:sync-google-oauth:staging` (see `atx-docs/guides/deploy-and-ops.md`). **Production** default verify (`ops:secrets:verify:prod`) does **not** require Google secrets — use **`npm run ops:secrets:verify:prod:with-google-oauth`** once Sign-in with Google is enabled in prod and both secrets exist in the prod project.

Set GitHub Environment variable **`ATXFINANCE_BACKEND_ORIGIN`** for both `staging` and `production` to the backend HTTPS origin (no `:8080` on public hostnames). Deploy preflight now fails fast when this variable is missing.

Push **Redis**, **Stripe publishable + webhook**, and (when using Google login) **Google OAuth** keys from `.env.stage` / `.env.prod` into the matching GCP project’s Secret Manager (see `.cursor/rules/sre-gcp-deployment.md`):

```bash
npm run ops:secrets:sync-redis:staging
npm run ops:secrets:sync-stripe-publishable:staging
npm run ops:secrets:sync-stripe-webhook:staging
npm run ops:secrets:sync-google-oauth:staging
# production: …:prod variants
```

Full snapshot including CI:

```bash
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)" && \
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)" && \
echo "latest_ci:" && gh run list --workflow "CI" --limit 1 && \
echo "latest_staging_deploy:" && gh run list --workflow "Deploy Cloud Run" --limit 1 && \
echo "latest_production_deploy:" && gh run list --workflow "Deploy Cloud Run" --limit 5
```

**Deploy:** use **Deploy Cloud Run** (`.github/workflows/deploy-cloud-run.yml`) via **`workflow_dispatch`** with inputs: **`branch`**, **`target`** (`staging`/`production`), and **`confirm_manual_approval=yes`** (optional **`deployment_notes`**). Keep **Required reviewers** on both GitHub environments (`staging`, `production`) for manual approval gates. Slack deploy note posts when `SLACK_WEBHOOK_URL` is configured in Secret Manager.

## Guardrails

- Keep secrets only in `.env`; never commit real tokens.
- Prefer updating existing docs over creating duplicates.
- Non-blocking backlog / design TBD: `atx-docs/PLAN.md`.
- For persona/xchat/admin-audit changes, run at least build + typecheck before PR.
- **Roles:** platform roles vs `tenantRole` — see `DEVELOPMENT.md` → *Platform roles vs tenant membership (session)*. Use `isGlobalAdmin()` / `canUserLogin()` from `@/modules/identity/authorization` (and `requireGlobalAdminSession` for admin APIs); avoid ad-hoc `roles.includes("global_admin")`.

## Cursor Cloud specific instructions

### Database: Atlas mode (no local Docker)

Cloud agents connect to MongoDB Atlas — **do NOT run `docker compose up -d`**.
The `MONGODB_URI` secret is injected as an environment variable by the Cursor Cloud
runtime. Run `npm run env:cursor-cloud` to create missing `.env` and `.cursor/worktrees.json`
from injected secrets.

## Project Cursor Skills (Safe Set)

- Project-local skills are stored in `.cursor/skills/`. See `.cursor/skills/README.md` for the full index.
- Skill folder names omit the legacy `atx-` prefix (e.g. `backend-architecture`, `skill-covered-calls`, `deploy-production`); `atxdesign-review*` review gates keep the historical `atxdesign` stem.
- Ops/review skills: `sre-docs-ops`, `skill-xchat-validation-checklist`, `runbook-navigator`, `design-ops`, `atxdesign-review`.
- Backend (multi-node agents) skills: `backend-architecture`, `backend-deploy-stage`, `backend-deploy-prod`, `backend-runbook`, `backend-ci`.
- Junie guidelines for backend operations: `atx-docs/sre-ops/junie-guidelines-atxfinance-backend.md`.
- xDesign review outputs: `atx-docs/xchat/xdesign-review-admin-console-ux.md` (and other `atx-docs/xchat/*.md`).
- Options strategies: **10** `skill-*` playbooks (options structures); index: `.cursor/skills/README.md` § *Options strategies*.
- All skills are non-destructive — they must not deploy, rotate keys, or mutate production/staging secrets.
- Runtime xChat custom-tool execution is intentionally deferred; see `atx-docs/xchat/atxfinance-tool-stub.md`.

### Project Cursor rules (optional)

- File-backed rules live in **`.cursor/rules/*.mdc`** (tracked; see `.gitignore` exceptions alongside `.cursor/skills/`).
- Example: **`xfinance-chat-expert.mdc`** — xChat/mobile/performance expert workflow; attaches via `globs` under `**/xchat/**`, `src/modules/xchat/**`, `atx-docs/xchat/**`, etc.
- When editing rules, follow **`generate-docs`** (Cursor rules section) and **`test-commit-push`** checklist (frontmatter + no patch noise).

### Local skill maintenance policy

- Treat `.cursor/skills/` as the source of truth for this repo.
- When runbooks, deploy flow, or validation gates change, update these first:
  - `.cursor/skills/generate-docs/SKILL.md`
  - `.cursor/skills/test-commit-push/SKILL.md`
  - `.cursor/skills/test-commit-push/CHECKLIST.md`
- App version lives only in `package.json`; runtime reads via `src/lib/app-version.ts`.
  - Skill `.md` files must never contain hardcoded version strings — a version bump must not touch skills.

### .env generation

The `.env` file is generated by `npm run env:cursor-cloud` from Cursor secrets. Required secrets
(configured in Cursor Cloud > Secrets):

| Secret name | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string (plain or base64) |
| `XAI_API_KEY` | xAI API key for chat completions |
| `XAI_MANAGEMENT_API_KEY` | xAI management key for collection ops |
| `X_OAUTH_CLIENT_ID` | X OAuth client ID (raw, not base64) |
| `X_OAUTH_CLIENT_SECRET` | X OAuth client secret |
| `AUTH_SECRET` | Session signing secret (min 16 chars) |
| `ADMIN_SEED_EMAIL` | Admin bootstrap email for seed-admin promotion/login linking |
| `ALLOW_ANY_X_USER_LOGIN` | Optional feature flag (`true` enables authenticated X-user login to `/xchat`; default is disabled) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for access request notifications (optional) |

### Starting the app

```bash
npm run dev          # Next.js dev server on :3000
npm run seed:admin   # Full bootstrap (default): Mongo + advisor + disk xPersonas + xAI RAG ingest + post-seed verifies (skip flags apply)
npm run seed:admin:db   # DB-only onboarding: Mongo + xPersonas + advisor assignment; skips xAI ingest and xAI verifies
npm run seed:admin:rag-sync   # Standalone disk -> xAI trusted-advisor collection ingest + post-seed RAG verify
npm run verify:xai-hello   # Standalone chat + management ping (same as post-seed check)
npm run verify:xai-seed-rag   # Standalone seeded RAG collection/doc-count verification
```

Verify: `curl http://localhost:3000/api/health` should return `{"status":"ok","service":"xfinance-core-app",...}`.

### Session cookie for testing authenticated endpoints

There is no dev auth bypass. To call protected endpoints (`/api/admin/*`, `/api/personas`, `/api/xchat/ask`, etc.) without OAuth, craft a signed session cookie using the `AUTH_SECRET` from `.env`:

```bash
node --env-file=.env -e "
const crypto = require('crypto');
const secret = process.env.AUTH_SECRET || process.env.X_OAUTH_CLIENT_SECRET;
const payload = JSON.stringify({
  userId: '<userId from seed output>',
  email: '<same as ADMIN_SEED_EMAIL in .env>',
  roles: ['global_admin'],
  tenantId: '<tenantId from seed output>',
  tenantRole: 'tenant_admin',
  xUserId: 'dev_test',
  username: 'dev_test',
  exp: Date.now() + 12*60*60*1000
});
const enc = Buffer.from(payload,'utf8').toString('base64url');
const sig = crypto.createHmac('sha256',secret).update(enc).digest('base64url');
console.log(enc+'.'+sig);
"
```

Then pass it as: `curl -b "xf_core_session=<cookie>" http://localhost:3000/api/...`

### Validation gates

See `package.json` scripts — same as documented in README:
`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run ci:gate`.

### Agent roles

Three cloud agent configurations are supported:

1. **PR Reviewer** — runs `npm run ci:gate` (lint + typecheck + test), reviews diff for type-safety and code-style compliance.
2. **Feature Branding** — works on UI/design-system changes under `src/app/`, `atx-docs/design-system/`, and brand-related assets.
3. **Feature Core MVP** — works on API routes (`src/app/api/`), domain logic (`src/lib/`), and data layer changes.

All three share the same update script and secret requirements above.

### Running without MONGODB_URI

When `MONGODB_URI` is not configured, the app falls back to `mongodb://localhost:27017/atxfinance` (no credentials) unless **`MONGO_ROOT_PASSWORD`** is set, in which case it uses **`MONGO_ROOT_USERNAME`** (default `admin`) and that password with **`authSource=admin`**. Without a running Mongo instance, `GET /api/health` returns HTTP 500 (connection refused) but the dev server itself runs fine. Pages that do **not** require a DB session work: `/api/health`, `/api/openapi`, and other static or unauthenticated routes as implemented. Auth-gated pages (`/xchat`, `/admin/*`, `/portfolio`, `/watchlist`) and `npm run seed:admin` require a live MongoDB connection. All validation gates (`npm run ci:gate`) pass without MongoDB — tests use mocked dependencies.

### MONGODB_URI secret encoding caveat

The Cursor Cloud runtime may inject `MONGODB_URI` as `MONGODB_URI_B64=<base64>` (the literal prefix `MONGODB_URI_B64=` embedded in the value). `npm run env:cursor-cloud` writes this verbatim, which the app's `parseMongoConnectionString` cannot decode. If `seed:admin` fails with `Invalid MONGODB_URI: decoded value is not a MongoDB URI`, strip the prefix and decode manually:

```bash
B64=$(printenv MONGODB_URI | sed 's/^MONGODB_URI_B64=//') && DECODED=$(echo "$B64" | base64 -d)
```

Then write the decoded `mongodb+srv://...` URI into `.env` and `unset MONGODB_URI` before running seed or dev (since `--env-file=.env` does not override existing shell env vars).

### Gotchas

- The env schema (`src/lib/env.ts`) requires `XAI_API_KEY`, `XAI_MANAGEMENT_API_KEY`, `X_OAUTH_CLIENT_ID`, and `X_OAUTH_CLIENT_SECRET` to be non-empty strings. The app will not start without them even if you only need non-AI endpoints.
- `AUTH_SECRET` must be at least 16 characters or Zod validation fails silently at `.optional()` parse.
- The seed script uses `--env-file=.env` (Node 20+ flag), so `.env` must exist before running `npm run seed:admin`.
- Auth-protected endpoints (`/api/personas`, `/api/admin/*`, `/admin/*`) return `{"error":"Unauthorized"}` without a valid session cookie. The health endpoint is unauthenticated.
- Tests (`npm run test`) are all unit/integration tests with mocked dependencies — they do not require MongoDB or the dev server to be running.
- The xAI management key-create smoke test is opt-in via `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true` and requires real API keys.
- `*.code-workspace` files are gitignored — they are local IDE config and not used by cloud agents.
- `npm run build` requires `NODE_ENV=production` (or unset). The Cloud Agent shell defaults to `NODE_ENV=development`, which causes Next.js to warn and SSG pages to fail. Use `NODE_ENV=production npm run build`.
- See `DEVELOPMENT.md` for the full Cloud Agent Atlas Mode setup and OAuth host-consistency notes.
- **X OAuth (prod):** PKCE cookies must ride the same `NextResponse` as the redirect to X (`applyOAuthFlowCookiesToRedirect` in `src/lib/auth.ts`). Cloud Run sets `X_OAUTH_CALLBACK_URL` from the `PROD_BASE_URL` GitHub variable — keep the X app callback identical. Rotate mounted runtime secrets with `bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --env-file .env.prod` (see `DEVELOPMENT.md` → *Sync production Secret Manager*).

### Branding TODOs

**Completed:**

- Phase 1: Token hygiene — badge variants, marketing-hero hex→tokens, chart bar tokens, admin hub hero alignment.
- Phase 2: Chart tokens (`--xf-chart-*`), xStrategyBuilder coming-soon card, `value-gain`/`value-loss` CSS utilities.
- Phase 3: User-facing `/xchat` — plans landing, Slack access-request notifications, chat conversation UI; shell theme picker (soft/deep dark + System) on product + Hub + xChat guest headers (`src/lib/xf-ui-theme.ts`).
- Phase 4: Persona governance — draft/published/archived status, version snapshots, publish/archive/rollback, immutable audit.
- Phase 5: Access workflow UI — status step indicator (new→triaged→pending→approved), SLA countdown, policy violation display, full state machine filter.
- Phase 6: Docs sync — persona governance routes, plan limits table, access request state machine, tool cache documented.

**Deferred — plan limits UI (connect runtime limits to branding):**

- Drive plans landing feature bullets from `getPlanLimits()` instead of static text.
- Add usage meter component to xchat UI showing prompts used / daily limit.
- Add soft-limit warning banner when `softLimitReached` is true.
- CSS tokens: `--xf-meter-fill`, `--xf-meter-bg`, `--xf-meter-warn`.

**Deferred — persona version history viewer:**

- Version timeline UI in persona editor (list of snapshots with action/actor/date).
- Visual diff between current and selected version.
- One-click rollback in the timeline.

**Deferred — atxfinance tool surface branding (when tool ships):**

- Tool-result card component with branded output formatting using `--xf-surface-700` + `--xf-chart-*` tokens.
- xChat console tool invocation visual treatment.

**Deferred — xMoney (when available):**

- Payment rails brand surface, `--xf-xmoney-*` tokens, logo lockup variant.

**Standing design rules:**

- Personas vs Collections separation — `/admin/personas` shows persona configs only (prompts, tools, collectionId links). Read-only xAI collection inventory is under **RAG collections** (`/admin/rag-files`); create/link flows stay in Personas or xAI console.
- All admin sub-pages delegate auth + session panel to the shared admin layout (`src/app/admin/layout.tsx`). Do not add duplicate `AdminSessionPanel` imports.
- No hardcoded hex in app CSS — use `--xf-*` tokens from `atx-docs/design-system/atxfinance-brand-kit.css`.
