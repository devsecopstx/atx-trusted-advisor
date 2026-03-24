#!/usr/bin/env bash
# Removes Docker Compose named volumes for this project (e.g. atxfinance_mongo_data). Destructive.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

printf '%s\n' "[wipe-local-compose-volumes] docker compose down -v …"
docker compose --env-file .env down -v
