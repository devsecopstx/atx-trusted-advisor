#!/usr/bin/env bash
# One-off: push Mongo connection from a local env file into GCP Secret Manager as MONGODB_URI_B64.
# Does not deploy Cloud Run — add a new secret version; next deploy or revision update picks it up,
# or update the service to reference latest (existing bindings use :latest).
#
# Usage:
#   bash scripts/ops/sync-mongodb-uri-secret-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-mongodb-uri-secret-from-env.sh .env.prod
#
# Required in that file:
#   MONGODB_URI or MONGODB_URI_B64  — plain mongodb* URI or base64 thereof (same rules as runtime)
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# Prereq: gcloud auth with Secret Manager create / versions.add on the target project.
#
# shellcheck shell=bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"
SECRET_NAME="${SECRET_NAME:-MONGODB_URI_B64}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-mongodb-uri-secret-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires: MONGODB_URI or MONGODB_URI_B64 (non-empty), and GOOGLE_PROJECT_ID or GCP_PROJECT_ID.

Writes: base64(plain Mongo URI) to Secret Manager secret MONGODB_URI_B64 (matches Cloud Run binding).
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
  echo "sync-mongodb-uri-secret-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
MONGO_RAW="${MONGODB_URI:-${MONGODB_URI_B64:-}}"
MONGO_RAW="${MONGO_RAW//$'\r'/}"

if [[ -z "${MONGO_RAW//[[:space:]]/}" ]]; then
  echo "sync-mongodb-uri-secret-from-env: set MONGODB_URI or MONGODB_URI_B64 in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-mongodb-uri-secret-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-mongodb-uri-secret-from-env: gcloud not found" >&2
  exit 1
fi

export MONGO_RAW
B64_PAYLOAD="$(cd "${ROOT_DIR}" && node scripts/ops/encode-mongodb-uri-secret-payload.mjs)"
unset MONGO_RAW

if [[ -z "${B64_PAYLOAD}" ]]; then
  echo "sync-mongodb-uri-secret-from-env: empty payload from encoder" >&2
  exit 1
fi

echo "sync-mongodb-uri-secret-from-env: project=${PROJECT} secret=${SECRET_NAME} env_file=${ENV_ABS}"

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  printf '%s' "${B64_PAYLOAD}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT}" >/dev/null
  echo "sync-mongodb-uri-secret-from-env: added new version to ${SECRET_NAME}"
else
  printf '%s' "${B64_PAYLOAD}" | gcloud secrets create "${SECRET_NAME}" \
    --data-file=- \
    --project="${PROJECT}" \
    --replication-policy=automatic >/dev/null
  echo "sync-mongodb-uri-secret-from-env: created secret ${SECRET_NAME} (replication=automatic)"
fi

echo "sync-mongodb-uri-secret-from-env: done — redeploy Cloud Run (or roll a new revision) so the app loads this secret version"
