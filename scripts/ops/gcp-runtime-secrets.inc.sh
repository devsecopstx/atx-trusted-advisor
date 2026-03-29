#!/usr/bin/env bash
# shellcheck shell=bash
# Source-only: required runtime secret names in GCP Secret Manager.
# Keep in sync with:
#   - scripts/ops/verify-gcp-runtime-secrets.sh
#   - .github/workflows/deploy-cloud-run.yml (preflight loop)
#   - .github/workflows/deploy-cloud-run-production.yml (preflight loop)
# Optional secrets (export/diff when present): see gcp-runtime-secrets-optional array.

GCP_RUNTIME_SECRETS_REQUIRED=(
  "MONGODB_URI_B64"
  "XAI_API_KEY"
  "XAI_MANAGEMENT_API_KEY"
  "X_OAUTH_CLIENT_ID"
  "X_OAUTH_CLIENT_SECRET"
  "AUTH_SECRET"
  "SLACK_WEBHOOK_URL"
  "ADMIN_SEED_EMAIL"
  "REDIS_URL"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_PUBLIC_KEY"
)

# Bound to Cloud Run when the secret exists (billing). Not required for deploy preflight.
GCP_RUNTIME_SECRETS_OPTIONAL=(
  "STRIPE_SECRET_KEY"
)
