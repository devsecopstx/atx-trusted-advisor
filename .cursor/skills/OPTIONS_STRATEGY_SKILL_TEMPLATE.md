---
name: skill-example-strategy
description: One-line when-to-use for Cursor discovery (strategy-specific).
skill_family: options-strategy
last_updated: YYYY-MM-DD
---

# skill Example Strategy

## Core setup

- Underlying / bias:
- Structure:
- Typical DTE / delta targets:

## Guardrails

- Defined risk only (no naked short options).
- Assignment / early-close path stated before entry.
- Downside scenario if underlying moves against the thesis.

## Output format

1. Entry setup (spot, strikes, expiration, contracts).
2. Premium / max risk / breakeven.
3. Management tree (roll, close, assignment).
4. Risk summary.

## Skill maintenance

- **Family:** `options-strategy` — see [skill-authoring.md](skill-authoring.md).
- **Template:** copy this file when adding a new playbook; add `CHECKLIST.md` mirroring the three sections above.
- **Last updated:** bump `last_updated` in frontmatter when guardrails or output format change.
