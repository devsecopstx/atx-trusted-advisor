#!/usr/bin/env bash
# Upsert xAI team scope from a local env file into GCP Secret Manager (secret name XAI_TEAM_ID).
# Cloud Run binds it when the secret exists (see deploy-cloud-run*.yml, deploy-cloud-run-from-env.sh).
#
# Value is typically a team UUID or a literal collection_* id (see src/modules/xchat/team-xai-collection.ts).
#
# Usage:
#   bash scripts/ops/sync-xai-team-id-secret-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-xai-team-id-secret-from-env.sh .env.prod
#
# Required in the env file:
#   XAI_TEAM_ID
#
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID | GCP_PROJECT_ID_PROD
#
# Prereq: gcloud auth with Secret Manager create/versions.add on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-xai-team-id-secret-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Creates or adds a version for: XAI_TEAM_ID
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
  echo "sync-xai-team-id-secret-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-${GCP_PROJECT_ID_PROD:-}}}}"
TEAM_ID="$(printf '%s' "${XAI_TEAM_ID:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-xai-team-id-secret-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

if [[ -z "${TEAM_ID//[[:space:]]/}" ]]; then
  echo "sync-xai-team-id-secret-from-env: XAI_TEAM_ID is empty in ${ENV_ABS}" >&2
  exit 1
fi

if [[ ${#TEAM_ID} -lt 6 || ${#TEAM_ID} -gt 200 ]]; then
  echo "sync-xai-team-id-secret-from-env: XAI_TEAM_ID length must be 6–200 (got len=${#TEAM_ID})" >&2
  exit 1
fi

if [[ ! "${TEAM_ID}" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "sync-xai-team-id-secret-from-env: XAI_TEAM_ID must be alphanumeric plus ._- only (no spaces)" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-xai-team-id-secret-from-env: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-xai-team-id-secret-from-env: added version to ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-xai-team-id-secret-from-env: created secret ${name}"
  fi
}

echo "sync-xai-team-id-secret-from-env: project=${PROJECT} env_file=${ENV_ABS}"
upsert_secret "XAI_TEAM_ID" "${TEAM_ID}"
echo "sync-xai-team-id-secret-from-env: done (redeploy Cloud Run to bind secret if not already in service)"
