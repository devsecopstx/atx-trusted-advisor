#!/usr/bin/env bash
# Local Gradle bootRun for services/atxfinance-backend (workspace / IDE tasks).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}/services/atxfinance-backend"

set -a
# shellcheck disable=SC1090
[ -f "${ROOT}/.env" ] && source "${ROOT}/.env"
if [ -z "${SPRING_DATA_MONGODB_URI:-}" ]; then
  if [ -n "${MONGODB_URI:-}" ]; then
    export SPRING_DATA_MONGODB_URI="${MONGODB_URI}"
  elif [ -n "${MONGODB_URI_B64:-}" ]; then
    export SPRING_DATA_MONGODB_URI="$(printf '%s' "${MONGODB_URI_B64}" | base64 -d)"
  fi
fi
if [ -z "${MONGODB_URI:-}" ] && [ -n "${SPRING_DATA_MONGODB_URI:-}" ]; then
  export MONGODB_URI="${SPRING_DATA_MONGODB_URI}"
fi
if [ -z "${SPRING_DATA_MONGODB_DATABASE:-}" ] && [ -n "${MONGODB_DB_NAME:-}" ]; then
  export SPRING_DATA_MONGODB_DATABASE="${MONGODB_DB_NAME}"
fi
set +a

if [ -x ./gradlew ]; then
  exec ./gradlew bootRun
fi
exec gradle bootRun
