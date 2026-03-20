# AGENTS Runbook

## Scope

Operational runbook for engineers/agents working in `atxfinance` core admin app.

## Standard Local Flow

1. `cp .env.example .env`
2. `docker compose up -d`
3. `npm install`
4. `npm run seed:admin`
5. `npm run dev`

## Validation Gates

- Lint: `npm run lint`
- Types: `npm run typecheck`
- Tests: `npm run test`
- Integration-only: `npm run test:integration` (optional; `npm run test` already includes `tests/integration/**`)
- Build: `npm run build`
- CI gate: `npm run ci:gate`
- Release gate: `npm run ci:gate && npm run build`

OpenAPI inventory is guarded by route parity + document build tests under `tests/integration/openapi-*.test.ts` (see `DEVELOPMENT.md#api-docs-validation`).

Deploy: Cloud Run runtime secrets are **GCP Secret Manager only** (verified in workflow via `gcloud secrets describe`). GitHub Environment secrets are **OIDC only** (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`). See `DEVELOPMENT.md` → *GCP Secret Manager* and *GitHub Environment Secrets*.

## Production validation (post-deploy)

After merging and deploying to production (or staging first):

1. **Health:** `GET https://<base>/api/health` → `200` with `status: ok`.
2. **Admin:** Sign in as `global_admin` → `/admin` loads; `GET /api/personas` → `200` with session cookie.
3. **App_user:** Sign in with X as a user who has platform role **`viewer`**, **`operator`**, or **`advisor`** (Admin → Access approved + role assigned). **The string `app_user` is not a role** — use those roles. Then `/xchat` loads full chat (not plans only); `POST /api/xchat/ask` → `200` (not `401`).
4. If still `401` / `access_request_pending` / guest xChat: confirm Mongo user has `roles` including one of `advisor`/`operator`/`viewer` (`canUserLogin` in `src/modules/identity/authorization.ts`). Optional dev: `ALLOW_ANY_X_USER_LOGIN=true` (not for prod unless intended).
5. See `.cursor/skills/atxfinance-deploy-production/SKILL.md` and `DEVELOPMENT.md` for deploy + rollback; run **`npm run status:deploy`** for URLs and latest workflow runs.

## Critical Env Keys

- `MONGODB_URI_B64`
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

## Quick Health Checks

- API health: `GET /api/health`
- OpenAPI inventory: `GET /api/openapi`
- Swagger UI (admin): `GET /admin/api-docs`
- Auth callback path configured in X app: `/api/auth/x/callback`
- Personas API: `GET /api/personas`
- xChat ask API: `POST /api/xchat/ask` — **published defaults:** **Super-Agent** (admin), **xFinance** (app_user); each has at least one RAG collection (ids may change over time via Admin → Personas or `ATXFINANCE_COLLECTION_ID`); body `personaId` is ignored
- App_user feedback: `POST /api/feedback` (session cookie) — optional Slack via `SLACK_WEBHOOK_URL`; UI entry: xChat / xCoach / portfolio / watchlist header **Feedback**
- **App_user 500 while admin works:** see [DEVELOPMENT.md — App_user HTTP 500](DEVELOPMENT.md#app_user-http-500); check Cloud Run logs for `[auth/x/callback]` and Mongo/provisioning errors

## Quick Ops Status Task

Stage/prod URLs and latest deploy run: **`npm run status:deploy`** (runs `scripts/ops/print-deploy-status.sh`; requires `gh`).

Full snapshot including CI:

```bash
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)" && \
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)" && \
echo "latest_ci:" && gh run list --workflow "CI" --limit 1 && \
echo "latest_deploy:" && gh run list --workflow "Deploy Cloud Run" --limit 1
```

## Guardrails

- Keep secrets only in `.env`; never commit real tokens.
- Prefer updating existing docs over creating duplicates.
- Non-blocking backlog / design TBD: `docs/PLAN.md`.
- For persona/xchat/admin-audit changes, run at least build + typecheck before PR.
- **Roles:** platform roles vs `tenantRole` — see `DEVELOPMENT.md` → *Platform roles vs tenant membership (session)*. Use `isGlobalAdmin()` / `canUserLogin()` from `@/modules/identity/authorization` (and `requireGlobalAdminSession` for admin APIs); avoid ad-hoc `roles.includes("global_admin")`.

## Cursor Cloud specific instructions

### Database: Atlas mode (no local Docker)

Cloud agents connect to MongoDB Atlas — **do NOT run `docker compose up -d`**.
The `MONGODB_URI_B64` secret is injected as an environment variable by the Cursor Cloud
runtime. Run `npm run env:cursor-cloud` to create missing `.env` and `.cursor/worktrees.json`
from injected secrets.

## Project Cursor Skills (Safe Set)

- Project-local skills are stored in `.cursor/skills/`. See `.cursor/skills/README.md` for the full index.
- TODO: refine skills naming conventions; keep current names for now.
- TODO: remove imported global Cursor skills from the repo once local skill parity is confirmed.
- Ops/review skills: `atxfinance-docs-ops`, `atxfinance-xchat-validation-checklist`, `atxfinance-runbook-navigator`, `atxfinance-design-ops`, `xdesign-review`.
- xDesign review outputs: `docs/xchat/xdesign-review-admin-console-ux.md` (and other `docs/xchat/*.md`).
- Strategy skills: 10 `atxfinance-strategy-*` skills (options strategy references).
- All skills are non-destructive — they must not deploy, rotate keys, or mutate production/staging secrets.
- Runtime xChat custom-tool execution is intentionally deferred; see `docs/xchat/atxfinance-tool-stub.md`.

### Project Cursor rules (optional)

- File-backed rules live in **`.cursor/rules/*.mdc`** (tracked; see `.gitignore` exceptions alongside `.cursor/skills/`).
- Example: **`xfinance-chat-expert.mdc`** — xChat/mobile/performance expert workflow; attaches via `globs` under `**/xchat/**`, `src/modules/xchat/**`, `docs/xchat/**`, etc.
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
| `MONGODB_URI_B64` | Base64-encoded Atlas connection string |
| `XAI_API_KEY` | xAI API key for chat completions |
| `XAI_MANAGEMENT_API_KEY` | xAI management key for collection ops |
| `X_OAUTH_CLIENT_ID` | X OAuth client ID (raw, not base64) |
| `X_OAUTH_CLIENT_SECRET` | X OAuth client secret |
| `AUTH_SECRET` | Session signing secret (min 16 chars) |
| `ALLOW_ANY_X_USER_LOGIN` | Optional feature flag (`true` enables authenticated X-user login to `/xchat`; default is disabled) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for access request notifications (optional) |

### Starting the app

```bash
npm run dev          # Next.js dev server on :3000
npm run seed:admin   # Idempotent — safe to re-run
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
2. **Feature Branding** — works on UI/design-system changes under `src/app/`, `design-system/`, and brand-related assets.
3. **Feature Core MVP** — works on API routes (`src/app/api/`), domain logic (`src/lib/`), and data layer changes.

All three share the same update script and secret requirements above.

### Gotchas

- The env schema (`src/lib/env.ts`) requires `XAI_API_KEY`, `XAI_MANAGEMENT_API_KEY`, `X_OAUTH_CLIENT_ID`, and `X_OAUTH_CLIENT_SECRET` to be non-empty strings. The app will not start without them even if you only need non-AI endpoints.
- `AUTH_SECRET` must be at least 16 characters or Zod validation fails silently at `.optional()` parse.
- The seed script uses `--env-file=.env` (Node 20+ flag), so `.env` must exist before running `npm run seed:admin`.
- Auth-protected endpoints (`/api/personas`, `/api/admin/*`, `/admin/*`) return `{"error":"Unauthorized"}` without a valid session cookie. The health endpoint is unauthenticated.
- Tests (`npm run test`) are all unit/integration tests with mocked dependencies — they do not require MongoDB or the dev server to be running.
- The xAI management key-create smoke test is opt-in via `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true` and requires real API keys.
- `*.code-workspace` files are gitignored — they are local IDE config and not used by cloud agents.
- See `DEVELOPMENT.md` for the full Cloud Agent Atlas Mode setup and OAuth host-consistency notes.
- **X OAuth (prod):** PKCE cookies must ride the same `NextResponse` as the redirect to X (`applyOAuthFlowCookiesToRedirect` in `src/lib/auth.ts`). Cloud Run sets `X_OAUTH_CALLBACK_URL` from the `PROD_BASE_URL` GitHub variable — keep the X app callback identical. Rotate mounted runtime secrets with `bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --env-file .env.prod` (see `DEVELOPMENT.md` → *Sync production Secret Manager*).

### Branding TODOs

**Completed:**
- Phase 1: Token hygiene — badge variants, marketing-hero hex→tokens, chart bar tokens, admin hub hero alignment.
- Phase 2: Chart tokens (`--xf-chart-*`), xStrategyBuilder coming-soon card, `value-gain`/`value-loss` CSS utilities.
- Phase 3: User-facing `/xchat` — plans landing, Slack access-request notifications, chat conversation UI.
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
- No hardcoded hex in app CSS — use `--xf-*` tokens from `design-system/atxfinance-brand-kit.css`.
