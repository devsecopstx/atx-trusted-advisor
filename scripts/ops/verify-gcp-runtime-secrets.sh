#!/usr/bin/env bash
set -euo pipefail

PROJECT=""
EXPECT_NON_EMPTY="true"
REQUIRE_NON_EMPTY_SLACK_WEBHOOK="false"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/verify-gcp-runtime-secrets.sh --project <gcp-project-id> [--expect-non-empty true|false] [--require-non-empty-slack-webhook true|false]

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

if [[ -z "$PROJECT" ]]; then
  echo "Missing required arg: --project" >&2
  usage
  exit 1
fi

REQUIRED_SECRETS=(
  "MONGODB_URI_B64"
  "XAI_API_KEY"
  "XAI_MANAGEMENT_API_KEY"
  "X_OAUTH_CLIENT_ID"
  "X_OAUTH_CLIENT_SECRET"
  "AUTH_SECRET"
  "SLACK_WEBHOOK_URL"
  "ADMIN_SEED_EMAIL"
)

echo "[verify-secrets] project=$PROJECT expect_non_empty=$EXPECT_NON_EMPTY require_non_empty_slack_webhook=$REQUIRE_NON_EMPTY_SLACK_WEBHOOK"

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
