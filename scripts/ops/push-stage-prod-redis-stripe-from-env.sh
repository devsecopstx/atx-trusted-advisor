#!/usr/bin/env bash
# Push REDIS_URL to GCP Secret Manager and Stripe publishable vars to GitHub Environments,
# using .env.stage for staging and .env.prod for production (separate projects / keys per file).
#
# GCP:  bash scripts/ops/sync-redis-url-secret.sh — pushes REDIS_URL, REDIS_URL_CONTROL, REDIS_URL_CACHE
#       from the env file when each is non-empty (same project id in file).
# GCP:  bash scripts/ops/sync-stripe-publishable-secrets-from-env.sh (.env.stage / .env.prod) for
#       NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + STRIPE_PUBLIC_KEY in Secret Manager (required by deploy)
# GH:   gh variable set … -e staging | -e production (publishable keys — optional extra for tooling)
#
# Requires: gcloud auth, gh auth, GOOGLE_PROJECT_ID|GOOGLE_CLOUD_PROJECT|GCP_PROJECT_ID in each env file.
# Does not print secret values.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE}[0]}")/../.." && pwd)"
REPO="${GH_REPO:-$(cd "${ROOT_DIR}" && gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"
if [[ -z "${REPO}" ]]; then
  echo "push-stage-prod-redis-stripe: set GH_REPO or run from a gh-linked clone" >&2
  exit 1
fi

sync_redis_if_set() {
  local rel="$1"
  local abs="${ROOT_DIR}/${rel}"
  if [[ ! -f "${abs}" ]]; then
    echo "push-stage-prod-redis-stripe: skip REDIS — missing ${rel}"
    return 0
  fi
  # shellcheck disable=SC1090
  set -a && source "${abs}" && set +a
  local ru="${REDIS_URL:-}"
  ru="${ru//[[:space:]]/}"
  local rc="${REDIS_URL_CONTROL:-}"
  rc="${rc//[[:space:]]/}"
  local rk="${REDIS_URL_CACHE:-}"
  rk="${rk//[[:space:]]/}"
  if [[ -z "${ru}" && -z "${rc}" && -z "${rk}" ]]; then
    echo "push-stage-prod-redis-stripe: skip REDIS — REDIS_URL, REDIS_URL_CONTROL, REDIS_URL_CACHE all empty in ${rel}"
    return 0
  fi
  bash "${ROOT_DIR}/scripts/ops/sync-redis-url-secret.sh" "${rel}"
}

push_stripe_gh() {
  local rel="$1"
  local ghenv="$2"
  local abs="${ROOT_DIR}/${rel}"
  if [[ ! -f "${abs}" ]]; then
    echo "push-stage-prod-redis-stripe: skip GitHub ${ghenv} — missing ${rel}"
    return 0
  fi
  # shellcheck disable=SC1090
  set -a && source "${abs}" && set +a
  local pk="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
  pk="${pk//[[:space:]]/}"
  local sp="${STRIPE_PUBLIC_KEY:-}"
  sp="${sp//[[:space:]]/}"
  if [[ -z "${sp}" && -n "${pk}" ]]; then
    sp="${pk}"
  fi
  if [[ -n "${pk}" ]]; then
    gh variable set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY -b"${pk}" -e "${ghenv}" -R "${REPO}"
    echo "push-stage-prod-redis-stripe: GitHub variable NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set (env=${ghenv})"
  else
    echo "push-stage-prod-redis-stripe: skip NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for ${ghenv} (empty in ${rel})"
  fi
  if [[ -n "${sp}" ]]; then
    gh variable set STRIPE_PUBLIC_KEY -b"${sp}" -e "${ghenv}" -R "${REPO}"
    echo "push-stage-prod-redis-stripe: GitHub variable STRIPE_PUBLIC_KEY set (env=${ghenv})"
  else
    echo "push-stage-prod-redis-stripe: skip STRIPE_PUBLIC_KEY for ${ghenv} (empty in ${rel})"
  fi
}

echo "push-stage-prod-redis-stripe: repo=${REPO}"

sync_redis_if_set ".env.stage"
sync_redis_if_set ".env.prod"

push_stripe_gh ".env.stage" "staging"
push_stripe_gh ".env.prod" "production"

echo "push-stage-prod-redis-stripe: done (redeploy Cloud Run to pick up new GH vars / secret bindings)"
