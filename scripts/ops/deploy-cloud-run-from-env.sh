#!/usr/bin/env bash
# Deploy Next.js BFF to Cloud Run from the current directory using values from .env.stage or .env.prod,
# mirroring .github/workflows/deploy-cloud-run.yml (secrets + env vars). No GitHub Actions.
#
# Prereqs: gcloud auth (user or SA) with Cloud Run Admin + Secret Manager access on the target project;
#          repo root as cwd; Node optional unless you pass --with-ci-gate.
#
# Usage:
#   bash scripts/ops/deploy-cloud-run-from-env.sh [--staging|--production] [.env-file] [options]
#
#   Default: --staging and .env.stage
#
# Options:
#   --skip-secret-preflight   Skip verify-gcp-runtime-secrets.sh (not recommended)
#   --skip-admin-seed-clear   Skip removing legacy ADMIN_SEED_EMAIL bindings
#   --with-ci-gate            Run npm run ci:gate before deploy (lint, typecheck, docs:links, test)
#   --no-health               Skip scripts/ops/health-check-with-fallback.sh
#
# Required in the env file (or already exported):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#   CLOUD_RUN_REGION
#   CLOUD_RUN_SERVICE_STAGING or CLOUD_RUN_SERVICE_PROD (by target)
#   STAGING_BASE_URL or PROD_BASE_URL (by target) — used for X_OAUTH_CALLBACK_URL; no trailing slash
#   ATXFINANCE_BACKEND_ORIGIN (backend HTTPS origin; no :8080 on public hosts)
#
# Optional (same names as GitHub vars / workflow):
#   ALLOW_ANY_X_USER_LOGIN, ENABLE_XCHAT_DEBUG, XAI_CHAT_MODEL,
#   AUTH_CALLBACK_USE_SPRING, STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_PREMIUM_MONTHLY,
#   STRIPE_PRICE_PREMIUM_PLUS_MONTHLY, STRIPE_PRICE_PREMIUM_PLUS_YEARLY (legacy fallback)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

TARGET="staging"
ENV_REL=".env.stage"
EXPLICIT_TARGET="false"
SKIP_SECRET_PREFLIGHT="false"
SKIP_ADMIN_CLEAR="false"
WITH_CI_GATE="false"
NO_HEALTH="false"

usage() {
  sed -n '1,35p' "$0" | tail -n +2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --staging)
      TARGET="staging"
      ENV_REL=".env.stage"
      EXPLICIT_TARGET="true"
      shift
      ;;
    --production)
      TARGET="production"
      ENV_REL=".env.prod"
      EXPLICIT_TARGET="true"
      shift
      ;;
    --skip-secret-preflight)
      SKIP_SECRET_PREFLIGHT="true"
      shift
      ;;
    --skip-admin-seed-clear)
      SKIP_ADMIN_CLEAR="true"
      shift
      ;;
    --with-ci-gate)
      WITH_CI_GATE="true"
      shift
      ;;
    --no-health)
      NO_HEALTH="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" == *.env* ]] || [[ -f "${ROOT_DIR}/$1" ]] || [[ -f "$1" ]]; then
        ENV_REL="$1"
        if [[ "${EXPLICIT_TARGET}" != "true" ]]; then
          case "$(basename "$1")" in
            .env.prod|.env.production)
              TARGET="production"
              ;;
            .env.stage|.env.staging)
              TARGET="staging"
              ;;
          esac
        fi
      else
        echo "Unknown arg: $1" >&2
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

resolve_env_path() {
  local f="$1"
  if [[ -f "${ROOT_DIR}/${f}" ]]; then
    echo "${ROOT_DIR}/${f}"
  elif [[ -f "$f" ]]; then
    echo "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  else
    echo ""
  fi
}

ENV_ABS="$(resolve_env_path "${ENV_REL}")"
if [[ -z "${ENV_ABS}" || ! -f "${ENV_ABS}" ]]; then
  echo "deploy-cloud-run-from-env: env file not found: ${ENV_REL}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
REGION="${CLOUD_RUN_REGION:-}"

if [[ "${TARGET}" == "production" ]]; then
  SVC="${CLOUD_RUN_SERVICE_PROD:-}"
  BASE_URL="${PROD_BASE_URL:-}"
  DEPLOY_TARGET="deploy"
else
  SVC="${CLOUD_RUN_SERVICE_STAGING:-}"
  BASE_URL="${STAGING_BASE_URL:-}"
  DEPLOY_TARGET="stage"
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "deploy-cloud-run-from-env: set GOOGLE_PROJECT_ID (or GCP_PROJECT_ID) in ${ENV_ABS}" >&2
  exit 1
