#!/usr/bin/env bash
# Wipes the Compose Mongo volume and re-seeds admin. Guarded — destroys all local Docker Mongo data for this project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

if [ "${RESET_LOCAL_MONGO:-}" != "1" ]; then
  printf '%s\n' "Refusing to wipe local Mongo (destructive)." >&2
  printf '%s\n' "Run: RESET_LOCAL_MONGO=1 npm run mongo:reset" >&2
  exit 1
fi

bash "${ROOT}/scripts/dev/wipe-local-compose-volumes.sh"

bash "${ROOT}/scripts/dev/mongo-up.sh"

printf '%s\n' "[mongo:reset] npm run seed:admin …"
npm run seed:admin

printf '%s\n' "[mongo:reset] done. Next: npm run dev:host or npm run dev:stack"
