#!/usr/bin/env bash
set -euo pipefail

# Interactive OAuth secret rotation helper for staging/production.
# KISS goals:
# - Verify CLI auth first (gh + gcloud)
# - Prompt for target env and project id
# - Rotate only OAuth keys by default
# - Optionally trigger Deploy Cloud Run workflow
#
# Notes:
# - Values are loaded from .env.prod for production, .env for staging by default.
# - Secret values are never printed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROTATE_SCRIPT="${ROOT_DIR}/scripts/ops/rotate-gcp-secrets-and-deploy.sh"

DEFAULT_STAGING_PROJECT="${GCP_PROJECT_ID_STAGING:-fintech-advisor-staging}"
DEFAULT_PROD_PROJECT="${GCP_PROJECT_ID_PROD:-fintech-advisor-prod}"
DEFAULT_STAGING_ENV_FILE="${ROOT_DIR}/.env"
DEFAULT_PROD_ENV_FILE="${ROOT_DIR}/.env.prod"

TARGET=""
ENV_FILE_STAGING=""
ENV_FILE_PROD=""
PROJECT_STAGING=""
PROJECT_PROD=""
EXECUTE=false
TRIGGER_DEPLOY=false

print_header() {
  echo ""
  echo "== atxFinance OAuth Rotation =="
  echo ""
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_gh_auth() {
  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
}

check_gcloud_auth() {
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | rg -q "."; then
    echo "gcloud has no active account. Run: gcloud auth login" >&2
    exit 1
  fi
}

prompt_target() {
  echo "Select target:"
  echo "  1) staging"
  echo "  2) production"
  echo "  3) both"
  read -r -p "Choice [1-3]: " choice
  case "${choice}" in
    1) TARGET="staging" ;;
    2) TARGET="production" ;;
    3) TARGET="both" ;;
    *)
      echo "Invalid choice" >&2
      exit 2
      ;;
  esac
}

prompt_yes_no() {
  local prompt="$1"
  local answer=""
  read -r -p "${prompt} [y/N]: " answer
  case "${answer}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

prompt_env_and_projects() {
  case "${TARGET}" in
    staging)
      read -r -p "Staging project [${DEFAULT_STAGING_PROJECT}]: " PROJECT_STAGING
      PROJECT_STAGING="${PROJECT_STAGING:-${DEFAULT_STAGING_PROJECT}}"
      read -r -p "Env file for staging values [${DEFAULT_STAGING_ENV_FILE}]: " ENV_FILE_STAGING
      ENV_FILE_STAGING="${ENV_FILE_STAGING:-${DEFAULT_STAGING_ENV_FILE}}"
      ;;
    production)
      read -r -p "Production project [${DEFAULT_PROD_PROJECT}]: " PROJECT_PROD
      PROJECT_PROD="${PROJECT_PROD:-${DEFAULT_PROD_PROJECT}}"
      read -r -p "Env file for production values [${DEFAULT_PROD_ENV_FILE}]: " ENV_FILE_PROD
      ENV_FILE_PROD="${ENV_FILE_PROD:-${DEFAULT_PROD_ENV_FILE}}"
      ;;
    both)
      read -r -p "Staging project [${DEFAULT_STAGING_PROJECT}]: " PROJECT_STAGING
      PROJECT_STAGING="${PROJECT_STAGING:-${DEFAULT_STAGING_PROJECT}}"
      read -r -p "Production project [${DEFAULT_PROD_PROJECT}]: " PROJECT_PROD
      PROJECT_PROD="${PROJECT_PROD:-${DEFAULT_PROD_PROJECT}}"
      read -r -p "Env file for staging values [${DEFAULT_STAGING_ENV_FILE}]: " ENV_FILE_STAGING
      ENV_FILE_STAGING="${ENV_FILE_STAGING:-${DEFAULT_STAGING_ENV_FILE}}"
      read -r -p "Env file for production values [${DEFAULT_PROD_ENV_FILE}]: " ENV_FILE_PROD
      ENV_FILE_PROD="${ENV_FILE_PROD:-${DEFAULT_PROD_ENV_FILE}}"
      ;;
  esac
}

