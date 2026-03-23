#!/usr/bin/env bash
# Build Dockerfile.backend, push to Artifact Registry, deploy Cloud Run **atxfinance-backend-staging**.
# Prereqs: gcloud auth, docker, Artifact Registry writer, Cloud Run admin.
# After deploy: set Next BFF — bash scripts/ops/set-atxfinance-backend-origin.sh staging "$(gcloud run services describe atxfinance-backend-staging --region us-central1 --project fintech-advisor-staging --format='value(status.url)')"
#
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:-fintech-advisor-staging}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
REPO="${ARTIFACT_REGISTRY_REPO:-cloud-run-images}"
SERVICE="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-atxfinance-backend-staging}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TAG="${DEPLOY_TAG:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo manual)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/atxfinance-backend:${TAG}"

echo "==> Configure Docker auth for Artifact Registry"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> docker build ($ROOT, Dockerfile.backend)"
docker build -f "${ROOT}/Dockerfile.backend" -t "${IMAGE}" "${ROOT}"

echo "==> docker push ${IMAGE}"
docker push "${IMAGE}"

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
  --min-instances=0 \
  --max-instances=5 \
  --set-secrets="MONGODB_URI=MONGODB_URI_B64:latest,XAI_API_KEY=XAI_API_KEY:latest,XAI_MANAGEMENT_API_KEY=XAI_MANAGEMENT_API_KEY:latest,X_OAUTH_CLIENT_ID=X_OAUTH_CLIENT_ID:latest,X_OAUTH_CLIENT_SECRET=X_OAUTH_CLIENT_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest,SLACK_WEBHOOK_URL=SLACK_WEBHOOK_URL:latest,ADMIN_SEED_EMAIL=ADMIN_SEED_EMAIL:latest" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT}" --region="${REGION}" --format='value(status.url)')"
echo "==> Backend URL: ${URL}"
echo "==> Smoke: curl -sS \"${URL}/api/health\" | head -c 400"
curl -sS "${URL}/api/health" | head -c 400 || true
echo
echo "==> Next: bash scripts/ops/set-atxfinance-backend-origin.sh staging ${URL}"
