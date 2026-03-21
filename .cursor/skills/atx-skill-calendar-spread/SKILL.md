---
name: atx-skill-calendar-spread
description: Calendar spread framework for near-term theta capture against longer-dated same-strike exposure. Use when the user asks for neutral-to-moderately-directional time spreads or earnings/volatility time-structure trades.
---

# atx-skill Calendar Spread

## Core Setup
- Buy longer-dated option and sell shorter-dated option at same strike.
- Profit thesis: front expiry decays faster than back expiry.
- Usually centered around a target pin/price zone.

## Guardrails
- Highlight vega sensitivity and volatility crush risk.
- Include expiration-week management of the short leg.
- Keep max-risk defined by net debit.

## Output Format
1. Strike and expiry pair.
2. Net debit and target zone.
3. Volatility/time-decay assumptions.
4. Adjustment and exit criteria.