ensure_env_file_exists() {
  local label="$1"
  local current_path="$2"
  while [ ! -f "${current_path}" ]; do
    echo "${label} env file not found: ${current_path}"
    read -r -p "Enter a valid ${label} env file path (or type 'cancel'): " replacement
    if [ "${replacement}" = "cancel" ]; then
      echo "Cancelled."
      exit 1
    fi
    current_path="${replacement}"
  done
  printf '%s\n' "${current_path}"
}

run_rotation() {
  local target="$1"
  local env_file="$2"
  local cmd=(
    "${ROTATE_SCRIPT}"
    --target "${target}"
    --keys "X_OAUTH_CLIENT_ID,X_OAUTH_CLIENT_SECRET"
    --env-file "${env_file}"
  )

  if [ "${target}" = "staging" ] && [ -n "${PROJECT_STAGING}" ]; then
    cmd+=(--project-staging "${PROJECT_STAGING}")
  fi
  if [ "${target}" = "production" ] && [ -n "${PROJECT_PROD}" ]; then
    cmd+=(--project-prod "${PROJECT_PROD}")
  fi
  if [ "${EXECUTE}" = true ]; then
    cmd+=(--execute)
  fi
  if [ "${TRIGGER_DEPLOY}" = true ]; then
    cmd+=(--trigger-deploy)
    if [ "${target}" = "production" ]; then
      cmd+=(--approve-production)
    fi
  fi

  bash "${cmd[@]}"
}

main() {
  print_header
  require_command gh
  require_command gcloud
  require_command rg

  if [ ! -x "${ROTATE_SCRIPT}" ]; then
    echo "Required helper not executable: ${ROTATE_SCRIPT}" >&2
    exit 1
  fi

  check_gh_auth
  check_gcloud_auth
  prompt_target
  prompt_env_and_projects

  case "${TARGET}" in
    staging)
      ENV_FILE_STAGING="$(ensure_env_file_exists "staging" "${ENV_FILE_STAGING}")"
      ;;
    production)
      ENV_FILE_PROD="$(ensure_env_file_exists "production" "${ENV_FILE_PROD}")"
      ;;
    both)
      ENV_FILE_STAGING="$(ensure_env_file_exists "staging" "${ENV_FILE_STAGING}")"
      ENV_FILE_PROD="$(ensure_env_file_exists "production" "${ENV_FILE_PROD}")"
      ;;
  esac

  if prompt_yes_no "Apply now (adds new Secret Manager versions)?"; then
    EXECUTE=true
  fi

  if [ "${EXECUTE}" = true ] && prompt_yes_no "Trigger Deploy Cloud Run workflow after rotation?"; then
    TRIGGER_DEPLOY=true
  fi

  echo ""
  echo "Summary:"
  echo "  target: ${TARGET}"
  [ -n "${ENV_FILE_STAGING}" ] && echo "  env file staging: ${ENV_FILE_STAGING}"
  [ -n "${ENV_FILE_PROD}" ] && echo "  env file production: ${ENV_FILE_PROD}"
  [ -n "${PROJECT_STAGING}" ] && echo "  project staging: ${PROJECT_STAGING}"
  [ -n "${PROJECT_PROD}" ] && echo "  project production: ${PROJECT_PROD}"
  echo "  execute: ${EXECUTE}"
  echo "  trigger deploy: ${TRIGGER_DEPLOY}"
  echo "  keys: X_OAUTH_CLIENT_ID,X_OAUTH_CLIENT_SECRET"
  echo ""

  if ! prompt_yes_no "Proceed"; then
    echo "Cancelled."
    exit 0
  fi

  case "${TARGET}" in
    staging)
      run_rotation "staging" "${ENV_FILE_STAGING}"
      ;;
    production)
      run_rotation "production" "${ENV_FILE_PROD}"
      ;;
    both)
      run_rotation "staging" "${ENV_FILE_STAGING}"
      run_rotation "production" "${ENV_FILE_PROD}"
      ;;
  esac
}

main "$@"