fi
if [[ -z "${REGION//[[:space:]]/}" ]]; then
  echo "deploy-cloud-run-from-env: set CLOUD_RUN_REGION in ${ENV_ABS}" >&2
  exit 1
fi
if [[ -z "${SVC//[[:space:]]/}" ]]; then
  echo "deploy-cloud-run-from-env: set CLOUD_RUN_SERVICE_STAGING or CLOUD_RUN_SERVICE_PROD in ${ENV_ABS}" >&2
  exit 1
fi
if [[ "${SVC}" == *".run.app"* ]] || [[ "${SVC}" == http://* ]] || [[ "${SVC}" == https://* ]]; then
  echo "deploy-cloud-run-from-env: CLOUD_RUN_SERVICE_* must be the Cloud Run service name (e.g. xfinance-core-prod), not a *.run.app URL." >&2
  exit 1
fi
if [[ -z "${BASE_URL//[[:space:]]/}" ]]; then
  echo "deploy-cloud-run-from-env: set STAGING_BASE_URL or PROD_BASE_URL in ${ENV_ABS}" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

ALLOW_ANY_X_USER_LOGIN="${ALLOW_ANY_X_USER_LOGIN:-false}"
ENABLE_XCHAT_DEBUG="${ENABLE_XCHAT_DEBUG:-false}"
XAI_CHAT_MODEL="${XAI_CHAT_MODEL:-grok-4-1-fast-reasoning}"
ATXFINANCE_BACKEND_ORIGIN="${ATXFINANCE_BACKEND_ORIGIN:-}"
AUTH_CALLBACK_USE_SPRING="${AUTH_CALLBACK_USE_SPRING:-false}"

if [[ -z "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
  echo "deploy-cloud-run-from-env: set ATXFINANCE_BACKEND_ORIGIN in ${ENV_ABS} (required for staging/production deploy preflight)" >&2
  exit 1
fi
if [[ ! "${ATXFINANCE_BACKEND_ORIGIN}" =~ ^https?:// ]]; then
  echo "deploy-cloud-run-from-env: ATXFINANCE_BACKEND_ORIGIN must start with http:// or https:// (got ${ATXFINANCE_BACKEND_ORIGIN})" >&2
  exit 1
fi
BACKEND_HOST="$(printf '%s' "${ATXFINANCE_BACKEND_ORIGIN}" | sed -E 's#^https?://([^/:]+).*$#\1#')"
if [[ "${BACKEND_HOST}" != "localhost" && "${BACKEND_HOST}" != "127.0.0.1" && "${BACKEND_HOST}" != "::1" ]]; then
  if [[ "${ATXFINANCE_BACKEND_ORIGIN}" != https://* ]]; then
    echo "deploy-cloud-run-from-env: non-local ATXFINANCE_BACKEND_ORIGIN must use https:// (got ${ATXFINANCE_BACKEND_ORIGIN})" >&2
    exit 1
  fi
  if [[ "${ATXFINANCE_BACKEND_ORIGIN}" =~ :8080([/]|$) ]]; then
    echo "deploy-cloud-run-from-env: non-local ATXFINANCE_BACKEND_ORIGIN must not include :8080 (got ${ATXFINANCE_BACKEND_ORIGIN})" >&2
    exit 1
  fi
fi

norm_origin() { printf '%s' "$1" | sed 's:/*$::' | tr '[:upper:]' '[:lower:]'; }
if [ "$(norm_origin "${ATXFINANCE_BACKEND_ORIGIN}")" = "$(norm_origin "${BASE_URL}")" ]; then
  echo "deploy-cloud-run-from-env: ATXFINANCE_BACKEND_ORIGIN must be the Spring backend URL, not the Next public base URL (${BASE_URL})." >&2
  exit 1
fi

echo "deploy-cloud-run-from-env: target=${TARGET} project=${PROJECT} service=${SVC} region=${REGION}"
echo "deploy-cloud-run-from-env: base_url=${BASE_URL} env_file=${ENV_ABS}"

if [[ "${WITH_CI_GATE}" == "true" ]]; then
  npm run ci:gate
fi

if [[ "${SKIP_SECRET_PREFLIGHT}" != "true" ]]; then
  VERIFY_ARGS=(--project "${PROJECT}")
  if [[ "${TARGET}" == "staging" ]]; then
    VERIFY_ARGS+=(--with-google-oauth)
  fi
  bash "${ROOT_DIR}/scripts/ops/verify-gcp-runtime-secrets.sh" "${VERIFY_ARGS[@]}"
else
  echo "deploy-cloud-run-from-env: WARNING — skipping Secret Manager preflight" >&2
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "deploy-cloud-run-from-env: gcloud not found" >&2
  exit 1
fi

gcloud config set project "${PROJECT}" --quiet

gcloud run services update "${SVC}" \
  --region "${REGION}" \
  --platform managed \
  --remove-secrets=ALLOW_ANY_X_USER_LOGIN \
  --quiet 2>/dev/null || true

if [[ "${SKIP_ADMIN_CLEAR}" != "true" ]]; then
  gcloud run services update "${SVC}" --region "${REGION}" --platform managed --remove-secrets=ADMIN_SEED_EMAIL --quiet 2>/dev/null || true
  gcloud run services update "${SVC}" --region "${REGION}" --platform managed --remove-env-vars=ADMIN_SEED_EMAIL --quiet 2>/dev/null || true
fi

SECRETS="MONGODB_URI=MONGODB_URI_B64:latest,XAI_API_KEY=XAI_API_KEY:latest,XAI_MANAGEMENT_API_KEY=XAI_MANAGEMENT_API_KEY:latest,X_OAUTH_CLIENT_ID=X_OAUTH_CLIENT_ID:latest,X_OAUTH_CLIENT_SECRET=X_OAUTH_CLIENT_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest,SLACK_WEBHOOK_URL=SLACK_WEBHOOK_URL:latest,ADMIN_SEED_EMAIL=ADMIN_SEED_EMAIL:latest,REDIS_URL=REDIS_URL:latest,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:latest,STRIPE_PUBLIC_KEY=STRIPE_PUBLIC_KEY:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest"
if gcloud secrets describe GOOGLE_CLIENT_ID --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe GOOGLE_CLIENT_SECRET --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
  echo "deploy-cloud-run-from-env: binding GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
else
  echo "deploy-cloud-run-from-env: Google OAuth secrets not both present — Sign in with Google unavailable until configured"
fi
if gcloud secrets describe SMTP_HOST --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe SMTP_PORT --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe SMTP_USER --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe SMTP_PASS --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe DESK_EMAIL_FROM --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},SMTP_HOST=SMTP_HOST:latest,SMTP_PORT=SMTP_PORT:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,DESK_EMAIL_FROM=DESK_EMAIL_FROM:latest"
  echo "deploy-cloud-run-from-env: binding desk SMTP secrets (portfolio email channels)"
else
  echo "deploy-cloud-run-from-env: desk SMTP secrets not all present — portfolio email channels skipped"
fi

ENV_VARS="NODE_ENV=production,ATX_DEPLOY_TARGET=${DEPLOY_TARGET},X_OAUTH_CALLBACK_URL=${BASE_URL}/api/auth/x/callback,ALLOW_ANY_X_USER_LOGIN=${ALLOW_ANY_X_USER_LOGIN},ENABLE_XCHAT_DEBUG=${ENABLE_XCHAT_DEBUG},XAI_CHAT_MODEL=${XAI_CHAT_MODEL},AUTH_CALLBACK_USE_SPRING=${AUTH_CALLBACK_USE_SPRING}"
if [[ -n "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
  ENV_VARS="${ENV_VARS},ATXFINANCE_BACKEND_ORIGIN=${ATXFINANCE_BACKEND_ORIGIN}"
fi
for pair in \
  "STRIPE_PRICE_BASIC_MONTHLY:${STRIPE_PRICE_BASIC_MONTHLY:-}" \
  "STRIPE_PRICE_PREMIUM_MONTHLY:${STRIPE_PRICE_PREMIUM_MONTHLY:-}" \
  "STRIPE_PRICE_PREMIUM_PLUS_MONTHLY:${STRIPE_PRICE_PREMIUM_PLUS_MONTHLY:-}" \
  "STRIPE_PRICE_PREMIUM_PLUS_YEARLY:${STRIPE_PRICE_PREMIUM_PLUS_YEARLY:-}" \
  "SMTP_SECURE:${SMTP_SECURE:-}" \
  ; do
  k="${pair%%:*}"
  v="${pair#*:}"
  if [[ -n "${v//[[:space:]]/}" ]]; then
    ENV_VARS="${ENV_VARS},${k}=${v}"
  fi
done

# Single line avoids line-continuation edge cases that can split flags (e.g. "nticated: command not found").
gcloud run deploy "${SVC}" --source . --clear-base-image --region "${REGION}" --platform managed --allow-unauthenticated --set-env-vars "${ENV_VARS}" --set-secrets "${SECRETS}" --quiet

if [[ "${NO_HEALTH}" != "true" ]]; then
  bash "${ROOT_DIR}/scripts/ops/health-check-with-fallback.sh" \
    "${TARGET}" \
    "${BASE_URL}" \
    "${SVC}" \
    "${REGION}" \
    "18" \
    "15"
else
  echo "deploy-cloud-run-from-env: skipped health check (--no-health)"
fi

echo "deploy-cloud-run-from-env: done"
