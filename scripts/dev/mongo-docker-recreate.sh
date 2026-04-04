#!/usr/bin/env bash
# Wipes the Compose Mongo volume and starts a fresh mongodb with admin/localdev SCRAM.
# Use when: mongosh or Next.js returns Authentication failed against Docker Mongo.
# Host shell vars must not override password — we prefix MONGO_ROOT_* for the compose invocation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

cleanup_tmp() {
  rm -f /tmp/atx-mongo-verify.out /tmp/atx-mongo-verify.err /tmp/atx-mongo-host-verify.out /tmp/atx-mongo-host-verify.err 2>/dev/null || true
}
trap cleanup_tmp EXIT

ENV_FILE="${1:-.env}"
if [ ! -f "${ROOT}/${ENV_FILE}" ]; then
  printf '%s\n' "[mongo:docker-recreate] missing ${ENV_FILE} (pass path as first arg if not .env)" >&2
  exit 1
fi

printf '%s\n' "[mongo:docker-recreate] docker compose down -v (removes ${ROOT} Compose volumes, including Mongo data)"
docker compose --env-file "${ENV_FILE}" down -v

printf '%s\n' "[mongo:docker-recreate] up mongodb with MONGO_ROOT_USERNAME=admin MONGO_ROOT_PASSWORD=localdev (overrides shell for this command only)"
MONGO_ROOT_USERNAME=admin MONGO_ROOT_PASSWORD=localdev \
  docker compose --env-file "${ENV_FILE}" up -d mongodb

printf '%s\n' "[mongo:docker-recreate] waiting for healthy…"
for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' atxfinance-mongodb 2>/dev/null || echo missing)"
  if [ "${status}" = "healthy" ]; then
    break
  fi
  sleep 1
done
if [ "${status}" != "healthy" ]; then
  printf '%s\n' "[mongo:docker-recreate] timeout — see: docker compose --env-file ${ENV_FILE} logs mongodb" >&2
  exit 1
fi

VERIFY_URI='mongodb://admin:localdev@127.0.0.1:27017/admin?authSource=admin'

printf '%s\n' "[mongo:docker-recreate] verifying SCRAM inside container (same URI path as host will use)…"
set +e
docker exec atxfinance-mongodb mongosh "${VERIFY_URI}" --quiet --eval 'db.runCommand({ping:1}).ok' >/tmp/atx-mongo-verify.out 2>/tmp/atx-mongo-verify.err
inner_ex=$?
set -e
inner_ok="$(tr -d '[:space:]' </tmp/atx-mongo-verify.out 2>/dev/null || true)"
if [ "${inner_ex}" != 0 ] || [ "${inner_ok}" != "1" ]; then
  printf '%s\n' "[mongo:docker-recreate] in-container mongosh failed (exit=${inner_ex}, ok=${inner_ok}). stderr:" >&2
  cat /tmp/atx-mongo-verify.err >&2 || true
  docker compose --env-file "${ENV_FILE}" logs mongodb --tail 80 >&2 || true
  exit 1
fi

printf '%s\n' "[mongo:docker-recreate] verifying from host (detects another mongod on TCP 27017)…"
if command -v mongosh >/dev/null 2>&1; then
  set +e
  mongosh "${VERIFY_URI}" --quiet --eval 'db.runCommand({ping:1}).ok' >/tmp/atx-mongo-host-verify.out 2>/tmp/atx-mongo-host-verify.err
  host_ex=$?
  set -e
  host_ok="$(tr -d '[:space:]' </tmp/atx-mongo-host-verify.out 2>/dev/null || true)"
  if [ "${host_ex}" != 0 ] || [ "${host_ok}" != "1" ]; then
    printf '%s\n' "" >&2
    printf '%s\n' "[mongo:docker-recreate] HOST mongosh failed but in-container succeeded." >&2
    printf '%s\n' "  → Another process is usually listening on 127.0.0.1:27017 (e.g. Homebrew \`mongod\`)." >&2
    printf '%s\n' "  → Your shell hits that server (wrong users); Docker Mongo is unreachable on 27017." >&2
    printf '%s\n' "" >&2
    printf '%s\n' "  Fix: stop the other Mongo, e.g. \`brew services stop mongodb-community\` or Activity Monitor," >&2
    printf '%s\n' "  OR change compose host port (example: \"27018:27017\" under mongodb.ports) and use 27018 in MONGODB_URI." >&2
    printf '%s\n' "" >&2
    printf '%s\n' "  Docker publishes this container as:" >&2
    docker ps --filter name=atxfinance-mongodb --format 'table {{.Names}}\t{{.Ports}}' >&2 || true
    printf '%s\n' "  Listeners on 27017 (host):" >&2
    (lsof -nP -iTCP:27017 -sTCP:LISTEN 2>/dev/null || true) >&2
    printf '%s\n' "  Host mongosh stderr:" >&2
    cat /tmp/atx-mongo-host-verify.err >&2 || true
    exit 1
  fi
else
  printf '%s\n' "[mongo:docker-recreate] (skipping host check — \`mongosh\` not on PATH; install Mongo shell or verify URI manually)"
fi

db_name="$(grep -E '^MONGODB_DB_NAME=' "${ROOT}/${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [ -z "${db_name}" ]; then
  db_name="atxfinance"
fi

printf '%s\n' "[mongo:docker-recreate] OK (container + host 127.0.0.1:27017). Use e.g.:"
printf '%s\n' "  mongosh \"mongodb://admin:localdev@127.0.0.1:27017/admin?authSource=admin\" --eval 'db.runCommand({ping:1})'"
printf '%s\n' "  MONGODB_URI=mongodb://admin:localdev@127.0.0.1:27017/${db_name}?authSource=admin"
printf '%s\n' "Then: npm run seed:admin"
