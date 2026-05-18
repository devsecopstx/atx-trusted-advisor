#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=scripts/ops/gcp-runtime-secrets.inc.sh
source "${SCRIPT_DIR}/gcp-runtime-secrets.inc.sh"

load_env_file_for_verify() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  echo "[verify-secrets] sourced $(basename "$f") for env preflight"
  return 0
}

resolve_backend_origin_for_verify() {
  if [[ -n "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
    return 0
  fi
  if [[ "$PROJECT" == *staging* ]]; then
    load_env_file_for_verify "${REPO_ROOT}/.env.stage" || true
  else
    load_env_file_for_verify "${REPO_ROOT}/.env.prod" || true
  fi
  if [[ -n "${ATXFINANCE_BACKEND_ORIGIN//[[:space:]]/}" ]]; then
    return 0
  fi
  local svc="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-}"
  local region="${CLOUD_RUN_REGION:-us-central1}"
  if [[ -z "${svc//[[:space:]]/}" ]]; then
    if [[ "$PROJECT" == *staging* ]]; then
      svc="atxfinance-backend-staging"
    else
      svc="atxfinance-backend-prod"
    fi
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    return 1
  fi
  local url
  url="$(
    gcloud run services describe "${svc}" \
      --project="${PROJECT}" \
      --region="${region}" \
      --format='value(status.url)' 2>/dev/null || true
  )"
  url="${url%/}"
  if [[ -n "${url//[[:space:]]/}" ]]; then
    ATXFINANCE_BACKEND_ORIGIN="${url}"
    echo "[verify-secrets] ATXFINANCE_BACKEND_ORIGIN from Cloud Run ${svc}: ${ATXFINANCE_BACKEND_ORIGIN}"
    return 0
  fi
  return 1
}

PROJECT=""
EXPECT_NON_EMPTY="true"
REQUIRE_NON_EMPTY_SLACK_WEBHOOK="false"
WITH_GOOGLE_OAUTH="false"
WITH_DESK_SMTP="false"
WITH_SCHEDULER_DELEGATE="false"
REQUIRE_BACKEND_ORIGIN="false"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/verify-gcp-runtime-secrets.sh [--project <gcp-project-id>] [--expect-non-empty true|false] [--require-non-empty-slack-webhook true|false] [--with-google-oauth] [--with-desk-smtp] [--with-scheduler-delegate] [--require-backend-origin]

  If --project is omitted, uses GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID (e.g. after
  'set -a && source .env.stage && set +a'). Staging default in docs: GOOGLE_PROJECT_ID=fintech-advisor-staging.

  --with-google-oauth   Also require GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Sign in with Google).
                        npm run ops:secrets:verify:staging passes this flag.
  --with-desk-smtp      Also require SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM (portfolio desk email).
  --with-scheduler-delegate
                        Also require ATX_SCHEDULER_INTERNAL_SECRET and ATX_SCHEDULER_NEXT_BASE_URL (Spring → Next delegate).
  --require-backend-origin
                        Require non-empty ATXFINANCE_BACKEND_ORIGIN in the current environment and validate format
                        (https://... for non-local hosts; no :8080 on public hosts).

Checks that required runtime secrets exist in GCP Secret Manager and (optionally)
that their latest secret versions are non-empty.
By default, SLACK_WEBHOOK_URL is allowed to be empty because deploy flow skips
Slack notifications when webhook is blank.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --expect-non-empty)
      EXPECT_NON_EMPTY="${2:-true}"
      shift 2
      ;;
    --require-non-empty-slack-webhook)
      REQUIRE_NON_EMPTY_SLACK_WEBHOOK="${2:-false}"
      shift 2
      ;;
    --with-google-oauth)
      WITH_GOOGLE_OAUTH="true"
      shift
      ;;
    --with-desk-smtp)
      WITH_DESK_SMTP="true"
      shift
      ;;
    --with-scheduler-delegate)
      WITH_SCHEDULER_DELEGATE="true"
      shift
      ;;
    --require-backend-origin)
      REQUIRE_BACKEND_ORIGIN="true"
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
  PROJECT="${GOOGLE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
fi

if [[ -z "${PROJECT//[[:space:]]/}" ]]; then
  echo "Missing project: pass --project <id> or set GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID" >&2
  usage
  exit 1
fi

REQUIRED_SECRETS=("${GCP_RUNTIME_SECRETS_REQUIRED[@]}")
if [[ "$WITH_GOOGLE_OAUTH" == "true" ]]; then
  REQUIRED_SECRETS+=("${GCP_RUNTIME_SECRETS_GOOGLE_OAUTH[@]}")
fi

