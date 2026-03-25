---
name: backend-start-stage
description: Start a safe staging session for atxfinance=backend. Non-destructive; validates staging health and lets you publish controlled test messages with guardrails.
---

# Start Staging — atxfinance Backend (Non‑destructive)

Use this skill to connect to the existing staging backend environment, verify health, and run controlled validation. It does not deploy or mutate infrastructure.

## When To Use
- You want to validate that the staging backend is healthy and reachable
- You want to run small, safe idempotency/DLQ checks against staging
- You need a repeatable way to “start” a backend validation session without changing infra

## Prerequisites
- Access to the staging GCP project via `gcloud` or GitHub OIDC environment
- Staging Cloud Run service already deployed (`atxfinance-backend-staging`)
- Secrets present in GCP Secret Manager (verified by deploy workflows)
- Local Node 18+ to run the non-destructive harness scripts

## Inputs Required
- `GCP_PROJECT_ID` (staging)
- `CLOUD_RUN_REGION` (e.g., `us-central1`)
- Topics: `atxfinance-backend-requests`, DLQ `atxfinance-backend-requests-dlq`
- Optional: `SLACK_WEBHOOK_URL` (only if you plan to post status; not required)

## Workflow
1) Fetch the staging service URL and verify health:
   ```bash
   SERVICE_URL=$(gcloud run services describe atxfinance-backend-staging \
     --region "$CLOUD_RUN_REGION" --project "$GCP_PROJECT_ID" \
     --format='value(status.url)')
   curl -sSf "$SERVICE_URL/api/health" | jq .
   # Expect: { status: "ok", service: "xfinance-core-app", details: { mongo: "ok", secrets: "ok" } }
   ```
2) Run a minimal, safe idempotency check (small N) using the harness (publishes to staging topic):
   ```bash
   # Ensure you are authenticated: gcloud auth application-default login
   node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --count 3 --same-key start-stg-dup-1
   # Verify only one processing occurs (check logs / DB) and DLQ remains stable
   ```
3) (Optional) Publish a single poison message to confirm DLQ policy (only if allowed):
   ```bash
   node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --poison true --key start-stg-poison-1
   # After retries, confirm appearance in DLQ:
   node scripts/backend-ci/dlq-size.js --dlq-topic atxfinance-backend-requests-dlq
   ```
4) Review Cloud Run logs for the worker:
   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="atxfinance-backend-staging"' \
     --project "$GCP_PROJECT_ID" --limit 20 --format json | jq '.[].textPayload'
   ```

## Safety Rules
- Keep test volumes minimal in staging (e.g., <= 10 messages).
- Do not modify service configuration or secrets with this skill.
- Never run poison-message tests during an active incident unless approved.

## Outputs
- Service URL and health JSON
- Harness output (published message IDs)
- DLQ size (if step 3 used)

## Troubleshooting
- If health fails, check deploy history and Secret Manager entries for staging.
- If the harness cannot publish, ensure your ADC credentials are set (`gcloud auth application-default login`) and that your IAM role has Pub/Sub publish permission.
