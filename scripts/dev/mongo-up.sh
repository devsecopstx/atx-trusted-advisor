#!/usr/bin/env bash
# Start only the local MongoDB service and wait until the container reports healthy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

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
