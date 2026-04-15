#!/usr/bin/env bash
# Sync JVM → Next scheduler delegate keys from a local env file into GCP Secret Manager
# (create secret or add new version). Spring mounts them as env ATX_SCHEDULER_* (see application.yml).
#
# Usage:
#   bash scripts/ops/sync-scheduler-delegate-secrets-from-env.sh              # .env.stage
#   bash scripts/ops/sync-scheduler-delegate-secrets-from-env.sh .env.prod
#
# Required in the env file:
#   ATX_SCHEDULER_NEXT_BASE_URL  — Next public origin, no trailing slash (e.g. https://example.com)
#   ATX_SCHEDULER_INTERNAL_SECRET — same value on Next Cloud Run; min 24 chars (matches Next readSchedulerInternalSecretFromEnv)
#
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# Prereq: gcloud auth with Secret Manager create/versions.add on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"
MIN_SECRET_LEN=24

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-scheduler-delegate-secrets-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Requires: ATX_SCHEDULER_NEXT_BASE_URL, ATX_SCHEDULER_INTERNAL_SECRET (>= 24 chars),
          and GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID in that file.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "${ROOT_DIR}/${ENV_FILE}" && ! -f "${ENV_FILE}" ]]; then
  echo "sync-scheduler-delegate-secrets: file not found: ${ENV_FILE}" >&2
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
BASE_URL="${ATX_SCHEDULER_NEXT_BASE_URL:-}"
SECRET="${ATX_SCHEDULER_INTERNAL_SECRET:-}"

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-scheduler-delegate-secrets: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

BASE_URL="$(printf '%s' "$BASE_URL" | sed 's/[[:space:]]//g')"
SECRET="$(printf '%s' "$SECRET" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [[ -z "$BASE_URL" ]]; then
  echo "sync-scheduler-delegate-secrets: ATX_SCHEDULER_NEXT_BASE_URL is empty in ${ENV_ABS}" >&2
  exit 1
fi
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
  echo "sync-scheduler-delegate-secrets: ATX_SCHEDULER_NEXT_BASE_URL must start with http:// or https:// (got: ${BASE_URL:0:32}…)" >&2
  exit 1
fi
host="$(printf '%s' "$BASE_URL" | sed -E 's#^https?://([^/:]+).*$#\1#')"
if [[ "$host" != "localhost" && "$host" != "127.0.0.1" && "$host" != "::1" ]]; then
  if [[ "$BASE_URL" != https://* ]]; then
    echo "sync-scheduler-delegate-secrets: non-local ATX_SCHEDULER_NEXT_BASE_URL must use https://" >&2
    exit 1
  fi
fi
BASE_URL="$(printf '%s' "$BASE_URL" | sed 's#/*$##')"

if [[ ${#SECRET} -lt $MIN_SECRET_LEN ]]; then
  echo "sync-scheduler-delegate-secrets: ATX_SCHEDULER_INTERNAL_SECRET must be at least ${MIN_SECRET_LEN} characters (after trim)" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-scheduler-delegate-secrets: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local name="$1"
  local value="$2"
  echo "sync-scheduler-delegate-secrets: upsert secret ${name} in project=${PROJECT}"
  if gcloud secrets describe "${name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-scheduler-delegate-secrets: added new version to ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-scheduler-delegate-secrets: created ${name} (replication=automatic)"
  fi
}

echo "sync-scheduler-delegate-secrets: project=${PROJECT} env_file=${ENV_ABS}"
upsert_secret "ATX_SCHEDULER_NEXT_BASE_URL" "$BASE_URL"
upsert_secret "ATX_SCHEDULER_INTERNAL_SECRET" "$SECRET"

echo ""
echo "sync-scheduler-delegate-secrets: done"
echo "Next: bind secrets on Cloud Run (merge, does not remove other secrets):"
echo "  gcloud run services update atxfinance-backend-prod --region=us-central1 --project=${PROJECT} \\"
echo "    --update-secrets=ATX_SCHEDULER_INTERNAL_SECRET=ATX_SCHEDULER_INTERNAL_SECRET:latest,ATX_SCHEDULER_NEXT_BASE_URL=ATX_SCHEDULER_NEXT_BASE_URL:latest"
echo "Or redeploy with: bash scripts/ops/deploy-atxfinance-backend-production.sh (binds when secrets exist)."
