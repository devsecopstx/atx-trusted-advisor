#!/usr/bin/env bash
# Sync Capacitor iOS with production server.url from local .env.prod (not committed).
# Resolution: CAPACITOR_SERVER_URL → PUBLIC_APP_BASE_URL → PROD_BASE_URL (HTTPS required).
#
# Usage: npm run cap:sync:ios:prod
#        bash scripts/cap-sync-ios-prod.sh [.env.prod]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_REL="${1:-.env.prod}"

if [[ -f "${ROOT}/${ENV_REL}" ]]; then
  ENV_ABS="${ROOT}/${ENV_REL}"
elif [[ -f "$ENV_REL" ]]; then
  ENV_ABS="$(cd "$(dirname "$ENV_REL")" && pwd)/$(basename "$ENV_REL")"
else
  echo "cap-sync-ios-prod: env file not found: ${ENV_REL}" >&2
  echo "Create ${ROOT}/.env.prod with CAPACITOR_SERVER_URL or PUBLIC_APP_BASE_URL or PROD_BASE_URL (HTTPS)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

strip_trailing_slash() {
  printf '%s' "$1" | sed 's:/*$::'
}

SERVER_URL=""
if [[ -n "${CAPACITOR_SERVER_URL:-}" ]]; then
  SERVER_URL="$(strip_trailing_slash "${CAPACITOR_SERVER_URL}")"
elif [[ -n "${PUBLIC_APP_BASE_URL:-}" ]]; then
  SERVER_URL="$(strip_trailing_slash "${PUBLIC_APP_BASE_URL}")"
elif [[ -n "${PROD_BASE_URL:-}" ]]; then
  SERVER_URL="$(strip_trailing_slash "${PROD_BASE_URL}")"
fi

if [[ -z "${SERVER_URL}" ]]; then
  echo "cap-sync-ios-prod: set CAPACITOR_SERVER_URL, PUBLIC_APP_BASE_URL, or PROD_BASE_URL in ${ENV_ABS}" >&2
  exit 1
fi

if [[ ! "${SERVER_URL}" =~ ^https:// ]]; then
  echo "cap-sync-ios-prod: production iOS requires HTTPS server.url (got: ${SERVER_URL})" >&2
  exit 1
fi

export CAPACITOR_SERVER_URL="${SERVER_URL}"
unset PUBLIC_APP_BASE_URL

cd "${ROOT}"
echo "cap-sync-ios-prod: syncing ios with server.url=${SERVER_URL}"
npx cap sync ios
echo "cap-sync-ios-prod: done — verify ios/App/App/capacitor.config.json before Xcode archive"
