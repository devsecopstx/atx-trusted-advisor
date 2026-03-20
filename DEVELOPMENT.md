# atxFinance Core App Development

## Scope

Core backend and UI for atxFinance **admin operations** and **signed-in app users**:

- user access request management
- task scheduling metadata
- user broker/portfolio/account defaults
- notification defaults
- app-user surfaces: xChat, xCoach, portfolio (`/xfinance`), watchlist (`/watchlist`) with shared header (profile, logout, feedback, optional DB chip)

## Tech Stack

- Next.js App Router (`src/app/api/*`) for backend routes
- MongoDB database: `atxfinancedb`
- TypeScript + Zod validation

## Platform roles vs tenant membership (session)

Session payload (`SessionUser` in `src/lib/auth.ts`):

| Field | Name in docs | Meaning |
| --- | --- | --- |
| `roles` | **Platform roles** | `global_admin` \| `advisor` \| `operator` \| `viewer` — app-wide capability. Use `isGlobalAdmin()` / `canUserLogin()` from `src/modules/identity/authorization.ts`. Legacy session value `admin` is normalized to `global_admin` via `normalizeCoreRole()` / `normalizeCoreRoles()` (single source of truth). |
| `tenantRole` | **Tenant membership role** | `tenant_admin` \| `member` for `tenantId` — billing/tenant ops; **does not** grant `/admin`. Treat as **app-user** vs **tenant admin** at the tenant level; product plans default to **free** until billing ships. |

**Product rules**

- **Admin console** (`/admin/*`, `requireGlobalAdminSession` / `requireAdminSession`): **only** `global_admin` (after normalization). The admin layout redirects everyone else to `/xchat`.
- **App-user surfaces** (approved login): `advisor`, `operator`, `viewer` — xChat, xCoach, Portfolio (`/xfinance`), Watchlist (`/watchlist`). Shared chrome: `AppUserApprovedHeader` (`src/app/ui/app-user-approved-header.tsx`) = product links (`AppUserProductNav`) + `AppUserHeaderSession` (profile popover, logout, feedback modal, optional Mongo host/db pill per `shouldShowAppUserDbLabel()` in `src/lib/env.ts`).
- **Access requests** are **onboarding**, not a role: unapproved users have no login-allowed platform role (unless `ALLOW_ANY_X_USER_LOGIN`); after approval, admins assign a platform role (typically `viewer`).

**Feature flags** (e.g. `ALLOW_ANY_X_USER_LOGIN`) are **env-driven capabilities** — do not represent them as platform roles in Mongo.

## Required Environment Keys

Use `.env` only (do not use `.env.local` for this app).

