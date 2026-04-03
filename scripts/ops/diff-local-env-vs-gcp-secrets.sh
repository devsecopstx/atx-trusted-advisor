#!/usr/bin/env bash
# Compare a local env file (e.g. .env.prod) to latest GCP Secret Manager values.
# Does NOT print secret material — only MATCH / MISMATCH and sha256 fingerprints.
#
# Usage:
#   bash scripts/ops/diff-local-env-vs-gcp-secrets.sh --project fintech-advisor-prod --env-file .env.prod
#   bash scripts/ops/diff-local-env-vs-gcp-secrets.sh --project fintech-advisor-prod --env-file .env.prod --include-optional
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/ops/gcp-runtime-secrets.inc.sh
source "${SCRIPT_DIR}/gcp-runtime-secrets.inc.sh"

PROJECT=""
ENV_FILE=""
INCLUDE_OPTIONAL="false"
INCLUDE_DESK_SMTP="false"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/diff-local-env-vs-gcp-secrets.sh --project <gcp-project-id> --env-file <path>

  --include-optional   Also compare optional keys (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
                       when each secret exists in GCP.
  --include-desk-smtp  Also compare SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM
                       when each secret exists in GCP.

Compares keys in GCP_RUNTIME_SECRETS_REQUIRED to vars set in the env file (after sourcing).
Prints sha256 of each side when values differ (safe fingerprint; not the raw secret).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --include-optional)
      INCLUDE_OPTIONAL="true"
      shift
      ;;
    --include-desk-smtp)
      INCLUDE_DESK_SMTP="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-${GCP_PROJECT_ID_PROD:-}}}}"
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "diff-local-env-vs-gcp-secrets: pass --project or set GCP_PROJECT_ID_PROD" >&2
  exit 1
fi

if [[ -z "${ENV_FILE//[[:space:]]/}" ]]; then
  echo "diff-local-env-vs-gcp-secrets: pass --env-file .env.prod" >&2
  exit 1
fi

ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
resolve_path() {
  local f="$1"
  if [[ -f "${ROOT_DIR}/${f}" ]]; then
    echo "${ROOT_DIR}/${f}"
  elif [[ -f "$f" ]]; then
    echo "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  else
    echo ""
  fi
}

ENV_ABS="$(resolve_path "${ENV_FILE}")"
if [[ -z "${ENV_ABS}" || ! -f "${ENV_ABS}" ]]; then
  echo "diff-local-env-vs-gcp-secrets: file not found: ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "diff-local-env-vs-gcp-secrets: gcloud not found" >&2
  exit 1
fi

fingerprint() {
  printf '%s' "$1" | shasum -a 256 2>/dev/null | awk '{print $1}' || printf '%s' "$1" | sha256sum | awk '{print $1}'
}

# shellcheck disable=SC1090
set -a
source "${ENV_ABS}"
set +a

echo "[diff-env-vs-gcp] project=${PROJECT} env_file=${ENV_ABS}"
echo "[diff-env-vs-gcp] columns: secret | status | detail"
echo ""

compare_one() {
  local secret="$1"
  local local_val="${!secret:-}"
  local gcp_val=""

  if ! gcp_val="$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT" 2>/dev/null)"; then
    echo "${secret}  GCP_READ_FAILED  (missing secret or permission)"
    return
  fi

  if [[ "$local_val" == "$gcp_val" ]]; then
    echo "${secret}  MATCH"
    return
  fi

  if [[ -z "$local_val" ]]; then
    echo "${secret}  LOCAL_EMPTY_OR_UNSET  gcp_sha=$(fingerprint "$gcp_val" | cut -c1-16)…"
    return
  fi

  local a b
  a="$(fingerprint "$local_val")"
  b="$(fingerprint "$gcp_val")"
  echo "${secret}  MISMATCH  local_sha=${a:0:12}… gcp_sha=${b:0:12}…"
}

for secret in "${GCP_RUNTIME_SECRETS_REQUIRED[@]}"; do
  compare_one "$secret"
done

if [[ "$INCLUDE_OPTIONAL" == "true" ]]; then
  for secret in "${GCP_RUNTIME_SECRETS_OPTIONAL[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
      compare_one "$secret"
    else
      echo "${secret}  GCP_OPTIONAL_ABSENT  (skip)"
    fi
  done
fi

if [[ "$INCLUDE_DESK_SMTP" == "true" ]]; then
  for secret in "${GCP_RUNTIME_SECRETS_DESK_SMTP[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
      compare_one "$secret"
    else
      echo "${secret}  GCP_DESK_SMTP_ABSENT  (skip)"
    fi
  done
fi

echo ""
echo "[diff-env-vs-gcp] done (update GCP: rotate script / sync scripts; update local: edit ${ENV_FILE})"
