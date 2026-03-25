#!/usr/bin/env bash
# Ensure MongoDB on localhost:27017 for dev / admin seed.
# If `mongosh` can ping with default local credentials, reuse that server (skip docker).
# Otherwise start the Compose `mongodb` service and wait until healthy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

set -a
# shellcheck disable=SC1090
[ -f "${ROOT}/.env" ] && source "${ROOT}/.env"
set +a

# Match docker-compose.yml + resolve-mongo-uri.mjs: root user is MONGO_ROOT_USERNAME (not ADMIN_X_* — those are X OAuth / allowlist).
if [ -n "${MONGO_PING_URI:-}" ]; then
  PING_URI="$MONGO_PING_URI"
elif [ "${MONGODB_NO_AUTH:-}" = "1" ] || [ "${MONGODB_NO_AUTH:-}" = "true" ]; then
  PING_URI="mongodb://127.0.0.1:27017/admin"
else
  MG_USER="${MONGO_ROOT_USERNAME:-${ADMIN_X_USERNAME:-admin}}"
  MG_PASS="${MONGO_ROOT_PASSWORD:-}"
  if [ -z "$MG_PASS" ]; then
    PING_URI="mongodb://127.0.0.1:27017/admin"
  else
    PING_URI="mongodb://${MG_USER}:${MG_PASS}@127.0.0.1:27017/admin?authSource=admin"
  fi
fi

if command -v mongosh >/dev/null 2>&1; then
  ok="$(mongosh "$PING_URI" --quiet --eval 'db.adminCommand("ping").ok' 2>/dev/null | tail -1 | tr -d '[:space:]')"
  if [ "$ok" = "1" ]; then
    printf '%s\n' "[mongo:up] using existing Mongo on 127.0.0.1:27017 (ping OK); skipping docker compose."
    exit 0
  fi
  printf '%s\n' "[mongo:up] mongosh ping failed; check MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD (or MONGODB_NO_AUTH=true, or MONGO_PING_URI). Trying docker compose …" >&2
fi

if ! docker compose --env-file .env up -d mongodb; then
  printf '%s\n' "[mongo:up] docker compose up failed (Docker running? port 27017 in use?)." >&2
  exit 1
fi

for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' atxfinance-mongodb 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    printf '%s\n' "[mongo:up] atxfinance-mongodb is healthy"
    exit 0
  fi
  sleep 1
done

printf '%s\n' "[mongo:up] timeout waiting for healthy (check: docker compose logs mongodb)" >&2
exit 1
