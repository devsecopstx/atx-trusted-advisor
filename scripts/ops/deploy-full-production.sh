#!/usr/bin/env bash
# Full production deploy: Spring backend (Dockerfile.backend) → sync ATXFINANCE_BACKEND_ORIGIN in .env.prod → Next Cloud Run.
# Prereqs: same as deploy-atxfinance-backend-production.sh + deploy-cloud-run-from-env.sh (gcloud, docker, .env.prod).
# Scheduler delegate: set ATX_SCHEDULER_NEXT_BASE_URL + ATX_SCHEDULER_INTERNAL_SECRET in .env.prod, then
#   npm run ops:secrets:sync-scheduler-delegate:prod
# before deploy (or secrets must already exist in GCP Secret Manager).
#
# Usage:
#   bash scripts/ops/deploy-full-production.sh
#   bash scripts/ops/deploy-full-production.sh --with-ci-gate
# Extra args are passed through to deploy-cloud-run-from-env.sh (after --production), e.g. a custom env file path.
#
# Env overrides (match deploy-atxfinance-backend-production.sh):
#   GCP_PROJECT_ID, CLOUD_RUN_REGION, ARTIFACT_REGISTRY_REPO, ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

upsert_env_kv() {
  local file="$1" key="$2" val="$3"
  if [[ ! -f "$file" ]]; then
    echo "deploy-full-production: missing ${file} — create it before running" >&2
    return 1
  fi
  local tmp found=0
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^"${key}"= ]]; then
      printf '%s\n' "${key}=${val}"
      found=1
    else
      printf '%s\n' "$line"
    fi
  done <"$file" >"$tmp"
  if [[ "$found" -eq 0 ]]; then
    printf '\n# Set by deploy-full-production.sh\n%s\n' "${key}=${val}" >>"$tmp"
  fi
  mv "$tmp" "$file"
}

echo "==> [1/3] Deploy atxfinance-backend (production)"
bash "${ROOT_DIR}/scripts/ops/deploy-atxfinance-backend-production.sh"

PROJECT="${GCP_PROJECT_ID:-fintech-advisor-prod}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-atxfinance-backend-prod}"

BACKEND_URL="$(
  gcloud run services describe "${SERVICE}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --format='value(status.url)'
)"
BACKEND_URL="${BACKEND_URL%/}"

echo "==> [2/3] Set ATXFINANCE_BACKEND_ORIGIN in .env.prod → ${BACKEND_URL}"
upsert_env_kv "${ROOT_DIR}/.env.prod" "ATXFINANCE_BACKEND_ORIGIN" "${BACKEND_URL}"

echo "==> [3/3] Deploy Next.js to Cloud Run (production)"
bash "${ROOT_DIR}/scripts/ops/deploy-cloud-run-from-env.sh" --production "$@"

echo "deploy-full-production: done (backend + .env.prod + Next)"
