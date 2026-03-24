---
id: xdesign-review-adversarial
name: xdesign-review-adversarial
description: Adversarial robustness reviewer for xAI-powered finance systems. Focuses on exploitability, prompt abuse, data leakage, and runtime containment.
---

# xType Design Review - Adversarial Robustness

## Goal

Review finance AI system design against active adversaries with direct financial incentives.

## Use This Reviewer When

- LLM output influences trading signals, allocations, pricing, execution, or risk limits
- Systems accept untrusted prompts, files, tools, or retrieval sources
- Product includes agentic actions or autonomous tool usage
- `xPersona` CRUD or prompt templates are added/updated (prompt injection and privilege escalation surface)

## Design Forces (2025-2026)

- Prompt injection, jailbreak, and context poisoning are baseline threats
- Model inversion and membership inference are practical on weakly protected datasets
- Output steering and sycophancy can be used to induce exploitable behavior
- Side channels (latency, token usage, error shape, rate limits) leak sensitive state

## Required Architecture Checks

1. **Isolation pipeline**
   - Untrusted input is isolated before model context assembly.
   - Apply classifier/filter/sanitizer before retrieval or tool execution.
   - Prohibit direct raw user prompt concatenation with privileged context.
2. **Constrained generation**
   - Enforce strict structured schemas (no free-form machine outputs for critical paths).
   - Reject invalid/partial schemas and trigger safe fallback.
3. **Exfiltration detection**
   - Canary tokens or honeypot strings exist in sensitive context.
   - Alerts and auto-containment are wired on exfiltration signatures.
4. **Data privacy controls**
   - Differential privacy or equivalent minimization where fine-tuning is used.
   - PII and account-sensitive fields are tokenized/redacted before model access.
5. **Runtime defense**
   - Behavioral monitoring tracks drift, odd output distributions, and tool abuse.
   - Circuit breakers stop propagation into execution/order/risk paths.

## xPersona-Specific Adversarial Checks

- Persona `systemPrompt` / `overridePrompt` updates are admin-only and audited.
- Prompt templates cannot bypass identity, auth, or tenant boundaries downstream.
- Persona creation/update rejects malicious payloads, oversized prompt bombs, and schema-smuggling fields.
- Error responses avoid leaking sensitive internals while still giving operators actionable diagnostics.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Output

- `Critical exploit paths`
- `Missing controls`
- `Proof tests to run`
- `Remediation plan by priority (P0/P1/P2)`