- `MONGODB_URI_B64` (Base64-encoded MongoDB URI)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY` (required for management/KB collection operations)
- `XAI_MANAGEMENT_BASE_URL` (optional override; defaults to `https://management-api.x.ai/v1`)
- `X_OAUTH_CLIENT_ID` (raw client id from X app, not base64-encoded)
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET` (recommended for session signing)
- `ALLOW_ANY_X_USER_LOGIN` (optional feature flag; set `true` to allow any authenticated X user into `/xchat` with non-admin permissions, default disabled)
- `X_OAUTH_CALLBACK_URL` (optional; defaults to current request origin + `/api/auth/x/callback`)
- `ADMIN_SEED_EMAIL` (required for `npm run seed:admin` and OAuth seed-admin promotion; **no default** — set explicitly in `.env`)
- `ADMIN_X_USERNAMES` (optional allowlist, comma-separated)
- `SLACK_WEBHOOK_URL` (optional; Slack incoming webhook for access-request notifications and **app-user feedback** from `POST /api/feedback`)
- `APP_USER_SHOW_DB_ENDPOINT` (optional; set `true` to show the Mongo host/db chip in the app-user header when `NODE_ENV=production` — e.g. beta staging builds)

## Local Setup

1. Install dependencies:
   - `npm install`
2. Start MongoDB:
   - `docker compose up -d`
3. Configure environment:
   - `cp .env.example .env`
4. Start dev server:
   - `npm run dev`
5. Seed core admin user + default tenant:
   - `npm run seed:admin`

## Developer Prereqs (gh + local gate)

Before changing deployment settings or running release workflows, verify:

1. GitHub CLI auth:
   - `gh auth status`
2. GitHub permissions:
   - You can read/write repo variables and environment secrets.
   - You can dispatch workflows.
3. Local release gate:
   - `npm ci`
   - `npm run ci:gate && npm run build`

## Cursor Cloud Agent Setup (Atlas Mode)

Use this setup when running in Cursor Cloud with MongoDB Atlas. Do not start local MongoDB.

### Cloud Agent Rules

- Do not run `docker compose up -d` for MongoDB in cloud agents.
- Use Atlas connection only via `MONGODB_URI_B64`.
- Keep app/runtime secrets in GCP Secret Manager, not in repo.
- Use `npm ci` before validation/build commands.

### Minimum Cloud Runtime Env Keys

- `MONGODB_URI_B64`
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
- `access_request_pending`: account exists but has no login-allowed role (`global_admin`, `advisor`, `operator`, `viewer`).
- If the entered email already belongs to an approved admin account, `/api/auth/link-email` now unlinks stale X mappings and re-links to the approved user.
- For Atlas-only setups, if login/link-email email matches `ADMIN_SEED_EMAIL` (must be set in env), auth flow auto-applies seeded global-admin role and tenant membership. Local Mongo is not required.

## Validation Commands

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Smoke tests: `npm run smoke:verify`
- xAI management key-create smoke (opt-in): `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true npm run smoke:xai-key-create`
- Seed admin: `npm run seed:admin`
- Backfill legacy xchat identity fields: `npm run migrate:xchat-identity`

## Cloud Agent Config Freeze (Backoffice Core)

Use this when locking Cursor cloud-agent and deployment config before first GCP rollout.

### Freeze Checklist

- [ ] Domain model fixed: frontend `fintech-advisor.ai`, backoffice `atx.fintech-advisor.ai`
- [ ] Staging host fixed: `staging.atx.fintech-advisor.ai`
- [ ] Separate GCP projects selected (`staging` and `production`)
- [ ] Single X OAuth app configured with both callback URLs
- [ ] GitHub Environments `staging` and `production` created
- [ ] Workflow env vars set and validated in `.github/workflows/deploy-cloud-run.yml`
- [ ] GitHub environment secrets set (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`)
- [ ] Cloud Run runtime secrets provisioned (Secret Manager recommended)

### GCP Secret Manager — Required Secrets (Staging & Production)

These must exist in GCP Secret Manager for each project. The deploy workflow mounts them via `--set-secrets`.

`ADMIN_SEED_EMAIL` and `ALLOW_ANY_X_USER_LOGIN` are **not** mounted from GCP Secret Manager: the workflow passes `ADMIN_SEED_EMAIL` from the GitHub Environment secret `ADMIN_SEED_EMAIL` (see below) and sets `ALLOW_ANY_X_USER_LOGIN` from the GitHub **variable** of that name (default `false` when unset). Use **`true` only on staging** if you want any signed-in X user on `/xchat`; on **production**, leave it unset or `false` so only registered / access-approved users reach `/xchat`.

| Secret name | Purpose | Required |
| --- | --- | --- |
| `MONGODB_URI_B64` | Base64-encoded Atlas connection string | Yes |
| `XAI_API_KEY` | xAI API key for chat completions | Yes |
| `XAI_MANAGEMENT_API_KEY` | xAI management key for collection ops | Yes |
| `X_OAUTH_CLIENT_ID` | X OAuth 2.0 client ID (raw, not base64) | Yes |
| `X_OAUTH_CLIENT_SECRET` | X OAuth 2.0 client secret | Yes |
| `AUTH_SECRET` | Session signing secret (min 16 chars) | Yes |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for access-request notifications | Yes (set empty string if unused) |

Create missing secrets with:

```bash
# Example for staging project
for SECRET in MONGODB_URI_B64 XAI_API_KEY XAI_MANAGEMENT_API_KEY X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET AUTH_SECRET SLACK_WEBHOOK_URL; do
  gcloud secrets create "$SECRET" --project="<staging-project-id>" --replication-policy=automatic 2>/dev/null || true
  echo -n "<value>" | gcloud secrets versions add "$SECRET" --project="<staging-project-id>" --data-file=-
done
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

# Environment secrets
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env staging --body "$STAGING_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env staging --body "$STAGING_SA"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GH_REPO" --env production --body "$PROD_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "$GH_REPO" --env production --body "$PROD_SA"
```

### Short Ops Task (status snapshot)

Use this command to print stage/prod URLs and latest CI + deploy outcomes:

