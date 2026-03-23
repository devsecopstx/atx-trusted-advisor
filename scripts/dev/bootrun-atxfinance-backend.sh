#!/usr/bin/env bash
# Local Gradle bootRun for services/atxfinance-backend (workspace / IDE tasks).
# Spring `MongoUriEnvPostProcessor` resolves `MONGODB_URI` (plain or base64) or legacy `MONGODB_URI_B64`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}/services/atxfinance-backend"

set -a
# shellcheck disable=SC1090
[ -f "${ROOT}/.env" ] && source "${ROOT}/.env"
if [ -z "${SPRING_DATA_MONGODB_URI:-}" ] && [ -n "${MONGODB_URI:-}" ]; then
  export SPRING_DATA_MONGODB_URI="${MONGODB_URI}"
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
