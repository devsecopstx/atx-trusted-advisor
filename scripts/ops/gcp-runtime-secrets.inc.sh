#!/usr/bin/env bash
# shellcheck shell=bash
# Source-only: required runtime secret names in GCP Secret Manager.
# Keep in sync with:
#   - scripts/ops/verify-gcp-runtime-secrets.sh (--with-desk-smtp, --with-scheduler-delegate)
#   - .github/workflows/deploy-cloud-run.yml (preflight loop)
#   - .github/workflows/deploy-cloud-run-production.yml (preflight loop)
# Optional secrets (export/diff with --include-optional): GCP_RUNTIME_SECRETS_OPTIONAL.

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
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
)

# Sign in with Google (`/api/auth/google/*`). Use verify-gcp-runtime-secrets.sh --with-google-oauth (staging npm script).
GCP_RUNTIME_SECRETS_GOOGLE_OAUTH=(
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
)

# Google OAuth: compared with diff-local-env --include-optional when each secret exists in GCP (prod may omit until enabled).
GCP_RUNTIME_SECRETS_OPTIONAL=(
  "XAI_FINANCE_COLLECTION_ID"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  # Optional Redis plane split (control vs cache). Falls back to REDIS_URL when unset.
  "REDIS_URL_CONTROL"
  "REDIS_URL_CACHE"
  # JVM → Next `POST /api/internal/scheduler/execute-task` (Spring Cloud Run). Sync: sync-scheduler-delegate-secrets-from-env.sh
  "ATX_SCHEDULER_INTERNAL_SECRET"
  "ATX_SCHEDULER_NEXT_BASE_URL"
)

# Kotlin scheduler delegate (optional; verify with --with-scheduler-delegate).
GCP_RUNTIME_SECRETS_SCHEDULER_DELEGATE=(
  "ATX_SCHEDULER_INTERNAL_SECRET"
  "ATX_SCHEDULER_NEXT_BASE_URL"
)

# Portfolio desk email (SMTP). Use verify-gcp-runtime-secrets.sh --with-desk-smtp after creating all five in Secret Manager.
# Sync: scripts/ops/sync-desk-smtp-secrets-from-env.sh
GCP_RUNTIME_SECRETS_DESK_SMTP=(
  "SMTP_HOST"
  "SMTP_PORT"
  "SMTP_USER"
  "SMTP_PASS"
  "DESK_EMAIL_FROM"
)
