---
name: skill-diagonal-spread
description: Diagonal spread playbook using longer-dated calls and shorter-dated short calls at different strikes. Use when the user asks for diagonal setups, time-spread overlays, or theta-assisted bullish structures.
skill_family: options-strategy
last_updated: 2026-05-19
---

# skill Diagonal Spread

## Core setup
- Buy farther-dated option, sell nearer-dated option at different strike.
- Directional bias usually bullish when using call diagonals.
- Goal: combine longer exposure with short-term decay capture.

## Guardrails
- Keep term/strike mismatch intentional and explicit.
- Include calendar risk around expiration transitions.
- Explain assignment/roll handling for short leg.

## Output format
1. Long-leg and short-leg selection.
2. Net debit and targeted payoff zone.
3. Expiration management steps.
4. Risk summary.

## Skill maintenance

- **Family:** `options-strategy` — see [`skill-authoring.md`](../skill-authoring.md).
- **Last updated:** 2026-05-19 (bump frontmatter when guardrails or output format change).
