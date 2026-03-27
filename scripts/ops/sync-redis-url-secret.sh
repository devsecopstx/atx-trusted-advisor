#!/usr/bin/env bash
# Sync REDIS_URL from a local env file into GCP Secret Manager (create secret or add new version).
#
# Usage:
#   bash scripts/ops/sync-redis-url-secret.sh              # uses .env.stage in repo root
#   bash scripts/ops/sync-redis-url-secret.sh .env.prod
#
# Required in the env file:
#   REDIS_URL           — full Redis URL (e.g. redis:// or rediss://)
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# Prereq: gcloud auth with secretmanager admin (or versions.add + secrets.create) on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"
SECRET_NAME="${SECRET_NAME:-REDIS_URL}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-redis-url-secret.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires in that file: REDIS_URL, and GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "${ROOT_DIR}/${ENV_FILE}" && ! -f "${ENV_FILE}" ]]; then
  echo "sync-redis-url-secret: file not found: ${ENV_FILE} (tried ${ROOT_DIR}/${ENV_FILE} and ./${ENV_FILE})" >&2
  exit 1
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

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
REDIS_URL_VAL="${REDIS_URL:-}"

if [[ -z "${REDIS_URL_VAL//[[:space:]]/}" ]]; then
  echo "sync-redis-url-secret: REDIS_URL is empty or unset in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-redis-url-secret: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-redis-url-secret: gcloud not found" >&2
  exit 1
fi

echo "sync-redis-url-secret: project=${PROJECT} secret=${SECRET_NAME} env_file=${ENV_ABS}"

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  printf '%s' "${REDIS_URL_VAL}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT}" >/dev/null
  echo "sync-redis-url-secret: added new version to existing secret ${SECRET_NAME}"
else
  printf '%s' "${REDIS_URL_VAL}" | gcloud secrets create "${SECRET_NAME}" \
    --data-file=- \
    --project="${PROJECT}" \
    --replication-policy=automatic >/dev/null
  echo "sync-redis-url-secret: created secret ${SECRET_NAME} (replication=automatic)"
fi

echo "sync-redis-url-secret: done"
