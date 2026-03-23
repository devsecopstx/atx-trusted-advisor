---
id: atx-strategy-iron-condor
name: atx-strategy-iron-condor
description: Iron Condor framework for range-bound premium capture on KTOS/PLTR and defense proxies with defined risk.
---

# atxFinance Strategy: Iron Condor

## Core setup

- **Frequency:** Medium-High
- **Thesis:** Deploy range-bound short spreads on KTOS/PLTR defense proxies; harvest premium for TSLA reinvestment.
- **Risk profile:** Moderate (defined risk if range holds)

## Guardrails

- Set wings and width consistently with account risk budget.
- Avoid low-liquidity strikes and unstable bid/ask conditions.
- Use proactive adjustment rules when price approaches short strikes.

## Output format

1. Short strikes and wing widths.
2. Credit, max risk, breakeven bounds.
3. Probability/range thesis.
4. Adjustment and exit rules.
