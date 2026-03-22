---
name: atxfinance-deploy-production
description: Deploy atxfinance to GCP Cloud Run production via GitHub Actions **Deploy Cloud Run Production** (`workflow_dispatch` only; `confirm_manual_prod=yes`) with CI gate, build, health checks, and rollback-first guidance. Use when releasing to production or auditing production deploy readiness.
---

# atxfinance Deploy Production

Prerequisite: run `atxfinance-gcp-foundation` first when domain/LB/host rules are not already finalized.

## Goal

Promote a tagged release to production Cloud Run safely and predictably.

## When To Use

- User requests a production deploy
- A new release tag matching `v*` is created
- Production release readiness or rollback planning is requested

## Inputs Required

- `GCP_PROJECT_ID`
- `GAR_LOCATION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE_PROD`
- `CLOUD_RUN_REGION`
- `PROD_BASE_URL`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

Also confirm:

- production hostname routes through HTTPS LB to the prod backend
- cert for `PROD_BASE_URL` is active
- production `X_OAUTH_CALLBACK_URL` matches exact hostname
- production runtime secrets include required `XAI_MANAGEMENT_API_KEY`

## Workflow (this repo — core app)

1. Confirm **staging** is healthy for the commit you are promoting (push to `main` or manual staging deploy).
2. In GitHub **Actions → Deploy Cloud Run Production → Run workflow**: set **`confirm_manual_prod=yes`**, optional **`deployment_notes`**.
3. The workflow runs **`npm run ci:gate`**, **`npm run build`**, deploys **`CLOUD_RUN_SERVICE_PROD`**, then production health checks (see `.github/workflows/deploy-cloud-run-production.yml`). Ensure the GitHub **`production`** environment has **Required reviewers** if you want approval before deploy steps run.
4. Report result and rollback command if checks fail.

**Tags / immutable images:** this workflow uses **`gcloud run deploy --source .`** from the selected ref; align release bookkeeping with `package.json` version and merge commit SHA.

## Mapping Contract

Use this stable mapping:

- Host: `atx.<domain>` (or apex if explicitly chosen)
- LB host rule target: production backend service
- Serverless NEG target: Cloud Run `atxfinance-core-prod`
- App callback: `https://atx.<domain>/api/auth/x/callback` (or apex callback)

## Required Safety Rules

- Do not assume **push to `main`** updates production — it does **not**; the production workflow has **no `push` trigger**. Use **Deploy Cloud Run Production** dispatch only after staging verification.
- Never skip health checks in production.
- If smoke checks fail, stop rollout and provide rollback steps immediately.

## Health Validation

- API health endpoint: `GET /api/health`
- Core app route check: `/`
- Optional critical endpoint checks

## Output Format

- Result: `success` or `failure`
- Environment: `production`
- Release tag and commit SHA
- Deployed image reference
- Service URL and health/smoke summary
- Rollback command template
