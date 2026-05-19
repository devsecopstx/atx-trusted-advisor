---
name: skill-iron-condor
description: Iron condor framework for range-bound premium capture with defined risk. Use when the user asks for neutral volatility plays, condor wing selection, or probability-based income setups.
skill_family: options-strategy
last_updated: 2026-05-19
---

# skill Iron Condor

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

## Skill maintenance

- **Family:** `options-strategy` — see [`skill-authoring.md`](../skill-authoring.md).
- **Last updated:** 2026-05-19 (bump frontmatter when guardrails or output format change).
