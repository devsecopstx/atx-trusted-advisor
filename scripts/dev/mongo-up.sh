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

MG_USER="${ADMIN_X_USERNAME:-admin}"
MG_PASS="${MONGO_ROOT_PASSWORD:-atxrocks!}"
# shellcheck disable=SC2153
PING_URI="${MONGO_PING_URI:-mongodb://${MG_USER}:${MG_PASS}@127.0.0.1:27017/admin?authSource=admin}"

if command -v mongosh >/dev/null 2>&1; then
  ok="$(mongosh "$PING_URI" --quiet --eval 'db.adminCommand("ping").ok' 2>/dev/null | tail -1 | tr -d '[:space:]')"
  if [ "$ok" = "1" ]; then
    printf '%s\n' "[mongo:up] using existing Mongo on 127.0.0.1:27017 (ping OK); skipping docker compose."
    exit 0
  fi
fi

docker compose --env-file .env up -d mongodb

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
