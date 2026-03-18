#!/usr/bin/env bash
set -euo pipefail

# Rotate xfinance runtime secrets in GCP Secret Manager.
# Behavior:
# - If .env exists, load it.
# - If .env does not exist, use current shell environment variables.
#
# Safety:
# - Dry-run by default.
# - Use --execute to apply.
# - Secret values are never printed.
#
# Examples:
#   bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging
#   bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target both --execute
#   bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --execute --trigger-deploy --approve-production
#   bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging --keys MONGODB_URI_B64 --execute

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

TARGET="staging"
EXECUTE=false
TRIGGER_DEPLOY=false
APPROVE_PRODUCTION=false
KEYS_FILTER=""

ALL_KEYS=(
  "MONGODB_URI_B64"
  "XAI_API_KEY"
  "XAI_MANAGEMENT_API_KEY"
  "X_OAUTH_CLIENT_ID"
  "X_OAUTH_CLIENT_SECRET"
  "AUTH_SECRET"
  "SLACK_WEBHOOK_URL"
)

usage() {
  cat <<'EOF'
Usage:
  rotate-gcp-secrets-and-deploy.sh [options]

Options:
  --target <staging|production|both>   Rotation target (default: staging)
  --keys <key1,key2,...>               Rotate only these keys (default: all). Example: MONGODB_URI_B64
  --env-file <path>                    Env file to load if present (default: .env in repo root)
  --project-staging <project-id>       Override staging project
  --project-prod <project-id>          Override production project
  --execute                            Apply changes (default is dry-run)
  --trigger-deploy                     Trigger GitHub "Deploy Cloud Run" workflow after rotation
  --approve-production                 Required for production workflow dispatch
  --help                               Show help

Behavior:
  - If env file exists, it is sourced with export enabled.
  - If env file does not exist, current shell environment is used.
EOF
}

PROJECT_STAGING_OVERRIDE=""
PROJECT_PROD_OVERRIDE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --keys)
      KEYS_FILTER="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --project-staging)
      PROJECT_STAGING_OVERRIDE="${2:-}"
      shift 2
      ;;
    --project-prod)
      PROJECT_PROD_OVERRIDE="${2:-}"
      shift 2
      ;;
    --execute)
      EXECUTE=true
      shift
      ;;
    --trigger-deploy)
      TRIGGER_DEPLOY=true
      shift
      ;;
    --approve-production)
      APPROVE_PRODUCTION=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

case "${TARGET}" in
  staging|production|both) ;;
  *)
    echo "Invalid --target: ${TARGET}" >&2
    usage
    exit 2
    ;;
esac

# Resolve which keys to rotate
if [ -n "${KEYS_FILTER}" ]; then
  IFS=',' read -ra KEYS_ARRAY <<< "${KEYS_FILTER}"
  REQUIRED_KEYS=()
  for k in "${KEYS_ARRAY[@]}"; do
    k_trimmed="${k// /}"
    if [ -n "${k_trimmed}" ]; then
      REQUIRED_KEYS+=("${k_trimmed}")
    fi
  done
  if [ "${#REQUIRED_KEYS[@]}" -eq 0 ]; then
    echo "Invalid --keys: must specify at least one key" >&2
    exit 2
  fi
else
  REQUIRED_KEYS=("${ALL_KEYS[@]}")
fi

if [ -f "${ENV_FILE}" ]; then
  echo "Loading env file: ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "Env file not found at ${ENV_FILE}; using current shell environment values."
fi

PROJECT_STAGING="${PROJECT_STAGING_OVERRIDE:-${GCP_PROJECT_ID_STAGING:-fintech-advisor-staging}}"
PROJECT_PROD="${PROJECT_PROD_OVERRIDE:-${GCP_PROJECT_ID_PROD:-fintech-advisor-prod}}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_non_empty_required_keys() {
  local missing=()
  local key
  local optional_keys=("SLACK_WEBHOOK_URL")

  for key in "${REQUIRED_KEYS[@]}"; do
    if [[ " ${optional_keys[*]} " == *" ${key} "* ]]; then
      continue
    fi
    if [ -z "${!key:-}" ]; then
      missing+=("${key}")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Missing required secret values in environment: ${missing[*]}" >&2
    echo "Tip: ensure .env has these keys or export them before running." >&2
    exit 1
  fi
}

assert_secret_exists() {
  local project="$1"
  local key="$2"
  if ! gcloud secrets describe "${key}" --project "${project}" >/dev/null 2>&1; then
    echo "Secret does not exist in project ${project}: ${key}" >&2
    exit 1
  fi
}

rotate_project() {
  local project="$1"
  local label="$2"
  local key

  echo "---- ${label} (${project}) ----"
  for key in "${REQUIRED_KEYS[@]}"; do
    assert_secret_exists "${project}" "${key}"
    if [ "${EXECUTE}" = true ]; then
      printf '%s' "${!key}" | gcloud secrets versions add "${key}" --data-file=- --project "${project}" >/dev/null
      echo "rotated ${key} (new version added)"
    else
      echo "dry-run: would rotate ${key}"
    fi
  done
}

trigger_workflow_if_requested() {
  local target="$1"
  if [ "${TRIGGER_DEPLOY}" != true ]; then
    return 0
  fi

  require_command gh

  if [ "${target}" = "production" ]; then
    if [ "${APPROVE_PRODUCTION}" != true ]; then
      echo "Refusing production deploy trigger without --approve-production" >&2
      exit 1
    fi
    gh workflow run "Deploy Cloud Run" -f target=production -f approval=approve-production
    echo "Triggered Deploy Cloud Run workflow for production."
  else
    gh workflow run "Deploy Cloud Run" -f target=staging -f approval=approve-production
    echo "Triggered Deploy Cloud Run workflow for staging."
  fi
}

require_command gcloud
require_non_empty_required_keys

echo "Mode: $([ "${EXECUTE}" = true ] && echo "execute" || echo "dry-run")"
echo "Target: ${TARGET}"
echo "Keys: ${REQUIRED_KEYS[*]}"
echo "Project staging: ${PROJECT_STAGING}"
echo "Project production: ${PROJECT_PROD}"

if [ "${TARGET}" = "staging" ] || [ "${TARGET}" = "both" ]; then
  rotate_project "${PROJECT_STAGING}" "staging"
  if [ "${EXECUTE}" = true ]; then
    trigger_workflow_if_requested "staging"
  fi
fi

if [ "${TARGET}" = "production" ] || [ "${TARGET}" = "both" ]; then
  rotate_project "${PROJECT_PROD}" "production"
  if [ "${EXECUTE}" = true ]; then
    trigger_workflow_if_requested "production"
  fi
fi

echo "Done."
