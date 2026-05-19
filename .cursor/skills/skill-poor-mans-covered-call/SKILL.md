---
name: skill-poor-mans-covered-call
description: Poor Man’s Covered Call (long-dated call plus short OTM calls) for leveraged income. Use when the user asks for PMCC structure, LEAP leg selection, short-call overlays, or diagonal-style income trades.
skill_family: options-strategy
last_updated: 2026-05-19
---

# skill Poor Man's Covered Call

## Core setup
- Long leg: deep ITM, longer-dated call (often LEAP).
- Short leg: nearer-term OTM call sold repeatedly for income.
- Position behaves like covered call with lower capital than shares.

## Guardrails
- Track delta exposure of long leg.
- Define max loss (debit paid) and upside constraints.
- Include early assignment handling on short leg.

## Output format
1. Long-leg candidate and rationale.
2. Short-leg overlay candidate.
3. Net debit, breakeven, and risk.
4. Roll/repair plan.

## Skill maintenance

- **Family:** `options-strategy` — see [`skill-authoring.md`](../skill-authoring.md).
- **Last updated:** 2026-05-19 (bump frontmatter when guardrails or output format change).
