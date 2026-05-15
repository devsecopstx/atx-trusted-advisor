#!/usr/bin/env bash
# Sync Redis URL secret(s) from a local env file into GCP Secret Manager (create secret or add new version).
#
# Usage:
#   bash scripts/ops/sync-redis-url-secret.sh              # uses .env.stage in repo root
#   bash scripts/ops/sync-redis-url-secret.sh .env.prod
#
# Reads from the env file (any non-empty value is pushed to matching secret name):
#   REDIS_URL           — legacy / single URL (optional if plane URLs cover your deploy)
#   REDIS_URL_CONTROL   — control plane (rate limits, PKCE, tenant policy, …)
#   REDIS_URL_CACHE     — cache plane (quotes, snapshots, logos, …)
#
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# At least one of the three vars must be non-empty. Deploy workflows still expect a
# REDIS_URL secret for parity with verify-gcp-runtime-secrets — create/sync it unless you
# intentionally rely on plane-only binding (advanced).
#
# Prereq: gcloud auth with secretmanager admin (or versions.add + secrets.create) on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-redis-url-secret.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires: GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID in that file.

At least one of REDIS_URL, REDIS_URL_CONTROL, REDIS_URL_CACHE must be non-empty.
Each non-empty value is written to its matching Secret Manager name.
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

trim_both_ends() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

REDIS_URL_VAL="$(trim_both_ends "${REDIS_URL:-}")"
REDIS_URL_CONTROL_VAL="$(trim_both_ends "${REDIS_URL_CONTROL:-}")"
REDIS_URL_CACHE_VAL="$(trim_both_ends "${REDIS_URL_CACHE:-}")"

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-redis-url-secret: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${REDIS_URL_VAL}" && -z "${REDIS_URL_CONTROL_VAL}" && -z "${REDIS_URL_CACHE_VAL}" ]]; then
  echo "sync-redis-url-secret: set at least one of REDIS_URL, REDIS_URL_CONTROL, REDIS_URL_CACHE in ${ENV_ABS}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-redis-url-secret: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local secret_name="$1"
  local secret_value="$2"
  if [[ -z "${secret_value}" ]]; then
    return 0
  fi
  echo "sync-redis-url-secret: project=${PROJECT} secret=${secret_name} env_file=${ENV_ABS}"
  if gcloud secrets describe "${secret_name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-redis-url-secret: added new version to existing secret ${secret_name}"
  else
    printf '%s' "${secret_value}" | gcloud secrets create "${secret_name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-redis-url-secret: created secret ${secret_name} (replication=automatic)"
  fi
}

if [[ -n "${REDIS_URL_VAL}" ]]; then
  upsert_secret "REDIS_URL" "${REDIS_URL_VAL}"
else
  echo "sync-redis-url-secret: skip REDIS_URL (empty in ${ENV_ABS})"
fi

if [[ -n "${REDIS_URL_CONTROL_VAL}" ]]; then
  upsert_secret "REDIS_URL_CONTROL" "${REDIS_URL_CONTROL_VAL}"
else
  echo "sync-redis-url-secret: skip REDIS_URL_CONTROL (empty)"
fi

if [[ -n "${REDIS_URL_CACHE_VAL}" ]]; then
  upsert_secret "REDIS_URL_CACHE" "${REDIS_URL_CACHE_VAL}"
else
  echo "sync-redis-url-secret: skip REDIS_URL_CACHE (empty)"
fi

echo "sync-redis-url-secret: done"
