---
name: backend-start-local
description: Start a local backend environment for atxfinance-backend using a .env file and a local Pub/Sub emulator. Non-destructive; validates health, idempotency, and DLQ behavior via emulator.
---

# Start Local — atxfinance Backend (Emulator)

Use this skill to bring up a safe, local backend environment for development and validation without touching any GCP resources. It relies on:
- A project `.env` file with required secrets
- The Google Pub/Sub emulator (no cloud calls)
- The app dev server (`npm run dev`) or Next API routes

## When To Use
- You want to test the backend worker logic, idempotency, and health contract locally
- You need a reproducible environment for CI harness development
- You do not want to deploy to staging yet

## Prerequisites
- Node 18+
- Docker optional (Mongo is Atlas via `MONGODB_URI_B64` — no local Mongo required)
- `.env` present (copy from `.env.example` and fill values)
- Install deps: `npm install`

## Required .env keys (local)
- `FEATURE_ATXFINANCE=backend`
- `MONGODB_URI_B64` — Atlas connection string (base64)
- `XAI_API_KEY`, `XAI_MANAGEMENT_API_KEY` — can be placeholders if not using xAI in local tests
- `X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_SECRET`, `AUTH_SECRET` — required by env schema
- `PUBSUB_EMULATOR_HOST=127.0.0.1:8085` — enables emulator mode
- `PUBSUB_TOPIC=atxfinance-backend-requests`
- `PUBSUB_DLQ_TOPIC=atxfinance-backend-requests-dlq`
- Optional: `LOG_LEVEL=debug`

## Workflow
1) Start Pub/Sub emulator in a new terminal:
   ```bash
   gcloud beta emulators pubsub start --host-port=127.0.0.1:8085
   ```
2) Export emulator env for your shell (same terminal as app):
   ```bash
   export PUBSUB_EMULATOR_HOST=127.0.0.1:8085
   ```
3) Create topics and subscriptions (emulator):
   ```bash
   gcloud beta emulators pubsub env-init > /dev/null 2>&1 || true
   curl -s -X PUT "http://localhost:8085/v1/projects/test-project/topics/atxfinance-backend-requests" || true
   curl -s -X PUT "http://localhost:8085/v1/projects/test-project/topics/atxfinance-backend-requests-dlq" || true
   curl -s -H 'Content-Type: application/json' \
     -d '{"name":"projects/test-project/subscriptions/backend-sub","topic":"projects/test-project/topics/atxfinance-backend-requests","deadLetterPolicy":{"deadLetterTopic":"projects/test-project/topics/atxfinance-backend-requests-dlq","maxDeliveryAttempts":5}}' \
     "http://localhost:8085/v1/projects/test-project/subscriptions/backend-sub" || true
   ```
   Note: The emulator ignores IAM; project id `test-project` is conventional for local.
4) Start the app locally with your `.env`:
   ```bash
   npm run dev
   ```
5) Validate health:
   ```bash
   curl -sSf http://localhost:3000/api/health | jq .
   # Expect: { status: "ok", service: "xfinance-core-app", details: { mongo: "ok", secrets: "ok", queue: "ok" } }
   ```
6) Use the backend CI harness (emulator mode) to exercise idempotency & DLQ:
   ```bash
   node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --count 5 --same-key same-key-123
   node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --poison true --key poison-1
   node scripts/backend-ci/dlq-size.js --dlq-topic atxfinance-backend-requests-dlq
   ```

## Safety Rules
- Never point this flow at production; it is emulator-only.
- Do not commit real secrets to `.env`.
- Keep `FEATURE_ATXFINANCE=backend` enabled only when you need the backend routes.

## Outputs
- Local app URL: `http://localhost:3000`
- Health check result JSON
- Harness results (published IDs, DLQ count)

## Troubleshooting
- If `/api/health` lacks `queue`, ensure `PUBSUB_EMULATOR_HOST` is exported in the terminal running `npm run dev`.
- If idempotency isn’t observed, check the unique index on `atx_backend_requests.idempotencyKey` exists (init code ensures it on first use).
