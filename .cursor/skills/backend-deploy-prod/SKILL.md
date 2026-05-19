---
name: backend-deploy-prod
description: Deploy the atxfinance-backend Cloud Run worker to production with canary traffic, health checks, rollback, and strict CPU/concurrency safety.
---

# Deploy Production — atxfinance Backend

Use this when promoting a tested staging build to production.

## Prereqs
- Staging deployed and validated per `backend-deploy-stage`.
- Release notes prepared and rollback plan acknowledged.
- GitHub → GCP deploy via OIDC/WIF configured for prod environment.

## Inputs
- `GCP_PROJECT_ID`
- `GAR_LOCATION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`
- Image digest or tag to promote (prefer digest from staging run)

## Workflow
1) Verify the exact image digest from staging.
2) Deploy a new revision of `atxfinance-backend` pointing to that digest.
3) Canary: route 5–10% traffic to the new revision; validate health and error rate for 10–20 minutes.
4) If healthy, shift to 100%.
5) If issues, rollback immediately to previous stable revision.

## Example Commands (reference)
```bash
DIGEST="us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/${GAR_REPOSITORY}/atxfinance-backend@sha256:..."

# deploy new revision (no traffic yet)
gcloud run deploy atxfinance-backend \
  --image="$DIGEST" \
  --region="$CLOUD_RUN_REGION" \
  --cpu=1 --concurrency=1 --memory=1Gi \
  --min-instances=2 --max-instances=40 \
  --service-account="$GCP_SERVICE_ACCOUNT_EMAIL" \
  --set-env-vars=FEATURE_ATXFINANCE=backend,PUBSUB_TOPIC=atxfinance-backend-requests,PUBSUB_DLQ_TOPIC=atxfinance-backend-requests-dlq,LOG_LEVEL=info \
  --set-secrets=MONGODB_URI_B64=MONGODB_URI_B64:latest \
  --no-allow-unauthenticated \
  --no-traffic

# identify the latest revision name
REV=$(gcloud run revisions list --service=atxfinance-backend --region="$CLOUD_RUN_REGION" --format="value(METADATA.name)" --limit=1)

# canary 10%
gcloud run services update-traffic atxfinance-backend \
  --region="$CLOUD_RUN_REGION" \
  --to-revisions ${REV}=10,previous=90

# after bake time, promote to 100%
gcloud run services update-traffic atxfinance-backend \
  --region="$CLOUD_RUN_REGION" \
  --to-revisions ${REV}=100
```

## Health & Observability
- Monitor Cloud Run error rate, latency, and CPU/memory.
- Confirm idempotency: publish duplicates and check for single processing only.
- Alerting: ensure Cloud Monitoring alerts are in place (HTTP 5xx rate, DLQ growth).

## Rollback
```bash
gcloud run services update-traffic atxfinance-backend \
  --region="$CLOUD_RUN_REGION" \
  --to-revisions previous=100
```

## Safety Rules
- Never deploy without staging validation.
- Never skip canary unless approved during incident mitigation.
- Do not expose secrets in any logs or PRs.
