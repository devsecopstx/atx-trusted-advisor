# Junie Guidelines — atxfinance=backend (Multi‑node Agents)

These guidelines tell Junie (and other project agents) exactly how to operate, extend, and validate the atxfinance=backend service using the local Cursor skills. They are non‑destructive by design and must never rotate keys, mutate cloud secrets, or deploy without the proper gates.

Audience: operators, maintainers, and CI agents working on the backend worker cluster that processes on‑demand aTx finance requests.

Related skills (safe set):
- atxfinance-backend-architecture
- atxfinance-backend-deploy-staging
- atxfinance-backend-deploy-production
- atxfinance-backend-runbook
- atxfinance-backend-ci

Key defaults (confirm per environment):
- Runtime: Cloud Run (fully managed)
- Queue: Google Pub/Sub (requests + DLQ)
- Single‑CPU agents: --cpu=1, --concurrency=1; memory=1Gi
- Topics: atxfinance-backend-requests, atxfinance-backend-requests-dlq
- Services: atxfinance-backend-staging, atxfinance-backend
- Feature flag: FEATURE_ATXFINANCE=backend required
- Staging scale: min=1, max=5; Prod scale: min=2, max=40; canary in prod

1) Operating Principles
- Non-destructive by default. Use docs, checks, and simulations first. Deploy only via approved workflows.
- Least privilege and OIDC/WIF only. Do not place long‑lived credentials in CI logs or PRs.
- Reproducible gates. Always run ci:gate (lint + types + tests) before any deploy.
- Idempotency. Treat duplicate deliveries as normal; ensure exactly one processing per idempotencyKey.
- Observability first. Prefer establishing symptoms (health, queue depth, error rate) before changes.

2) Decision Tree (Which skill to use?)
- Need to understand components or defaults? → Use atxfinance-backend-architecture.
- Promote code to staging or verify staging worker? → Use atxfinance-backend-deploy-staging.
- Promote a known‑good image to production with canary? → Use atxfinance-backend-deploy-production.
- Investigate health, DLQ, latency, or incidents? → Use atxfinance-backend-runbook.
- Validate reliability properties (health, idempotency, DLQ, autoscaling) before/after a change? → Use atxfinance-backend-ci.

3) Pre‑flight Checklist (all environments)
- Repo clean and on the correct branch; PRs pass ci:gate.
- Confirm FEATURE_ATXFINANCE=backend is set in target service.
- Confirm required secrets exist in GCP Secret Manager (see AGENTS.md → Critical Env Keys).
- Confirm Pub/Sub topics and subscriptions exist (requests + DLQ) and IAM is correct for the service account.
- Confirm region/project IDs and service names match environment conventions.

4) Staging Promotion (summary)
- Run atxfinance-backend-deploy-staging skill.
- Build & push image tagged with commit SHA to Artifact Registry.
- Deploy Cloud Run service atxfinance-backend-staging with cpu=1, concurrency=1, mem=1Gi, min=1, max=5; no unauthenticated.
- Validate health: GET /api/health → { status: ok, mongo: ok, secrets: ok }.
- Run CI harness checks (see 7) for idempotency, DLQ, and small burst.
- If any check fails, rollback and open an incident/bug.

5) Production Promotion (summary)
- Ensure staging revision/image digest is healthy and approved.
- Run atxfinance-backend-deploy-production skill.
- Deploy new prod revision with no traffic; then canary 5–10% for 10–20 minutes.
- Monitor health, error rate, DLQ growth, and p95 latency.
- Promote to 100% if healthy; otherwise rollback immediately.

6) Incident Triage (golden signals)
- Availability: worker pull success & ack rate
- Latency: p50/p95 per request type
- Errors: worker 5xx; DLQ growth
- Saturation: instance count near max, memory near 1Gi, CPU throttling

Triage steps:
1) Logs Explorer: filter service atxfinance-backend; identify recent error bursts.
2) Check DLQ topic depth; inspect sample payloads for schema/validation failures.
3) Verify Mongo connectivity and idempotency unique index on idempotencyKey.
4) If overload, consider temporary max‑instances increase (prod) or reduce traffic.
5) If regression correlated with new revision, rollback; document timeline.

7) CI Reliability Validation (harness)
- Location: scripts/backend-ci/*. Reference usage:
  - Duplicate set: node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --count 5 --same-key same-key-123
  - Poison message: node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --poison true --key poison-1
  - DLQ size: node scripts/backend-ci/dlq-size.js --dlq-topic atxfinance-backend-requests-dlq
- Pass criteria:
  - Health: HTTP 200 and mongo=ok, secrets=ok
  - Idempotency: exactly one processing for same-key group
  - DLQ: poison messages end in DLQ after retries; no successful processing
  - Autoscaling (staging): burst N≈200 drains within 5 minutes, not exceeding max‑instances

8) Security & Secrets
- Only OIDC/WIF + per‑env Service Account. No static keys in repo or logs.
- Secrets live in GCP Secret Manager; verify via gcloud secrets describe in deploy workflows.
- Redact or omit sensitive tokens in logs and PRs. Use LOG_LEVEL=info in prod.

9) Required Inputs (per skill)
- Deploy skills: GCP_PROJECT_ID, GAR_LOCATION, GAR_REPOSITORY, CLOUD_RUN_REGION, GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_SERVICE_ACCOUNT_EMAIL, MONGODB_URI_B64 (secret), PUBSUB_TOPIC, PUBSUB_DLQ_TOPIC, image tag/digest.
- CI skill: staging base URL, Pub/Sub topic names, auth context for publishing.
- Runbook skill: service name, region, logs filters, DLQ topic.

10) Prompts & Guardrails (copy‑paste)
- Architecture review: "Summarize the atxfinance=backend architecture, list required env vars, and confirm idempotency and DLQ policies per env. Do not deploy."
- Staging deploy: "Run the atxfinance-backend-deploy-staging workflow for commit <SHA>. Require ci:gate pass and health validation. If health fails, stop and provide rollback commands."
- Prod canary: "Promote image digest <DIGEST> to atxfinance-backend with 10% canary for 15 minutes. Monitor errors and DLQ. Rollback on elevated 5xx or DLQ growth."
- DLQ triage: "Inspect DLQ messages for the last hour, categorize root causes, and draft safe replay plan without auto‑republish."

11) SLOs (initial; tune with Ops)
- Availability: 99.9%
- p95 Latency: < 5s (non‑RAG), < 25s (RAG/tooling)
- Error budget: investigate if monthly budget > 20% consumed

12) Change Management
- All updates land via PR with ci:gate. Reference these guidelines in PR description when backend is affected.
- Update skills and this document together when defaults (regions, names, scaling) change.

13) Open Items to Confirm (mirrors PR #75 questions)
- Runtime: Cloud Run vs GKE Autopilot
- Queue: Pub/Sub vs alternatives
- Regions/projects per env
- Scaling SLOs and min/max per env
- Observability and alerting destinations (e.g., Slack webhook)
- Secrets policy details and new secret names
- Feature flag key/value
- Canary policy percentages and bake times
- Final naming for services and topics

Appendix A — References
- Skills: .cursor/skills/*backend*
- Runbook: AGENTS.md (search: Backend skills)
- Harness: scripts/backend-ci/README.md
