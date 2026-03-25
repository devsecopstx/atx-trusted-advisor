---
name: skill-covered-calls
description: Covered calls playbook for TSLA share inventory with weekly/bi-weekly OTM premium collection. Use when the user asks for covered-call setup, strike/expiry selection, rolling decisions, or assignment-aware income planning.
---

# skill Covered Calls

## Core setup
- Underlying default: TSLA shares already owned.
- Sell OTM calls (typically 3-10% above spot) on weekly or bi-weekly expirations.
- Manage for premium yield while accepting capped upside.

## Guardrails
- Never suggest naked calls.
- Include assignment path and roll/close criteria before expiration.
- Include downside scenario if shares drop while short call premium is collected.

## Output format
1. Entry setup (spot, strike distance, expiration).
2. Premium target and breakeven impact.
3. Assignment/roll decision tree.
4. Risk summary.
