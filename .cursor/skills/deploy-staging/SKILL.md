---
name: deploy-staging
description: Deploy atxfinance to GCP Cloud Run staging using GitHub Actions with CI gates, health checks, and rollback notes. Use when deploying staging, validating staging releases, or troubleshooting staging deployment flow.
---

# atxfinance Deploy Staging

Prerequisite: run `sre-gcp-foundation` first when domain/LB/host rules are not already finalized.

## Goal

Safely deploy the latest `main` branch to the staging Cloud Run service and verify runtime health.

## When To Use

- User asks to deploy or verify staging
- A merge/push to `main` should be promoted to staging
- Staging health checks fail and need triage

## Inputs Required

- `GCP_PROJECT_ID`
- `GAR_LOCATION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE_STAGING`
- `CLOUD_RUN_REGION`
- `STAGING_BASE_URL`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

Also confirm:

- staging hostname routes through HTTPS LB to the staging backend
- cert for `STAGING_BASE_URL` is active
- staging `X_OAUTH_CALLBACK_URL` matches exact hostname
- staging runtime secrets include required `XAI_MANAGEMENT_API_KEY`

## Workflow

1. Validate branch is `main` and identify commit SHA.
2. Run quality gate (`npm run ci:gate`) before deploy.
3. Build and push container image to Artifact Registry.
4. Deploy image to staging Cloud Run service.
5. Run health checks against staging URL.
6. Report status, deployed image tag, and rollback command.

## Mapping Contract

Use this stable mapping:

- Host: `staging.atx.<domain>`
- LB host rule target: staging backend service
- Serverless NEG target: Cloud Run `atxfinance-core-staging`
- App callback: `https://staging.atx.<domain>/api/auth/x/callback`

## Required Safety Rules

- Never deploy staging from an unmerged feature branch unless explicitly requested.
- Never skip CI gate for automatic staging deployments.
- Never expose secrets in logs or artifacts.
- If health checks fail, mark deployment as failed and provide rollback guidance.

## Health Validation

- API health endpoint: `GET /api/health`
- Optional smoke route checks for high-value surfaces

## Output Format

- Result: `success` or `failure`
- Environment: `staging`
- Commit SHA and image tag
- Deployed service URL
- Health check results
- If failed: probable cause + immediate rollback command template
