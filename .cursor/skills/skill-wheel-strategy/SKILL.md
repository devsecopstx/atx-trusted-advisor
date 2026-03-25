---
name: skill-wheel
description: Wheel strategy workflow (CSP to covered-call cycle) with premium reinvestment and assignment discipline. Use when the user asks for recurring options income loops, CSP-to-CC transitions, or wheel risk controls.
---

# skill Wheel Strategy

## Core setup
- Phase 1: sell cash-secured puts to seek discounted assignment.
- Phase 2: after assignment, sell covered calls against shares.
- Repeat cycle with premium reinvestment and position sizing discipline.

## Guardrails
- Preserve cash collateral requirements in put phase.
- Preserve share inventory checks in covered-call phase.
- Include transition rules between phases.

## Output format
1. Current phase assessment.
2. Proposed next trade in cycle.
3. Transition triggers (assign/expire/roll).
4. Risk and capital usage summary.
