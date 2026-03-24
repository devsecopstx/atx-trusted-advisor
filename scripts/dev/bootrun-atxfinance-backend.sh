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

# Spring Boot default / SERVER_PORT from .env — free listener before bootRun (stale Gradle, Docker backend, etc.).
free_backend_listen_port() {
  local port="${1:?port required}"
  local pids
  pids=$(lsof -ti "TCP:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "${pids}" ]; then
    return 0
  fi
  echo "[bootrun-atxfinance-backend] port ${port} in use; stopping listener(s): ${pids//$'\n'/ }" >&2
  echo "${pids}" | xargs kill 2>/dev/null || true
  sleep 1
  pids=$(lsof -ti "TCP:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "[bootrun-atxfinance-backend] port ${port} still busy; SIGKILL ${pids//$'\n'/ }" >&2
    echo "${pids}" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}
free_backend_listen_port "${SERVER_PORT:-8080}"

# Optional repo-root YAML for local E2E (merged after application.yml; same keys override).
# Prefer tenant_defaults.yaml; fall back to legacy tennat_defaults.yaml filename.
TENANT_OPT=""
if [ -f "${ROOT}/tenant_defaults.yaml" ]; then
  TENANT_OPT="optional:file:${ROOT}/tenant_defaults.yaml"
elif [ -f "${ROOT}/tennat_defaults.yaml" ]; then
  TENANT_OPT="optional:file:${ROOT}/tennat_defaults.yaml"
fi
if [ -n "${TENANT_OPT}" ]; then
  if [ -n "${SPRING_CONFIG_ADDITIONAL_LOCATION:-}" ]; then
    export SPRING_CONFIG_ADDITIONAL_LOCATION="${SPRING_CONFIG_ADDITIONAL_LOCATION},${TENANT_OPT}"
  else
    export SPRING_CONFIG_ADDITIONAL_LOCATION="${TENANT_OPT}"
  fi
fi

if [ -x ./gradlew ]; then
  exec ./gradlew bootRun
fi
exec gradle bootRun