```bash
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)" && \
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)" && \
echo "latest_ci:" && gh run list --workflow "CI" --limit 1 && \
echo "latest_deploy:" && gh run list --workflow "Deploy Cloud Run" --limit 1
```

### Deploy Cloud Run: common failures

- **`Cannot update environment variable [ALLOW_ANY_X_USER_LOGIN] to string literal because it has already been set with a different type`** — The live service still maps that name to Secret Manager. The workflow passes `--remove-secrets=ALLOW_ANY_X_USER_LOGIN` before setting literals so the next revision can switch to GitHub-driven values. If you ever bound `ADMIN_SEED_EMAIL` the same way and hit the same error, remove it once with `gcloud run services update SERVICE --region REGION --remove-secrets=ADMIN_SEED_EMAIL` (or add that key to the workflow remove list for one deploy).

### GitHub Environment Secrets

Use environment-scoped secrets in GitHub:

| Secret | Staging | Production |
| --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `<staging-provider-resource-name>` | `<prod-provider-resource-name>` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `<staging-deploy-sa>@<staging-project>.iam.gserviceaccount.com` | `<prod-deploy-sa>@<prod-project>.iam.gserviceaccount.com` |
| `ADMIN_SEED_EMAIL` | Same value as local `.env` / seed admin email | Same (prod admin email) |

Set after creating environments:

```bash
GH_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh secret set ADMIN_SEED_EMAIL --repo "$GH_REPO" --env staging --body "you@example.com"
gh secret set ADMIN_SEED_EMAIL --repo "$GH_REPO" --env production --body "you@example.com"
```

### Org/Repo Migration OIDC Fix

If `Deploy Cloud Run` fails at `Authenticate to Google Cloud` with `unauthorized_client` and `attribute condition`, update both GCP providers and service account bindings to the current repo:

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
  - Required reviewers enabled (at least 1 operator).
  - Restrict admin bypass where possible.
  - Optional branch policy to limit deploy sources to `main` and release tags.

### Cloud Run Runtime Secrets (per environment)

Required:

- `MONGODB_URI_B64`
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

Optional:

- `ADMIN_SEED_EMAIL`
- `ADMIN_X_USERNAMES`

### OAuth Callback URLs (single X app)

- `https://atx.fintech-advisor.ai/api/auth/x/callback`
- `https://staging.atx.fintech-advisor.ai/api/auth/x/callback`

### GCP Environment Recreate (atx Apex)

For a full GCP recreate with `atx` instead of `core` subdomain, see [docs/gcp-env-atx-recreate.md](docs/gcp-env-atx-recreate.md). Standalone gcloud setup, no GitHub required.

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
  - deploy staging
  - run health checks
  - promote to production
- Tag (`v*`) or manual dispatch (`target=production`):
  - direct production deploy (does not depend on staging job state)
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

### App-user feedback

- `POST /api/feedback` — session required; JSON `{ "message": string (3–4000 chars), "page"?: string }`. Always returns **201** `{ "ok": true }` on success. If `SLACK_WEBHOOK_URL` is set, posts a Slack message (same webhook as access requests); if unset, logs only (see `sendSlackNotification`).

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
- `GET /api/portfolios/:portfolioId/watchlist`
- `POST /api/positions`

### RAG files

- `GET /api/rag/files` — scoped Mongo-backed file metadata (legacy / other flows)
- `POST /api/rag/files` — upload pipeline for scoped files
- Admin **RAG collections** (`/admin/rag-files`) lists xAI collections via `GET /api/personas/collections` (management API — read-only in UI)

### xChat

- `POST /api/xchat/ask` (supports atxfinance tool loop when the **resolved** persona includes the `atxfinance` tool)
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

**Default published xChat personas (operators should keep both in `published` status):**

| Persona | Audience | `nameNormalized` | Purpose |
|---|---|---|---|
| **Super-Agent** | `global_admin` | `super-agent` | Full admin tool surface (web/X/collections/atxfinance) |
| **xFinance** | All other signed-in roles | `xfinance` | FinExpert — finance & licensing-exam focus (`default-xpersonas.ts`) |

Seed creates **Super-Agent**; **xFinance** can be created manually or on first non-admin ask if absent. In staging/production, **publish both** so governance, directory (`GET /api/personas` for non-admins), and ops docs stay aligned.

**Persona resolution (`POST /api/xchat/ask`):** The active persona is chosen from the **signed-in user’s roles**, not from the client. The optional body field `personaId` is **deprecated and ignored** (kept for backward-compatible clients).

