# xFinance Core App Development

## Scope

This app is the admin-only core backend for xFinance operations:

- user access request management
- task scheduling metadata
- user broker/portfolio/account defaults
- notification defaults

## Tech Stack

- Next.js App Router (`src/app/api/*`) for backend routes
- MongoDB database: `xfinancedb`
- TypeScript + Zod validation

## Required Environment Keys

Use `.env` only (do not use `.env.local` for this app).

- `MONGODB_URI_B64` (Base64-encoded MongoDB URI)
  - legacy alias also supported: `MONGODB_URI_B4`
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY` (required for management/KB collection operations)
- `XAI_MANAGEMENT_BASE_URL` (optional override; defaults to `https://management-api.x.ai/v1`)
- `X_OAUTH_CLIENT_ID` (raw client id from X app, not base64-encoded)
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET` (recommended for session signing)
- `ALLOW_ANY_X_USER_LOGIN` (optional feature flag; set `true` to allow any authenticated X user into `/xchat` with non-admin permissions, default disabled)
- `X_OAUTH_CALLBACK_URL` (optional; defaults to current request origin + `/api/auth/x/callback`)
- `ADMIN_SEED_EMAIL` (optional, default `atxbogart@gmail.com`)
- `ADMIN_X_USERNAMES` (optional allowlist, comma-separated)
- `SLACK_WEBHOOK_URL` (optional; Slack incoming webhook for access-request notifications)

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

- [ ] Domain model fixed: frontend `fintech-advisor.ai`, backoffice `core.fintech-advisor.ai`
- [ ] Staging host fixed: `staging.core.fintech-advisor.ai`
- [ ] Separate GCP projects selected (`staging` and `production`)
- [ ] Single X OAuth app configured with both callback URLs
- [ ] GitHub Environments `staging` and `production` created
- [ ] Workflow env vars set and validated in `.github/workflows/deploy-cloud-run.yml`
- [ ] GitHub environment secrets set (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`)
- [ ] Cloud Run runtime secrets provisioned (Secret Manager recommended)

### GitHub Environment Variables

Set these with GitHub Variables (`vars.*`), either repo-scoped or environment-scoped.

| Variable | Staging | Production |
| --- | --- | --- |
| `GCP_PROJECT_ID_STAGING` | `<your-staging-project-id>` | same value (staging-only variable) |
| `GCP_PROJECT_ID_PROD` | same value (prod-only variable) | `<your-prod-project-id>` |
| `GAR_LOCATION_STAGING` | `us-central1` (recommended) | same value (staging-only variable) |
| `GAR_LOCATION_PROD` | same value (prod-only variable) | `us-central1` (recommended) |
| `GAR_REPOSITORY_STAGING` | `xfinance` (recommended) | same value (staging-only variable) |
| `GAR_REPOSITORY_PROD` | same value (prod-only variable) | `xfinance` (recommended) |
| `CLOUD_RUN_REGION` | `us-central1` (recommended) | `us-central1` (recommended) |
| `CLOUD_RUN_SERVICE_STAGING` | `xfinance-core-staging` | same value (staging-only variable) |
| `CLOUD_RUN_SERVICE_PROD` | same value (prod-only variable) | `xfinance-core-prod` |
| `STAGING_BASE_URL` | `https://staging.core.fintech-advisor.ai` | same value (staging-only variable) |
| `PROD_BASE_URL` | same value (prod-only variable) | `https://core.fintech-advisor.ai` |

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

# Repo variables used by workflow (vars.*)
gh variable set GCP_PROJECT_ID_STAGING --body "$STAGING_PROJECT_ID"
gh variable set GCP_PROJECT_ID_PROD --body "$PROD_PROJECT_ID"
gh variable set GAR_LOCATION_STAGING --body "us-central1"
gh variable set GAR_LOCATION_PROD --body "us-central1"
gh variable set GAR_REPOSITORY_STAGING --body "xfinance"
gh variable set GAR_REPOSITORY_PROD --body "xfinance"
gh variable set CLOUD_RUN_REGION --body "us-central1"
gh variable set CLOUD_RUN_SERVICE_STAGING --body "xfinance-core-staging"
gh variable set CLOUD_RUN_SERVICE_PROD --body "xfinance-core-prod"
gh variable set STAGING_BASE_URL --body "https://staging.core.fintech-advisor.ai"
gh variable set PROD_BASE_URL --body "https://core.fintech-advisor.ai"

# Environment secrets
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --env staging --body "$STAGING_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --env staging --body "$STAGING_SA"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --env production --body "$PROD_WIP"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --env production --body "$PROD_SA"
```

### GitHub Environment Secrets

Use environment-scoped secrets in GitHub:

| Secret | Staging | Production |
| --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `<staging-provider-resource-name>` | `<prod-provider-resource-name>` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `<staging-deploy-sa>@<staging-project>.iam.gserviceaccount.com` | `<prod-deploy-sa>@<prod-project>.iam.gserviceaccount.com` |

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

- `https://core.fintech-advisor.ai/api/auth/x/callback`
- `https://staging.core.fintech-advisor.ai/api/auth/x/callback`

