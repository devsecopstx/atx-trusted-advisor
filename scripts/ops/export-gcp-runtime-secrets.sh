#!/usr/bin/env bash
# Export latest Secret Manager values for Cloud Run runtime secrets (SENSITIVE).
# Use only on a trusted machine; never commit the output.
#
# Usage:
#   bash scripts/ops/export-gcp-runtime-secrets.sh --project fintech-advisor-prod --output .env.prod.gcp-export
#   bash scripts/ops/export-gcp-runtime-secrets.sh --project fintech-advisor-prod   # stdout
#
# Optional: also export GOOGLE OAuth secrets when present (--include-optional).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/ops/gcp-runtime-secrets.inc.sh
source "${SCRIPT_DIR}/gcp-runtime-secrets.inc.sh"

PROJECT=""
OUTPUT=""
INCLUDE_OPTIONAL="false"
INCLUDE_DESK_SMTP="false"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/export-gcp-runtime-secrets.sh --project <gcp-project-id> [--output <file>] [--include-optional] [--include-desk-smtp]

  --output <file>   Write KEY=value lines (default: stdout). File is sensitive — add to .gitignore.
  --include-optional  Also export GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET when present in the project.
  --include-desk-smtp   Also export SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM when present.

Requires: gcloud auth with secretmanager.versions.access on the target project.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --include-optional)
      INCLUDE_OPTIONAL="true"
      shift
      ;;
    --include-desk-smtp)
      INCLUDE_DESK_SMTP="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-${GCP_PROJECT_ID_PROD:-}}}}"
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "export-gcp-runtime-secrets: pass --project <id> or set GOOGLE_PROJECT_ID / GCP_PROJECT_ID_PROD" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "export-gcp-runtime-secrets: gcloud not found" >&2
  exit 1
fi

emit() {
  if [[ -n "${OUTPUT}" ]]; then
    printf '%s\n' "$1" >> "${OUTPUT}.tmp"
  else
    printf '%s\n' "$1"
  fi
}

write_block() {
  local hdr="$1"
  if [[ -n "${OUTPUT}" ]]; then
    {
      echo "$hdr"
      echo "# project=${PROJECT} generated=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "# DO NOT COMMIT"
      echo ""
    } > "${OUTPUT}.tmp"
  else
    echo "$hdr" >&2
    echo "# project=${PROJECT} generated=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    echo "# DO NOT COMMIT — stdout contains secrets" >&2
    echo "" >&2
  fi

  for secret in "${GCP_RUNTIME_SECRETS_REQUIRED[@]}"; do
    if ! val="$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT" 2>/dev/null)"; then
      echo "export-gcp-runtime-secrets: failed to read ${secret}" >&2
      exit 1
    fi
    if [[ "$val" == *$'\n'* ]]; then
      echo "export-gcp-runtime-secrets: warning: ${secret} contains newlines; skipping (rotate to single line)" >&2
      continue
    fi
    line="${secret}=${val}"
    emit "$line"
  done

  if [[ "$INCLUDE_OPTIONAL" == "true" ]]; then
    for secret in "${GCP_RUNTIME_SECRETS_OPTIONAL[@]}"; do
      if ! gcloud secrets describe "$secret" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
        continue
      fi
      val="$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT" 2>/dev/null)" || continue
      if [[ "$val" == *$'\n'* ]]; then
        echo "export-gcp-runtime-secrets: warning: ${secret} contains newlines; skipping" >&2
        continue
      fi
      emit "${secret}=${val}"
    done
  fi

  if [[ "$INCLUDE_DESK_SMTP" == "true" ]]; then
    for secret in "${GCP_RUNTIME_SECRETS_DESK_SMTP[@]}"; do
      if ! gcloud secrets describe "$secret" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
        continue
      fi
      val="$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT" 2>/dev/null)" || continue
      if [[ "$val" == *$'\n'* ]]; then
        echo "export-gcp-runtime-secrets: warning: ${secret} contains newlines; skipping" >&2
        continue
      fi
      emit "${secret}=${val}"
    done
  fi

  if [[ -n "${OUTPUT}" ]]; then
    mv "${OUTPUT}.tmp" "${OUTPUT}"
    echo "export-gcp-runtime-secrets: wrote ${OUTPUT} (restrict permissions: chmod 600)" >&2
  fi
}

write_block "# GCP Secret Manager export (runtime secrets)"
