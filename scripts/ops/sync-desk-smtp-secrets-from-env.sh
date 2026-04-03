#!/usr/bin/env bash
# Upsert portfolio desk SMTP settings from a local env file into GCP Secret Manager.
# Cloud Run binds these when all five secrets exist (see deploy-cloud-run*.yml).
#
# Usage:
#   bash scripts/ops/sync-desk-smtp-secrets-from-env.sh              # default .env.stage
#   bash scripts/ops/sync-desk-smtp-secrets-from-env.sh .env.prod
#
# Required in the env file:
#   SMTP_HOST, SMTP_PORT (e.g. 587), SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM
#
# Optional:
#   SMTP_SECURE=true   (SMTPS / port 465 — also set SMTP_PORT=465 in the secret)
#
# Project id (first non-empty wins):
#   GOOGLE_PROJECT_ID | GOOGLE_CLOUD_PROJECT | GCP_PROJECT_ID
#
# Prereq: gcloud auth with Secret Manager create/versions.add on the target project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-.env.stage}"

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/sync-desk-smtp-secrets-from-env.sh [env-file]

  env-file   Path to env file (default: .env.stage). Example: .env.prod

Creates or adds versions for: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

resolve_path() {
  local f="$1"
  if [[ -f "${ROOT_DIR}/${f}" ]]; then
    echo "${ROOT_DIR}/${f}"
  else
    echo "$(cd "$(dirname "${f}")" && pwd)/$(basename "${f}")"
  fi
}

ENV_ABS="$(resolve_path "${ENV_FILE}")"

if [[ ! -f "${ENV_ABS}" ]]; then
  echo "sync-desk-smtp-secrets-from-env: file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
H="${SMTP_HOST:-}"
P="${SMTP_PORT:-}"
U="${SMTP_USER:-}"
W="${SMTP_PASS:-}"
F="${DESK_EMAIL_FROM:-}"

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "sync-desk-smtp-secrets-from-env: set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID in ${ENV_ABS}" >&2
  exit 1
fi

require_non_empty() {
  local n="$1" v="$2"
  if [[ -z "${v//[[:space:]]/}" ]]; then
    echo "sync-desk-smtp-secrets-from-env: ${n} is empty in ${ENV_ABS}" >&2
    exit 1
  fi
}

require_non_empty SMTP_HOST "$H"
require_non_empty SMTP_PORT "$P"
require_non_empty SMTP_USER "$U"
require_non_empty SMTP_PASS "$W"
require_non_empty DESK_EMAIL_FROM "$F"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "sync-desk-smtp-secrets-from-env: gcloud not found" >&2
  exit 1
fi

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "${name}" --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT}" >/dev/null
    echo "sync-desk-smtp-secrets-from-env: added version to ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --data-file=- \
      --project="${PROJECT}" \
      --replication-policy=automatic >/dev/null
    echo "sync-desk-smtp-secrets-from-env: created secret ${name}"
  fi
}

echo "sync-desk-smtp-secrets-from-env: project=${PROJECT} env_file=${ENV_ABS}"
upsert_secret "SMTP_HOST" "${H}"
upsert_secret "SMTP_PORT" "${P}"
upsert_secret "SMTP_USER" "${U}"
upsert_secret "SMTP_PASS" "${W}"
upsert_secret "DESK_EMAIL_FROM" "${F}"

if [[ -n "${SMTP_SECURE:-}" ]]; then
  echo "sync-desk-smtp-secrets-from-env: note: SMTP_SECURE is read from Cloud Run env vars (GitHub vars), not synced here — set SMTP_SECURE=true in deploy env when using port 465."
fi

echo "sync-desk-smtp-secrets-from-env: done (redeploy Cloud Run to bind secrets if not already in service)"