| Session roles | Persona used | `nameNormalized` key |
|---|---|---|
| Includes `global_admin` | **Super-Agent** | `super-agent` |
| Otherwise | **xFinance** (FinExpert) | `xfinance` |

- If **Super-Agent** is missing for an admin session, the route returns **503** with guidance to run `npm run seed:admin` or create the persona in Admin → Personas.
- If **xFinance** is missing for a non-admin session, it is **created on first ask** from defaults in `src/modules/xchat/default-xpersonas.ts` (`ensureDefaultXfinancePersonaExists` in `src/modules/xchat/repository.ts`).
- Success responses include `data.personaName` (human-readable persona name).

Personas may store batch-style `collections_search` tools; outbound xAI requests map those to `file_search` + `source.collection_ids` (`src/lib/xai-tools.ts`).

**Product scope:** Non-admin xChat is framed for **finance / licensing-exam** Q&A via the **xFinance** persona `systemPrompt`. There is still no separate server-side topic classifier; admin **Super-Agent** remains broader. Further tightening is persona-governance and product work (see `.cursor/skills/xdesign-review/SKILL.md` deferrals).

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

- `GET /api/personas/collections` returns `{ data: CollectionInventoryItem[] }` for admin onboarding collection selection.
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

1. `core_users` has the email from `ADMIN_SEED_EMAIL` with role `global_admin`
2. `core_tenants` has `slug: atxfinance-core` with `isDefault: true`
3. `core_tenant_memberships` has one default membership linking the admin user and default tenant
4. `xchat_personas` contains default **Super-Agent** persona with:
   - `nameNormalized: "super-agent"`
   - `systemPrompt` set to the Architect administrative prompt
   - `xaiCollection.collectionId: "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"` (Finance collection)
   - `xapi.tools`: `web_search`, `x_search`, `file_search` (Finance collection ids), and `atxfinance`
5. **xFinance** (`nameNormalized: "xfinance"`): not created by seed — the first non-admin `POST /api/xchat/ask` creates it from `default-xpersonas.ts` if absent. **Publish** this persona for non-admin xChat (FinExpert); prefer an explicit seeded or hand-crafted row in Admin → Personas so environments stay clear.
6. `portfolio_portfolios` contains one default portfolio for the seeded admin user.
7. `portfolio_accounts` contains one default account (`type: "fidelity"`) linked to that default portfolio.
8. `portfolio_watchlists` contains `DefaultWatchlist` linked to that default portfolio with `symbols: [{ symbol: "TSLA" }]`.

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
# 0) Set known Finance collection id (provided by team)
export ATXFINANCE_COLLECTION_ID="collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"

# 1) Upload file using standard key
UPLOAD_RESPONSE="$(curl -sS -X POST https://api.x.ai/v1/files \
  -H "Authorization: Bearer ${XAI_API_KEY}" \
  -F "file=@./finance-kb.md")"
echo "${UPLOAD_RESPONSE}"

# 2) Parse uploaded file id (requires jq)
FILE_ID="$(echo "${UPLOAD_RESPONSE}" | jq -r '.id')"

# 3) Attach uploaded file to collection using management key
curl -sS -X POST "https://management-api.x.ai/v1/collections/${ATXFINANCE_COLLECTION_ID}/documents/${FILE_ID}" \
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

- **Branding prompts and tags:** `branding/atxfinance-brand-prompts.md`, `branding/atxfinance-branding-tags.md`, `branding/atxfinance-color-palette.md`, `branding/atxfinance-typography.md`
- **Design system:** `design-system/atxfinance-brand-kit.md`, `design-system/atxfinance-brand-kit.css`
- **Admin console UX:** Admin surfaces follow a clean, low-noise style (console.x.ai inspired). See `design-system/atxfinance-brand-kit.md` § Admin Console Direction. UX review findings: `docs/xchat/xdesign-review-admin-console-ux.md`

## Admin Step-by-Step Validation (xChat readiness)

1. Run `npm run seed:admin`.
2. Confirm **Super-Agent** and **xFinance** are visible in admin personas and **published** (default xChat personas).
3. Confirm default portfolio/account surfaces load for the seeded admin user.
4. Open `/xchat` (or `/admin/xchat`) and run a prompt — persona is **implicit** (Super-Agent for `global_admin`, xFinance for other roles); there is no persona picker.
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
5. Open `/admin/xchat`:
   - submit a prompt and verify a response returns (Super-Agent for seeded admin).
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
