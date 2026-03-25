---
name: backend-deploy-stage
description: Deploy the atxfinance=backend Cloud Run worker to staging with single-CPU, concurrency=1, Pub/Sub integration, health checks, and rollback guidance.
---

# Deploy Staging — atxfinance Backend

Use this when promoting the backend worker to staging and validating cluster health.

## Prereqs
- Read `backend-architecture` first.
- Git branch: `main` (or approved release branch).
- GitHub → GCP deploy via OIDC/WIF is configured.
- Staging env has required secrets in GCP Secret Manager.

## Inputs
- `GCP_PROJECT_ID`
- `GAR_LOCATION` (e.g., `us-central1`)
- `GAR_REPOSITORY` (e.g., `xfinance`)
- `CLOUD_RUN_REGION` (e.g., `us-central1`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`
- `MONGODB_URI_B64` (secret reference)
- `PUBSUB_TOPIC=atxfinance-backend-requests`
- `PUBSUB_DLQ_TOPIC=atxfinance-backend-requests-dlq`

## Workflow
1) Gate: `npm run ci:gate` must pass.
2) Build/push image to Artifact Registry: tag with commit SHA.
3) Deploy Cloud Run service `atxfinance-backend-staging` with strict CPU/concurrency guards and env vars.
4) Verify health: `/api/health` and a no-op queue publish + consume.
5) Report status and rollback command.

## Example Commands (reference; run via CI job)
```bash
SHA=$(git rev-parse --short HEAD)
IMAGE="${GAR_LOCATION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GAR_REPOSITORY}/atxfinance-backend:${SHA}"

# build + push
docker build -t "$IMAGE" .
docker push "$IMAGE"

# deploy (reference flags; actual CI uses gcloud in a job)
gcloud run deploy atxfinance-backend-staging \
  --image="$IMAGE" \
  --region="$CLOUD_RUN_REGION" \
  --cpu=1 --concurrency=1 --memory=1Gi \
  --min-instances=1 --max-instances=5 \
  --service-account="$GCP_SERVICE_ACCOUNT_EMAIL" \
  --set-env-vars=FEATURE_ATXFINANCE=backend,PUBSUB_TOPIC=atxfinance-backend-requests,PUBSUB_DLQ_TOPIC=atxfinance-backend-requests-dlq,LOG_LEVEL=info \
  --set-secrets=MONGODB_URI_B64=MONGODB_URI_B64:latest \
  --no-allow-unauthenticated
```

## Health Validation
- `GET /api/health` → 200 `{ status: "ok", mongo: "ok", secrets: "ok" }`
- Publish a test message with a unique `idempotencyKey`; confirm single processing.
- Publish 3 duplicates with same `idempotencyKey`; confirm no duplicate processing.
- Publish a poison message; confirm it lands in DLQ after retries.

## Rollback
```bash
gcloud run services list --region="$CLOUD_RUN_REGION" --format=json | jq '.[] | select(.metadata.name=="atxfinance-backend-staging") | .spec.traffic'
# choose previous revision
gcloud run services update-traffic atxfinance-backend-staging \
  --region="$CLOUD_RUN_REGION" \
  --to-revisions REVISION_NAME=100
```

## Safety Rules
- Never skip CI gate.
- Never deploy from unapproved branch to staging unless explicitly allowed.
- Do not leak secrets in logs.
- If health fails, rollback immediately and open an incident.
