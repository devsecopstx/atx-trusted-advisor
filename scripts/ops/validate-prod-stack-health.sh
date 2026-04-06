#!/usr/bin/env bash
# Hit Next + Spring health endpoints from .env.prod (or given env file) and print HTTP status + latency.
# Usage: bash scripts/ops/validate-prod-stack-health.sh [.env.prod]
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_REL="${1:-.env.prod}"
if [[ -f "${ROOT}/${ENV_REL}" ]]; then
  ENV_ABS="${ROOT}/${ENV_REL}"
elif [[ -f "$ENV_REL" ]]; then
  ENV_ABS="$(cd "$(dirname "$ENV_REL")" && pwd)/$(basename "$ENV_REL")"
else
  echo "validate-prod-stack-health: env file not found: ${ENV_REL}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
NEXT_SVC="${CLOUD_RUN_SERVICE_PROD:-}"
PROD_URL="${PROD_BASE_URL:-}"
BACKEND_URL="${ATXFINANCE_BACKEND_ORIGIN:-}"

if [[ -z "${PROD_URL//[[:space:]]/}" ]]; then
  echo "validate-prod-stack-health: PROD_BASE_URL missing in ${ENV_ABS}" >&2
  exit 1
fi
if [[ -z "${BACKEND_URL//[[:space:]]/}" ]]; then
  echo "validate-prod-stack-health: ATXFINANCE_BACKEND_ORIGIN missing in ${ENV_ABS}" >&2
  exit 1
fi

PROD_URL="${PROD_URL%/}"
BACKEND_URL="${BACKEND_URL%/}"

norm_origin() { printf '%s' "$1" | sed 's:/*$::' | tr '[:upper:]' '[:lower:]'; }
if [ "$(norm_origin "${BACKEND_URL}")" = "$(norm_origin "${PROD_URL}")" ]; then
  echo "validate-prod-stack-health: ATXFINANCE_BACKEND_ORIGIN must not equal PROD_BASE_URL (Spring vs Next)" >&2
  exit 1
fi

curl_health() {
  local label="$1"
  local url="$2"
  local out
  out="$(mktemp)"
  local code
  code="$(
    curl --silent --show-error --location \
      --connect-timeout 8 --max-time 25 \
      --output "${out}" --write-out "%{http_code}|%{time_total}" \
      "${url}" 2>/dev/null || printf '000|0')"
  local body
  body="$(tr -d '\n' < "${out}" | head -c 300)"
  rm -f "${out}"
  local http="${code%%|*}"
  local ttot="${code#*|}"
  printf '%s\n' "${label} url=${url}"
  printf '%s\n' "${label} http=${http} time_total_s=${ttot}"
  if [[ "${http}" == "200" ]] && [[ "${body}" == *"\"status\":\"ok\""* ]]; then
    printf '%s\n' "${label} body_ok=yes"
    return 0
  fi
  printf '%s\n' "${label} body_ok=no snippet=${body:0:120}"
  return 1
}

echo "=== Prod stack health (from ${ENV_ABS}) ==="
ok=0
curl_health "next_public" "${PROD_URL}/api/health" && ok=$((ok + 1)) || true
curl_health "spring_backend" "${BACKEND_URL}/api/health" && ok=$((ok + 1)) || true

if [[ -n "${PROJECT//[[:space:]]/}" && -n "${NEXT_SVC//[[:space:]]/}" ]] && command -v gcloud >/dev/null 2>&1; then
  echo "--- gcloud revisions (latest) ---"
  gcloud run revisions list --service="${NEXT_SVC}" --project="${PROJECT}" --region="${REGION}" --limit=1 --format='table(name,active,serviceAccount)' 2>/dev/null || true
  gcloud run revisions list --service=atxfinance-backend-prod --project="${PROJECT}" --region="${REGION}" --limit=1 --format='table(name,active,serviceAccount)' 2>/dev/null || true
fi

if [[ "${ok}" -eq 2 ]]; then
  echo "=== RESULT: both health checks passed ==="
  exit 0
fi
echo "=== RESULT: one or more checks failed (ok=${ok}/2) ===" >&2
exit 1
