---
id: xrotate-keys
name: xrotate-keys
description: atxFinance-focused key rotation with GCP Cloud Run + GitHub + provider checklist.
---

# Rotate Keys

## Goal

Perform controlled credential rotation for atxFinance with minimal downtime, clean rollback, and no secret leakage.

## Use This Skill When

- API/OAuth keys must be rotated
- There is suspected key exposure
- You are completing routine security hygiene

## atxFinance Scope

Primary runtime: GCP Cloud Run environment variables + Secret Manager.  
CI/deploy integration: GitHub Actions OIDC + secrets/variables.  
Typical providers in scope:

- xAI/X API (`XAI_API_KEY`)
- X OAuth (`X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_SECRET`)
- Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- GitHub OAuth (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
- Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PREMIUM`, optional related IDs)
- Auth secret (`AUTH_SECRET`; legacy fallback: `AUTH_SECRET_B64`)

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Quick Command Block (atxFinance)

Use these as a fast operator sequence. Replace placeholders before running.

```bash
# 1) Generate a new auth secret (if rotating AUTH_SECRET)
npx auth secret

# 2) Create/update prod secrets in Secret Manager
gcloud secrets create atxfinance-prod-x-oauth-client-id --replication-policy=automatic 2>/dev/null || true
printf '%s' "<NEW_X_OAUTH_CLIENT_ID>" | gcloud secrets versions add atxfinance-prod-x-oauth-client-id --data-file=-
gcloud secrets create atxfinance-prod-x-oauth-client-secret --replication-policy=automatic 2>/dev/null || true
printf '%s' "<NEW_X_OAUTH_CLIENT_SECRET>" | gcloud secrets versions add atxfinance-prod-x-oauth-client-secret --data-file=-

# 3) Rotate Cloud Run service to latest secrets (example env vars)
gcloud run services update atxfinance-core-prod \
  --region us-central1 \
  --update-secrets "X_OAUTH_CLIENT_ID=atxfinance-prod-x-oauth-client-id:latest,X_OAUTH_CLIENT_SECRET=atxfinance-prod-x-oauth-client-secret:latest"

# 4) Secrets scan before commit
pre-commit run gitleaks --all-files

# 5) Push rotation docs-only updates
git add .env.example CHANGELOG.secret-rotations.md atx-docs/atx-sre-ops/secret-rotation.md
git commit -m "chore(security): rotate credentials metadata (no secrets committed)"
git push

# 6) Post-rotation app verification
pnpm dev
curl -sSf "<APP_URL>/api/health/live"
```

Post-rotation checks (manual):

- Sign in with X, Google, and GitHub.
- Verify Stripe checkout + webhook flow.
- Verify Smart Grok/xAI request path.

## Workflow (Execution Order)

1. Inventory affected services, environments, and owners.
2. Generate new credentials and stage in secure config.
3. Update Secret Manager versions and Cloud Run secret bindings.
4. Update GitHub CI/deploy secrets/variables if in scope.
5. Validate auth + payment + app health flows.
6. Revoke old keys after overlap window.

## Output

- Rotation plan and status by provider
- Validation evidence (auth/webhook/health outcomes)
- Rollback posture + final revoke checklist
