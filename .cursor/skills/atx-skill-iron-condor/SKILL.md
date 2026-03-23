---
name: atx-skill-iron-condor
description: Iron condor framework for range-bound premium capture with defined risk. Use when the user asks for neutral volatility plays, condor wing selection, or probability-based income setups.
---

# atx-skill Iron Condor

## Core setup
- Combine bear call spread and bull put spread in same expiration.
- Collect net credit when expecting price to remain in range.
- Risk is defined by widest wing minus collected credit.

## Guardrails
- Keep wings outside expected move.
- Include event-risk filter (earnings, macro catalysts).
- Include tested-wing adjustment path.

## Output format
1. Short strikes and wing widths.
2. Credit, max risk, breakeven bounds.
3. Probability/range thesis.
4. Adjustment and exit rules.