echo "[verify-secrets] project=$PROJECT expect_non_empty=$EXPECT_NON_EMPTY require_non_empty_slack_webhook=$REQUIRE_NON_EMPTY_SLACK_WEBHOOK with_google_oauth=$WITH_GOOGLE_OAUTH with_desk_smtp=$WITH_DESK_SMTP with_scheduler_delegate=$WITH_SCHEDULER_DELEGATE require_backend_origin=$REQUIRE_BACKEND_ORIGIN"

if [[ "$REQUIRE_BACKEND_ORIGIN" == "true" ]]; then
  if ! resolve_backend_origin_for_verify; then
    echo "[verify-secrets] missing required env var: ATXFINANCE_BACKEND_ORIGIN" >&2
    echo "[verify-secrets] set ATXFINANCE_BACKEND_ORIGIN in .env.prod (or .env.stage), export it, or ensure Spring Cloud Run is reachable via gcloud" >&2
    exit 1
  fi
  BACKEND_ORIGIN="${ATXFINANCE_BACKEND_ORIGIN:-}"
  if [[ -z "${BACKEND_ORIGIN//[[:space:]]/}" ]]; then
    echo "[verify-secrets] missing required env var: ATXFINANCE_BACKEND_ORIGIN" >&2
    exit 1
  fi
  if [[ ! "$BACKEND_ORIGIN" =~ ^https?:// ]]; then
    echo "[verify-secrets] invalid ATXFINANCE_BACKEND_ORIGIN (must start with http:// or https://): ${BACKEND_ORIGIN}" >&2
    exit 1
  fi
  host="$(printf '%s' "$BACKEND_ORIGIN" | sed -E 's#^https?://([^/:]+).*$#\1#')"
  if [[ "$host" != "localhost" && "$host" != "127.0.0.1" && "$host" != "::1" ]]; then
    if [[ "$BACKEND_ORIGIN" != https://* ]]; then
      echo "[verify-secrets] non-local ATXFINANCE_BACKEND_ORIGIN must use https:// (got ${BACKEND_ORIGIN})" >&2
      exit 1
    fi
    if [[ "$BACKEND_ORIGIN" =~ :8080([/]|$) ]]; then
      echo "[verify-secrets] non-local ATXFINANCE_BACKEND_ORIGIN must not include :8080 (got ${BACKEND_ORIGIN})" >&2
      exit 1
    fi
  fi
  echo "[verify-secrets] backend origin set: ${BACKEND_ORIGIN}"
fi

if [[ "$WITH_DESK_SMTP" == "true" ]]; then
  REQUIRED_SECRETS+=("${GCP_RUNTIME_SECRETS_DESK_SMTP[@]}")
fi

if [[ "$WITH_SCHEDULER_DELEGATE" == "true" ]]; then
  REQUIRED_SECRETS+=("${GCP_RUNTIME_SECRETS_SCHEDULER_DELEGATE[@]}")
fi

for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! gcloud secrets describe "$secret" --project "$PROJECT" --format="value(name)" >/dev/null 2>&1; then
    echo "[verify-secrets] missing: $secret" >&2
    exit 1
  fi
  echo "[verify-secrets] exists:  $secret"
done

if [[ "$EXPECT_NON_EMPTY" == "true" ]]; then
  for secret in "${REQUIRED_SECRETS[@]}"; do
    if [[ "$secret" == "SLACK_WEBHOOK_URL" && "$REQUIRE_NON_EMPTY_SLACK_WEBHOOK" != "true" ]]; then
      echo "[verify-secrets] allow-empty-latest-version: $secret"
      continue
    fi
    value="$(
      gcloud secrets versions access latest \
        --secret="$secret" \
        --project="$PROJECT" \
        2>/dev/null || true
    )"
    if [[ -z "${value//[[:space:]]/}" ]]; then
      echo "[verify-secrets] empty-latest-version: $secret" >&2
      exit 1
    fi
    echo "[verify-secrets] non-empty-latest-version: $secret"
  done
fi

if [[ "$WITH_SCHEDULER_DELEGATE" == "true" && "$EXPECT_NON_EMPTY" == "true" ]]; then
  ssec="$(
    gcloud secrets versions access latest \
      --secret="ATX_SCHEDULER_INTERNAL_SECRET" \
      --project="$PROJECT" \
      2>/dev/null || true
  )"
  ssec="$(printf '%s' "$ssec" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ ${#ssec} -lt 24 ]]; then
    echo "[verify-secrets] ATX_SCHEDULER_INTERNAL_SECRET latest version must be at least 24 characters (matches Next delegate gate)" >&2
    exit 1
  fi
  echo "[verify-secrets] scheduler delegate internal secret length ok (>=24)"
fi

echo "[verify-secrets] ok: all required runtime secrets validated for $PROJECT"
