---
name: atx-skill-poor-mans-covered-call
description: Poor Man’s Covered Call (long-dated call plus short OTM calls) for leveraged income. Use when the user asks for PMCC structure, LEAP leg selection, short-call overlays, or diagonal-style income trades.
---

# atx-skill Poor Man's Covered Call

## Core Setup
- Long leg: deep ITM, longer-dated call (often LEAP).
- Short leg: nearer-term OTM call sold repeatedly for income.
- Position behaves like covered call with lower capital than shares.

## Guardrails
- Track delta exposure of long leg.
- Define max loss (debit paid) and upside constraints.
- Include early assignment handling on short leg.

## Output Format
1. Long-leg candidate and rationale.
2. Short-leg overlay candidate.
3. Net debit, breakeven, and risk.
4. Roll/repair plan.
