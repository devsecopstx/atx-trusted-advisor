#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/ops/gcp-runtime-secrets.inc.sh
source "${SCRIPT_DIR}/gcp-runtime-secrets.inc.sh"

PROJECT=""
EXPECT_NON_EMPTY="true"
REQUIRE_NON_EMPTY_SLACK_WEBHOOK="false"
WITH_GOOGLE_OAUTH="false"
WITH_DESK_SMTP="false"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/verify-gcp-runtime-secrets.sh [--project <gcp-project-id>] [--expect-non-empty true|false] [--require-non-empty-slack-webhook true|false] [--with-google-oauth] [--with-desk-smtp]

  If --project is omitted, uses GOOGLE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID (e.g. after
  'set -a && source .env.stage && set +a'). Staging default in docs: GOOGLE_PROJECT_ID=fintech-advisor-staging.

  --with-google-oauth   Also require GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Sign in with Google).
                        npm run ops:secrets:verify:staging passes this flag.
  --with-desk-smtp      Also require SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM (portfolio desk email).

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

echo "[verify-secrets] project=$PROJECT expect_non_empty=$EXPECT_NON_EMPTY require_non_empty_slack_webhook=$REQUIRE_NON_EMPTY_SLACK_WEBHOOK with_google_oauth=$WITH_GOOGLE_OAUTH with_desk_smtp=$WITH_DESK_SMTP"

if [[ "$WITH_DESK_SMTP" == "true" ]]; then
  REQUIRED_SECRETS+=("${GCP_RUNTIME_SECRETS_DESK_SMTP[@]}")
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

echo "[verify-secrets] ok: all required runtime secrets validated for $PROJECT"
