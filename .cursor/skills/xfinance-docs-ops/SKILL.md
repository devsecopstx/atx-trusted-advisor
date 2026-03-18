---
id: xfinance-docs-ops
name: xfinance-docs-ops
description: Maintain xFinance operational docs and runbooks with safe, non-deploying updates for local and cloud-agent usage.
---

# xFinance Docs Ops

## Goal

Keep operational docs accurate for xFinance without changing runtime behavior or deployment state.

## Use This Skill When

- Runbooks drift from current API routes or validation flow.
- Cloud-agent setup docs need safe updates.
- You need operator-facing troubleshooting guidance for auth, health, or xChat access.

## Inputs

- `AGENTS.md`
- `DEVELOPMENT.md`
- Relevant API route files under `src/app/api/`

## Workflow

1. Validate current behavior from code and scripts before editing docs.
2. Update existing docs first; avoid duplicate documents unless there is a clear separation of purpose.
3. Keep examples secret-safe (never hardcode real tokens, client secrets, or credentials).
4. Add only operationally useful instructions that can be executed reproducibly.

## Guardrails

- Do not deploy, release, or trigger environment changes from this skill.
- Do not rotate keys or modify production/staging secret values.
- Do not commit `.env` or any real credential material.

## Expected Output

- Concise doc diff with clear operator value.
- Explicit verification notes for changed instructions.
