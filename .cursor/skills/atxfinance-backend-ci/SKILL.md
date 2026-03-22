---
name: atxfinance-backend-ci
description: CI validation plan for the atxfinance=backend service — autoscaling, CPU=1 + concurrency=1 enforcement, idempotency, retries/DLQ, and health checks.
---

# CI Validation — atxfinance Backend

Use this to validate reliability properties before/after deploys. Non-destructive; can run against local emulators or staging with safeguards.

## Checks
1) Health contract
   - `GET /api/health` returns `{ status: ok }` and dependency keys: `mongo`, `secrets` (and optional `queue`).
2) Idempotency
   - Publish N=5 messages with same `idempotencyKey` → exactly one processed.
3) DLQ behavior
   - Publish a poison message → after max attempts, message appears in DLQ.
4) Autoscaling
   - Burst publish N=200 messages → instances scale up but do not exceed `max-instances`; backlog drains within target time.
5) CPU & concurrency
   - Confirm `--cpu=1`, `--concurrency=1` on the service; sample logs show single active task per instance.

## Harness (reference)
A minimal harness is provided in `scripts/backend-ci/` to publish messages and read DLQ counts. It supports:
- Local Pub/Sub emulator
- GCP Pub/Sub (staging) with guardrails

### Example usage (staging)
```bash
# publish duplicate set
node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --count 5 --same-key same-key-123
# publish poison
node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --poison true --key poison-1
# read DLQ size
node scripts/backend-ci/dlq-size.js --dlq-topic atxfinance-backend-requests-dlq
```

## Pass/Fail Criteria
- Health: HTTP 200 and `mongo=ok`, `secrets=ok`.
- Idempotency: DB/logs show exactly one processing for `same-key` group.
- DLQ: poison messages accumulate in DLQ after retries; zero processing attempts marked as successful.
- Autoscaling: backlog drained within X minutes (set X=5 in staging; X=2 in prod) without exceeding max instances.
- CPU/Concurrency: no evidence of >1 concurrent job per instance; CPU never > 1 vCPU allocation.

## Notes
- Do not run destructive operations.
- If any check fails, stop deploy and open an incident/bug with links to logs and metrics.
- See `atxfinance-backend-architecture` for defaults and `*-deploy-*` skills for rollout/rollback procedures.
