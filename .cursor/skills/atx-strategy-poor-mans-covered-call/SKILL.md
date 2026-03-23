---
id: atx-strategy-poor-mans-covered-call
name: atx-strategy-poor-mans-covered-call
description: Poor Man's Covered Call structure using 2027 LEAP exposure plus short OTM calls for leveraged income.
---

# atxFinance Strategy: Poor Man's Covered Call

## Core setup

- **Frequency:** High
- **Thesis:** Buy a 2027 LEAP call and sell short OTM calls on TSLA; target leveraged income toward long-term growth goals.
- **Risk profile:** Moderate-Aggressive (LEAP leverage)

## Guardrails

- Validate LEAP delta/depth before short-call overlays.
- Monitor time decay and IV regime shifts each roll cycle.
- Enforce roll/defense triggers if short leg approaches ITM early.

## Output format

1. Long-leg candidate and rationale.
2. Short-leg overlay candidate.
3. Net debit, breakeven, and risk.
4. Roll/repair plan.
