#!/usr/bin/env bash
# Sync STRIPE_WEBHOOK_SECRET from a local env file into GCP Secret Manager.
#
# Usage:
#   bash scripts/ops/sync-stripe-webhook-secret-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-stripe-webhook-secret-from-env.sh .env.prod
#
# Required in env file:
#   STRIPE_WEBHOOK_SECRET
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-stripe-webhook-secret-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires:
  STRIPE_WEBHOOK_SECRET
  and GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID in the env file.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

resolve_path() {
  local f="$1"
  if [[ -f "${ROOT_DIR}/${f}" ]]; then
    echo "${ROOT_DIR}/${f}"
  else
    echo "$(cd "$(dirname "${f}")" && pwd)/$(basename "${f}")"
  fi
}

ENV_ABS="$(resolve_path "${ENV_FILE}")"

if [[ ! -f "${ENV_ABS}" ]]; then
  echo "sync-stripe-webhook-secret-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
WEBHOOK="${STRIPE_WEBHOOK_SECRET:-}"

if [[ -z "${WEBHOOK//[[:space:]]/}" ]]; then
  echo "sync-stripe-webhook-secret-from-env: STRIPE_WEBHOOK_SECRET is empty in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-stripe-webhook-secret-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-stripe-webhook-secret-from-env: gcloud not found" >&2
  exit 1
fi

if gcloud secrets describe "STRIPE_WEBHOOK_SECRET" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  printf '%s' "${WEBHOOK}" | gcloud secrets versions add "STRIPE_WEBHOOK_SECRET" --data-file=- --project="${PROJECT}" >/dev/null
  echo "sync-stripe-webhook-secret-from-env: added version to STRIPE_WEBHOOK_SECRET"
else
  printf '%s' "${WEBHOOK}" | gcloud secrets create "STRIPE_WEBHOOK_SECRET" \
    --data-file=- \
    --project="${PROJECT}" \
    --replication-policy=automatic >/dev/null
  echo "sync-stripe-webhook-secret-from-env: created STRIPE_WEBHOOK_SECRET"
fi

echo "sync-stripe-webhook-secret-from-env: done (project=${PROJECT})"

