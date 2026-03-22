---
id: xdesign-review-audit
name: xdesign-review-audit
description: Traceability, auditability, and non-repudiation reviewer for AI decisions in finance. Ensures replayability, lineage, and evidentiary integrity.
---

# xType Design Review - Auditability and Non-Repudiation

## Goal

Review whether every material AI decision is replayable, attributable, and defensible for regulatory and litigation workflows.

## Use This Reviewer When

- AI output affects customer-facing recommendations, pricing, risk, compliance, or orders
- Teams need 3-7 year replay windows for controls and investigations
- Design includes RAG, tool calls, post-processing, and policy gates

## Design Forces (2025-2026)

- Regulators and internal risk/audit require deterministic lineage for material decisions
- Partial logging is non-compliant when decision impact is material
- "We cannot reproduce it" is treated as a control failure

## Required Lineage Contract

Each material inference must store immutable records for:

- Prompt (system, developer, user segments)
- Retrieved context (document IDs, chunk IDs, versions, timestamps)
- Model identity (provider, model, checkpoint/version hash)
- Inference params (temperature, top-p, seed if supported, token limits)
- Tool calls (name, inputs, outputs, status, timing)
- Raw output and normalized output
- Post-processing/policy decisions and final action decision
- Actor metadata (service identity, user/session, correlation IDs)

## Required Control Checks

1. **Replayability**
   - Full decision replay is possible from stored artifacts.
   - Dependency versions are pinned for reproducible reconstruction.
2. **Non-repudiation**
   - Decision records are tamper-evident (hash chaining or signed logs).
   - Access and mutation events are logged with immutable audit trails.
3. **Retention and retrieval**
   - Retention policy meets legal/regional requirements.
   - Audit retrieval query paths are tested for completeness and latency.
4. **Policy trace**
   - Every allow/deny/escalate action cites the policy rule and version.
5. **Config provenance (finance runtime)**
   - Runtime secret source-of-truth is explicit and auditable:
     `XAI_*`, `X_OAUTH_*`, `AUTH_SECRET`, `MONGODB_URI_B64`, `SLACK_WEBHOOK_URL`,
     `ADMIN_SEED_EMAIL` must be from GCP Secret Manager in stage/prod.
   - GitHub Environment secrets are deploy-identity only
     (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`).
   - GitHub Variables are used for deploy-time literals
     (`PROD_BASE_URL`, `STAGING_BASE_URL`, `ALLOW_ANY_X_USER_LOGIN`, etc.).
   - Secret value integrity is validated, not just secret existence:
     `ADMIN_SEED_EMAIL` must parse as an RFC-like email (no trailing commas/spaces),
     and required runtime secrets must be non-empty latest versions.
6. **Bootstrap evidence (access approval)**
   - Access approval bootstrap actions are auditable end-to-end:
     resource creation/reuse, async enqueue record, and failure warning record.
   - Warning path emits an explicit audit action and operator-visible signal
     (for this repo: `alert-user-not-sync-warning`).
7. **Deploy path correctness**
   - **Push to `main`** deploys **staging** only; production does **not** run on push.
   - **`workflow_dispatch`:** **`target=staging`** redeploys staging; **`target=manual_only_prod`** with **`confirm_manual_prod=yes`** runs **`deploy-production-manual`**.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Output

- `Replay gaps`
- `Evidence integrity risks`
- `Retention/compliance gaps`
- `Control uplift plan with owners`
