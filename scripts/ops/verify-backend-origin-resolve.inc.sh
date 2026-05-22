# Shared by verify-gcp-runtime-secrets.sh and unit tests.
# Caller must set REPO_ROOT and PROJECT before resolve_backend_origin_for_verify.

load_env_file_for_verify() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  echo "[verify-secrets] sourced $(basename "$f") for env preflight"
  return 0
}

resolve_backend_origin_for_verify() {
  # Safe check under `set -u` (nounset) — use :- to provide default
  if [[ -n "${ATXFINANCE_BACKEND_ORIGIN:-}" && -n "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
    return 0
  fi
  if [[ "$PROJECT" == *staging* ]]; then
    load_env_file_for_verify "${REPO_ROOT}/.env.stage" || true
  else
    load_env_file_for_verify "${REPO_ROOT}/.env.prod" || true
  fi
  if [[ -n "${ATXFINANCE_BACKEND_ORIGIN:-}" && -n "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
    return 0
  fi
  local svc="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-}"
  local region="${CLOUD_RUN_REGION:-us-central1}"
  if [[ -z "${svc//[[:space:]]/}" ]]; then
    if [[ "$PROJECT" == *staging* ]]; then
      svc="atxfinance-backend-staging"
    else
      svc="atxfinance-backend-prod"
    fi
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    return 1
  fi
  local url
  url="$(
    gcloud run services describe "${svc}" \
      --project="${PROJECT}" \
      --region="${region}" \
      --format='value(status.url)' 2>/dev/null || true
  )"
  url="${url%/}"
  if [[ -n "${url//[[:space:]]/}" ]]; then
    ATXFINANCE_BACKEND_ORIGIN="${url}"
    echo "[verify-secrets] ATXFINANCE_BACKEND_ORIGIN from Cloud Run ${svc}: ${ATXFINANCE_BACKEND_ORIGIN}"
    return 0
  fi
  return 1
}
