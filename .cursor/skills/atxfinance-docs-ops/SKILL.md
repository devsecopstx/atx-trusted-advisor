---
id: atxfinance-docs-ops
name: atxfinance-docs-ops
description: Maintain atxFinance operational docs and runbooks with safe, non-deploying updates for local and cloud-agent usage.
---

# atxFinance Docs Ops

## Goal

Keep operational docs accurate for atxFinance without changing runtime behavior or deployment state.

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
3. New files under **`docs/`** → add a row to **[`docs/README.md`](../../../docs/README.md)** (table of contents). New skills → add to **[`.cursor/skills/README.md`](../README.md)**.
4. Keep examples secret-safe (never hardcode real tokens, client secrets, or credentials).
5. Add only operationally useful instructions that can be executed reproducibly.

## Guardrails

- Do not deploy, release, or trigger environment changes from this skill.
- Do not rotate keys or modify production/staging secret values.
- Do not commit `.env` or any real credential material.

## Expected Output

- Concise doc diff with clear operator value.
- Explicit verification notes for changed instructions.
