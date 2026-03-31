#!/usr/bin/env bash
# Sync Sign-in-with-Google OAuth client id/secret from a local env file into GCP Secret Manager.
# Mirrors scripts/ops/sync-stripe-publishable-secrets-from-env.sh — use .env.stage / .env.prod per target.
#
# Usage:
#   bash scripts/ops/sync-google-oauth-secrets-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-google-oauth-secrets-from-env.sh .env.prod
#
# Required in the env file:
#   GOOGLE_CLIENT_ID
#   GOOGLE_CLIENT_SECRET
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# Prereq: gcloud auth with Secret Manager create/versions.add on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-google-oauth-secrets-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID.
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
  echo "sync-google-oauth-secrets-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
CID="${GOOGLE_CLIENT_ID:-}"
CSEC="${GOOGLE_CLIENT_SECRET:-}"

if [[ -z "${CID//[[:space:]]/}" ]]; then
  echo "sync-google-oauth-secrets-from-env: GOOGLE_CLIENT_ID is empty in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${CSEC//[[:space:]]/}" ]]; then
  echo "sync-google-oauth-secrets-from-env: GOOGLE_CLIENT_SECRET is empty in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-google-oauth-secrets-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-google-oauth-secrets-from-env: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-google-oauth-secrets-from-env: added version to ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-google-oauth-secrets-from-env: created secret ${name}"
  fi
}

echo "sync-google-oauth-secrets-from-env: project=${PROJECT} env_file=${ENV_ABS}"
upsert_secret "GOOGLE_CLIENT_ID" "${CID}"
upsert_secret "GOOGLE_CLIENT_SECRET" "${CSEC}"
echo "sync-google-oauth-secrets-from-env: done"
