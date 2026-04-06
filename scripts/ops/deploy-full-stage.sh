#!/usr/bin/env bash
# Full staging deploy: Spring backend (Dockerfile.backend) → sync ATXFINANCE_BACKEND_ORIGIN in .env.stage → Next Cloud Run.
# Prereqs: same as deploy-atxfinance-backend-staging.sh + deploy-cloud-run-from-env.sh (gcloud, docker, .env.stage).
#
# Usage:
#   bash scripts/ops/deploy-full-stage.sh
#   bash scripts/ops/deploy-full-stage.sh --with-ci-gate
# Extra args are passed through to deploy-cloud-run-from-env.sh (after --staging), e.g. a custom env file path.
#
# Env overrides (match deploy-atxfinance-backend-staging.sh):
#   GCP_PROJECT_ID, CLOUD_RUN_REGION, ARTIFACT_REGISTRY_REPO, ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

upsert_env_kv() {
  local file="$1" key="$2" val="$3"
  if [[ ! -f "$file" ]]; then
    echo "deploy-full-stage: missing ${file} — create it before running" >&2
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
    printf '\n# Set by deploy-full-stage.sh\n%s\n' "${key}=${val}" >>"$tmp"
  fi
  mv "$tmp" "$file"
}

echo "==> [1/3] Deploy atxfinance-backend (staging)"
bash "${ROOT_DIR}/scripts/ops/deploy-atxfinance-backend-staging.sh"

PROJECT="${GCP_PROJECT_ID:-fintech-advisor-staging}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-atxfinance-backend-staging}"

BACKEND_URL="$(
  gcloud run services describe "${SERVICE}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --format='value(status.url)'
)"
BACKEND_URL="${BACKEND_URL%/}"

echo "==> [2/3] Set ATXFINANCE_BACKEND_ORIGIN in .env.stage → ${BACKEND_URL}"
upsert_env_kv "${ROOT_DIR}/.env.stage" "ATXFINANCE_BACKEND_ORIGIN" "${BACKEND_URL}"

echo "==> [3/3] Deploy Next.js to Cloud Run (staging)"
bash "${ROOT_DIR}/scripts/ops/deploy-cloud-run-from-env.sh" --staging "$@"

echo "deploy-full-stage: done (backend + .env.stage + Next)"
