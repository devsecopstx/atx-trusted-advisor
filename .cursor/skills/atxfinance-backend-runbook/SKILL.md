---
name: atxfinance-backend-runbook
description: Operator runbook for the atxfinance=backend multi-node worker service — health checks, triage, rollback, DLQ, and SLOs.
---

# Runbook — atxfinance Backend

Use this to operate, triage, and recover the backend worker cluster.

## Golden Signals
- Availability: worker pull success and ack rate
- Latency: p50/p95 processing time per request type
- Errors: worker 5xx rate; DLQ growth
- Saturation: Cloud Run instance count near max, memory near 1Gi, CPU throttling

## Quick Health
- API health: `GET /api/health` → `{ status: ok, mongo: ok, secrets: ok }`
- Queue depth: Pub/Sub subscription `numUndeliveredMessages`
- DLQ depth: `atxfinance-backend-requests-dlq`

## Common Triage Steps
1) Recent errors in Logs Explorer: filter `resource.type="cloud_run_revision" AND resource.labels.service_name:"atxfinance-backend"`
2) Check DLQ: identify poison messages; correct schema and re-publish if safe.
3) Verify Mongo connectivity and unique index on `idempotencyKey`.
4) If overload: temporarily raise `max-instances` by 2x (prod) or reduce traffic.
5) If regression: rollback to previous revision (see deploy skills).

## DLQ Handling
- Export DLQ messages to GCS or BigQuery for bulk analysis.
- Fix root cause; for safe messages, republish to `atxfinance-backend-requests`.

## Incident Response
- Severity: S1 if >5% error for >10 minutes; S2 if DLQ growth >1000 in 30 min.
- Response: Page on-call, freeze deploys, gather timeline, rollback if new revision implicated.

## SLO (initial)
- Availability: 99.9%
- p95 Latency per request: < 5s (non-RAG); < 25s (RAG/tooling)
- Error budget policy: investigate if monthly error budget >20% consumed.

## Runbooks and References
- Deploy: `atxfinance-backend-deploy-staging`, `atxfinance-backend-deploy-production`
- Architecture: `atxfinance-backend-architecture`
- CI validation: `atxfinance-backend-ci`
