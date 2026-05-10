#!/usr/bin/env bash
# Build Dockerfile.backend, push to Artifact Registry, deploy Cloud Run **atxfinance-backend-prod**.
# Prereqs: gcloud auth, docker, Artifact Registry writer, Cloud Run admin; Secret Manager has the
# same secret *names* as staging (MONGODB_URI_B64, XAI_*, AUTH_SECRET, etc.) in the prod project.
#
# After deploy, point Next at this URL:
#   bash scripts/ops/set-atxfinance-backend-origin.sh prod "$(gcloud run services describe atxfinance-backend-prod --region "${CLOUD_RUN_REGION:-us-central1}" --project "${GCP_PROJECT_ID:-fintech-advisor-prod}" --format='value(status.url)')"
# and set ATXFINANCE_BACKEND_ORIGIN in .env.prod to the same value before npm run ops:deploy:cloud-run:production.
#
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:-fintech-advisor-prod}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
# Default matches .github/workflows/deploy-cloud-run-production.yml (atxfinance-core-app).
REPO="${ARTIFACT_REGISTRY_REPO:-atxfinance-core-app}"
SERVICE="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-atxfinance-backend-prod}"
BACKEND_MIN_INSTANCES_PROD="${BACKEND_MIN_INSTANCES_PROD:-1}"
BACKEND_MAX_INSTANCES_PROD="${BACKEND_MAX_INSTANCES_PROD:-8}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TAG="${DEPLOY_TAG:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo manual)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/atxfinance-backend-prod:${TAG}"

echo "==> Configure Docker auth for Artifact Registry"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> docker build ($ROOT, Dockerfile.backend, platform linux/amd64 for Cloud Run)"
docker build --platform linux/amd64 -f "${ROOT}/Dockerfile.backend" -t "${IMAGE}" "${ROOT}"

echo "==> docker push ${IMAGE}"
docker push "${IMAGE}"

SECRETS="MONGODB_URI=MONGODB_URI_B64:latest,XAI_API_KEY=XAI_API_KEY:latest,XAI_MANAGEMENT_API_KEY=XAI_MANAGEMENT_API_KEY:latest,X_OAUTH_CLIENT_ID=X_OAUTH_CLIENT_ID:latest,X_OAUTH_CLIENT_SECRET=X_OAUTH_CLIENT_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest,SLACK_WEBHOOK_URL=SLACK_WEBHOOK_URL:latest,ADMIN_SEED_EMAIL=ADMIN_SEED_EMAIL:latest"
if gcloud secrets describe REDIS_URL --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},REDIS_URL=REDIS_URL:latest"
  echo "==> Binding REDIS_URL secret (present in project)"
fi
if gcloud secrets describe REDIS_URL_CONTROL --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},REDIS_URL_CONTROL=REDIS_URL_CONTROL:latest"
  echo "==> Binding REDIS_URL_CONTROL secret (present in project)"
fi
if gcloud secrets describe REDIS_URL_CACHE --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},REDIS_URL_CACHE=REDIS_URL_CACHE:latest"
  echo "==> Binding REDIS_URL_CACHE secret (present in project)"
fi
if gcloud secrets describe ATX_SCHEDULER_INTERNAL_SECRET --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1 &&
  gcloud secrets describe ATX_SCHEDULER_NEXT_BASE_URL --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
  SECRETS="${SECRETS},ATX_SCHEDULER_INTERNAL_SECRET=ATX_SCHEDULER_INTERNAL_SECRET:latest,ATX_SCHEDULER_NEXT_BASE_URL=ATX_SCHEDULER_NEXT_BASE_URL:latest"
  echo "==> Binding scheduler delegate secrets (JVM → Next execute-task)"
fi

echo "==> Cloud Run deploy ${SERVICE}"
gcloud run deploy "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --platform=managed \
  --image="${IMAGE}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=1Gi \
  --min-instances="${BACKEND_MIN_INSTANCES_PROD}" \
  --max-instances="${BACKEND_MAX_INSTANCES_PROD}" \
  --set-secrets="${SECRETS}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT}" --region="${REGION}" --format='value(status.url)')"
echo "==> Backend URL: ${URL}"
echo "==> Smoke: curl -sS \"${URL}/api/health\""
curl -sS "${URL}/api/health" | head -c 500 || true
echo
echo "==> Next BFF: bash scripts/ops/set-atxfinance-backend-origin.sh prod ${URL}"
echo "==> Also set ATXFINANCE_BACKEND_ORIGIN=${URL} in .env.prod (no trailing slash)"
