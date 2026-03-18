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

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Output

- `Replay gaps`
- `Evidence integrity risks`
- `Retention/compliance gaps`
- `Control uplift plan with owners`
