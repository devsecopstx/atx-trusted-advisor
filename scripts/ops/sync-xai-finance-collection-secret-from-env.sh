#!/usr/bin/env bash
# Upsert canonical Finance xAI collection id from a local env file into GCP Secret Manager.
# Cloud Run binds XAI_FINANCE_COLLECTION_ID on deploy (see deploy-cloud-run*.yml).
#
# Usage:
#   bash scripts/ops/sync-xai-finance-collection-secret-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-xai-finance-collection-secret-from-env.sh .env.prod
#
# Required in the env file (or uses repo default when unset):
#   XAI_FINANCE_COLLECTION_ID
#
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID | GCP_PROJECT_ID_PROD
#
# Prereq: gcloud auth with Secret Manager create/versions.add on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"
DEFAULT_COLLECTION_ID="collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-xai-finance-collection-secret-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Creates or adds a version for: XAI_FINANCE_COLLECTION_ID.
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
  echo "sync-xai-finance-collection-secret-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-${GCP_PROJECT_ID_PROD:-}}}}"
COLLECTION_ID="$(printf '%s' "${XAI_FINANCE_COLLECTION_ID:-${DEFAULT_COLLECTION_ID}}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-xai-finance-collection-secret-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${COLLECTION_ID//[[:space:]]/}" ]]; then
  echo "sync-xai-finance-collection-secret-from-env: XAI_FINANCE_COLLECTION_ID is empty in ${ENV_ABS}" >&2
  exit 1
fi

if [[ ! "${COLLECTION_ID}" =~ ^collection_[0-9a-fA-F-]{36}$ ]]; then
  echo "sync-xai-finance-collection-secret-from-env: XAI_FINANCE_COLLECTION_ID must look like collection_<uuid> (got: ${COLLECTION_ID})" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-xai-finance-collection-secret-from-env: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-xai-finance-collection-secret-from-env: added version to ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-xai-finance-collection-secret-from-env: created secret ${name}"
  fi
}

echo "sync-xai-finance-collection-secret-from-env: project=${PROJECT} env_file=${ENV_ABS}"
upsert_secret "XAI_FINANCE_COLLECTION_ID" "${COLLECTION_ID}"
echo "sync-xai-finance-collection-secret-from-env: done (redeploy Cloud Run to bind secret if not already in service)"
