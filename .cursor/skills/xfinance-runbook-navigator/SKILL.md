---
id: xfinance-runbook-navigator
name: xfinance-runbook-navigator
description: Navigate xFinance runbooks quickly and route operators to the correct local, cloud, and xChat validation procedures.
---

# xFinance Runbook Navigator

## Goal

Resolve "what should I run next?" questions by mapping tasks to the right runbook sections.

## Primary References

- `AGENTS.md` for standard flow, gates, and cloud-specific instructions.
- `DEVELOPMENT.md` for environment keys, API surface, and deeper troubleshooting details.

## Routing Rules

- Local setup and restart issues -> standard local flow and quick health checks.
- Cloud-agent startup issues -> cloud-specific instructions and minimal smoke checks.
- xChat readiness issues -> xChat ask endpoint checks and admin validation checklist.

## Triage Output Format

1. Suspected layer (env, auth, API route, provider).
2. Exact commands to run next.
3. Expected success criteria and failure signals.
4. Safe escalation path when checks fail.

## Guardrails

- Do not trigger deploy workflows.
- Do not execute key-rotation or secret mutation operations.
- Keep troubleshooting steps deterministic and secret-safe.