### Immediate Rollout TODO (Raw Deploy + Route53)

Use this ordered checklist for first live rollout:

- [ ] Create runtime secrets in both GCP projects (`fintech-advisor-staging`, `fintech-advisor-prod`)
- [ ] Deploy staging raw (`gcloud run deploy ...` to `xfinance-core-staging`)
- [ ] Validate staging health (`GET https://staging.core.fintech-advisor.ai/api/health`)
- [ ] Deploy prod raw (`gcloud run deploy ...` to `xfinance-core-prod`)
- [ ] Add Route53 records for mapped domains

Route53 TODO details:

- [ ] Create/verify `core.fintech-advisor.ai` DNS record target from GCP domain mapping output
- [ ] Create/verify `staging.core.fintech-advisor.ai` DNS record target from GCP domain mapping output
- [ ] Set low TTL during cutover (for example, 60-300 seconds)
- [ ] Confirm DNS propagation with `dig` before final health checks
- [ ] Replace temporary Atlas allow-all access (`0.0.0.0/0`) with GCP static egress IP allowlist after validation
- [ ] Ensure `cloudbuild.googleapis.com` is enabled in prod before first `--source` deploy workflow run
- [ ] Create prod domain mapping (`core.fintech-advisor.ai`) after first successful prod service deploy

## API Endpoints

### Health and auth

- `GET /api/health`
- `GET /api/auth/x/login`
- `GET /api/auth/x/callback`
- `POST /api/auth/link-email` (email-first fallback link flow)
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Self-service access requests

- `POST /api/access-requests` (authenticated users request their own access; sends Slack notification if `SLACK_WEBHOOK_URL` is configured)

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

### Portfolios

- `GET /api/portfolios/default`
- `GET /api/portfolios/:portfolioId/accounts`
- `GET /api/portfolios/:portfolioId/watchlist`
- `POST /api/positions`

### RAG files

- `GET /api/rag/files`
- `POST /api/rag/files`

### xChat

- `POST /api/xchat/ask` (supports xfinance tool loop when persona has xfinance tool)
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

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

1. `core_users` has `atxbogart@gmail.com` with role `global_admin`
2. `core_tenants` has `slug: xfinance-core` with `isDefault: true`
3. `core_tenant_memberships` has one default membership linking the admin user and default tenant
4. `xchat_personas` contains default `Super-Agent` persona with:
   - `nameNormalized: "super-agent"`
   - `systemPrompt` set to the Architect administrative prompt
   - `xaiCollection.collectionId: "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"` (Finance collection)
   - `xapi.tools: [web_search, x_search, file_search]` with Finance collection wired into `file_search`
5. `portfolio_portfolios` contains one default portfolio for the seeded admin user.
6. `portfolio_accounts` contains one default account (`type: "fidelity"`) linked to that default portfolio.
7. `portfolio_watchlists` contains `DefaultWatchlist` linked to that default portfolio with `symbols: [{ symbol: "TSLA" }]`.

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
export XFINANCE_COLLECTION_ID="collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"

# 1) Upload file using standard key
UPLOAD_RESPONSE="$(curl -sS -X POST https://api.x.ai/v1/files \
  -H "Authorization: Bearer ${XAI_API_KEY}" \
  -F "file=@./finance-kb.md")"
echo "${UPLOAD_RESPONSE}"

# 2) Parse uploaded file id (requires jq)
FILE_ID="$(echo "${UPLOAD_RESPONSE}" | jq -r '.id')"

# 3) Attach uploaded file to collection using management key
curl -sS -X POST "https://management-api.x.ai/v1/collections/${XFINANCE_COLLECTION_ID}/documents/${FILE_ID}" \
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
  "name": "xfinance-smoke-<timestamp>",
  "acls": ["api-key:model:*", "api-key:endpoint:*"],
  "qps": 3,
  "qpm": 10,
  "tpm": null
}
```

## Admin Step-by-Step Validation (xChat readiness)

1. Run `npm run seed:admin`.
2. Confirm default `Super-Agent` persona is visible in admin personas.
3. Confirm default portfolio/account surfaces load for the seeded admin user.
4. Open xChat and run a non-RAG prompt with the default persona.
5. Optionally create/select an xAI collection and re-run validation with RAG enabled.

### Authenticated smoke checklist (admin session)

Use this checklist to validate "admin can start using xChat" in an authenticated browser session:

1. Start app: `npm run dev`.
2. Open `http://localhost:3000/login` and complete admin login.
3. Open `/admin/personas`:
   - verify `Super-Agent` is visible,
   - verify no-collection mode is allowed,
   - verify collection-dependent actions show clear guidance when collection is not bound.
4. Open `/dashboard` or `/holdings`:
   - verify default portfolio/account data surfaces load for seeded admin.
5. Open `/admin/xchat`:
   - submit a non-RAG prompt with default persona and verify a response returns.
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
  "email": "analyst@xfinance.ai",
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
