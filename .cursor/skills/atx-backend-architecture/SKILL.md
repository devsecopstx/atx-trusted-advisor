---
name: atx-backend-architecture
description: Architecture and operating model for the atxfinance=backend multi-node, fault-tolerant agent cluster. Cloud Run + Pub/Sub defaults, idempotency, scaling, observability, and safety rules.
---

# atxfinance Backend Architecture

Goal: define a safe, fault-tolerant, horizontally-scalable backend to process on-demand aTx finance requests using single-CPU agents. This skill encodes defaults and decisions and links to deploy, CI, and runbook skills.

## Defaults (can be overridden per env)
- Runtime: GCP Cloud Run (fully managed)
- Queue: Google Pub/Sub (pull subscription to Cloud Run jobs/workers is typical; HTTP push optional)
- Region: `us-central1`
- Services:
  - Staging: `atxfinance-backend-staging`
  - Production: `atxfinance-backend`
- Topics:
  - Requests: `atxfinance-backend-requests`
  - Dead-letter: `atxfinance-backend-requests-dlq`
- Instance shape:
  - `--cpu=1`, `--concurrency=1` (strict single-CPU, one request at a time)
  - Memory default: `--memory=1Gi`
- Scaling caps (tune per env):
  - Staging: `--min-instances=1 --max-instances=5`
  - Prod: `--min-instances=2 --max-instances=40`
- Rollout: staged (staging first), prod supports canary traffic split
- AuthN/Z: service-to-service via IAM; no unauthenticated invocations for backend worker endpoints

## Core Components
1) Ingress/API (optional): `/api/atxfinance/backend/enqueue` creates a request message (with `idempotencyKey`).
2) Queue: Pub/Sub topic + subscription (with dead-letter policy, backoff, and max delivery attempts).
3) Worker: Cloud Run service consuming messages, with strict CPU=1 and concurrency=1.
4) Persistence: MongoDB Atlas (primary). Optional: Redis cache (not required by default).
5) Observability: Cloud Logging, Error Reporting, Cloud Trace (optional). Alerts via Cloud Monitoring and/or Slack webhook.

## Idempotency & Exactly-Once Semantics
- Each request must have `idempotencyKey` (UUIDv4 is fine). Duplicate delivery is normal with Pub/Sub.
- Mongo collection `atx_backend_requests` has a unique index on `idempotencyKey`.
- Worker performs check-and-insert before executing. Duplicate insert throws `E11000` (code `11000`) → ack without re-processing.
- For long-running tasks, write a heartbeat doc with `status=in_progress`, then `status=done|failed`.
- Poison messages (schema invalid) must be nacked until maxDeliveryAttempts then land in DLQ.

Example schema (conceptual):
```json
{
  "idempotencyKey": "uuid",
  "type": "quote|trade|calc|report",
  "payload": {"...": "..."},
  "requestedBy": {"userId": "...", "roles": ["viewer|operator|advisor|global_admin"]},
  "requestedAt": "2026-01-01T00:00:00Z"
}
```

## Environment Variables
- `FEATURE_ATXFINANCE=backend` (required; service guard)
- `MONGODB_URI_B64` (Mongo Atlas; base64 URI)
- `PUBSUB_TOPIC=atxfinance-backend-requests`
- `PUBSUB_DLQ_TOPIC=atxfinance-backend-requests-dlq`
- `PUBSUB_SUBSCRIPTION` (if using pull/worker pattern)
- `XAI_API_KEY`, `XAI_MANAGEMENT_API_KEY` (if worker uses xAI)
- `AUTH_SECRET` (if any signed payload validation is needed)
- `LOG_LEVEL=info|debug`

## Scaling, Retries, and Backoff
- Cloud Run: set `--concurrency=1` and `--cpu=1` for strict single-CPU single-worker per instance.
- Pub/Sub subscription:
  - `maxDeliveryAttempts=5`
  - Exponential backoff (min 10s, max 600s)
  - Dead-letter to `PUBSUB_DLQ_TOPIC`
- Timeouts: worker request timeout 600s (tune per strategy).

## Health & Readiness
- `GET /api/health` must include:
  - `mongo: ok|fail` (ping)
  - `secrets: ok|missing` (subset check)
  - `queue: ok|degraded` (optional publish test with 2s timeout)
- Readiness fails if secrets missing or mongo unavailable.

## Security
- Deploy via GitHub Actions OIDC → GCP Workload Identity Federation (WIF) and a per-env Service Account.
- Secrets only in GCP Secret Manager and GitHub environment variables for OIDC plumbing.
- No secrets echoed in logs. Use redaction where applicable.

## References
- See `atx-backend-deploy-stage`, `atx-backend-deploy-prod`, `atx-backend-ci`, and `atx-backend-runbook` skills for procedures.
