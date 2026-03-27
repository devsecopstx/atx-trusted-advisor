# Deploy and Ops Guide

This is the deploy/ops entrypoint for staging and production workflows.

## Deep-dive docs

- `AGENTS.md` (post-deploy validation and operator checks)
- `atx-docs/sre-ops/secret-rotation.md` (key/secret lifecycle runbook)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth cutover/rollback considerations)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (BFF migration impact on deploy posture)

## Promotion model

- Push to `main` deploys staging.
- Production deploy is manual (`workflow_dispatch`) via Deploy Cloud Run Production.
- Health checks are required after deploy and rollback paths.

## Runtime secret model

Single source of truth for runtime app secrets is GCP Secret Manager.

To push **`REDIS_URL`** from a local file (e.g. `.env.stage` / `.env.prod` with `REDIS_URL` + `GOOGLE_PROJECT_ID` or `GCP_PROJECT_ID`):

```bash
npm run ops:secrets:sync-redis:staging
npm run ops:secrets:sync-redis:prod
# or: bash scripts/ops/sync-redis-url-secret.sh path/to.env
```

Required runtime secrets (per environment):

- `MONGODB_URI_B64` (mapped to env `MONGODB_URI`)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `SLACK_WEBHOOK_URL`
- `ADMIN_SEED_EMAIL`

Optional (Next.js Redis — see `atx-docs/sre-ops/redis-cache-next.md`):

- `REDIS_URL` — create in Secret Manager as **`REDIS_URL`**; deploy workflows bind it when present. Omit until ready; app runs without Redis.

GitHub environment secrets should remain OIDC-only:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

## Deploy preflight

Recommended checks before merge/deploy:

1. `npm run ci:gate`
2. `npm run build`
3. `npm run ops:secrets:verify:staging`
4. `npm run ops:secrets:verify:prod`

## Rollback options

- Preferred: `Rollback Cloud Run` workflow with target + revision
- Fallback: `gcloud run services update-traffic` to known good revision

Always re-run health checks after traffic shift.

## OAuth production checklist

Before production callback/login changes:

- confirm callback URL exactly matches production host
- verify OAuth secrets exist in Secret Manager for prod project
- verify Cloud Run revision mounts the expected secret refs

## Cloud agent / Atlas mode

For cloud agents:

- do not start local Docker Mongo
- use Atlas `MONGODB_URI` in environment
- run `npm ci`, then validation gates

## Operator status shortcuts

- `npm run status:deploy` for latest stage/prod summary
- `gh run list --workflow "CI" --limit 1`
- `gh run list --workflow "Deploy Cloud Run" --limit 1`
- `gh run list --workflow "Deploy Cloud Run Production" --limit 1`

For incident triage that starts as auth failures or app_user-only errors, use `atx-docs/guides/auth-and-access.md`.
