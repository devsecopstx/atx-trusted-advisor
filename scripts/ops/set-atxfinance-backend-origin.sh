#!/usr/bin/env bash
# Enable or update Next.js BFF proxy to Kotlin (ATXFINANCE_BACKEND_ORIGIN) on Cloud Run.
# Prerequisite: atxfinance-backend HTTP is deployed and reachable (same session cookie / Mongo as Next).
#
# Usage:
#   export GCP_PROJECT_ID=fintech-advisor-staging   # optional; defaults below
#   ./scripts/ops/set-atxfinance-backend-origin.sh staging https://your-backend-xxxx.run.app
#
# Rollback (Next Mongo fallbacks for proxied routes):
#   gcloud run services update SERVICE --region REGION --remove-env-vars ATXFINANCE_BACKEND_ORIGIN
#
set -euo pipefail

ENV="${1:-}"
ORIGIN_RAW="${2:-}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

if [[ -z "$ENV" || -z "$ORIGIN_RAW" ]]; then
  echo "usage: $0 <staging|prod> <https://kotlin-backend-origin-no-trailing-slash>" >&2
  exit 2
fi

ORIGIN="${ORIGIN_RAW%/}"
if [[ ! "$ORIGIN" =~ ^https?://[^/]+ ]]; then
  echo "error: origin must be http(s)://host with no path (got: $ORIGIN_RAW)" >&2
  exit 2
fi

case "$ENV" in
  staging)
    PROJECT="${GCP_PROJECT_ID:-fintech-advisor-staging}"
    SVC="${CLOUD_RUN_SERVICE_STAGING:-xfinance-core-staging}"
    ;;
  prod)
    PROJECT="${GCP_PROJECT_ID_PROD:-fintech-advisor-prod}"
    SVC="${CLOUD_RUN_SERVICE_PROD:-xfinance-core-prod}"
    ;;
  *)
    echo "first arg must be staging or prod" >&2
    exit 2
    ;;
esac

echo "Updating Cloud Run service=$SVC project=$PROJECT region=$REGION"
echo "ATXFINANCE_BACKEND_ORIGIN=$ORIGIN"

gcloud run services update "$SVC" \
  --project "$PROJECT" \
  --region "$REGION" \
  --platform managed \
  --update-env-vars "ATXFINANCE_BACKEND_ORIGIN=${ORIGIN}" \
  --quiet

echo "Done. Verify: curl -sS \"\$(gcloud run services describe \"$SVC\" --project \"$PROJECT\" --region \"$REGION\" --format='value(status.url)')/api/health\" | head -c 200"
