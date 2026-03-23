---
id: atx-strategy-leap-call-cc-overlay
name: atx-strategy-leap-call-cc-overlay
description: LEAP Call plus Covered Call Overlay for aggressive TSLA exposure using long-dated ITM LEAPs and short weekly calls.
---

# atxFinance Strategy: LEAP Call + CC Overlay

## Core setup

- **Frequency:** Medium
- **Thesis:** Hold a long 2028 ITM TSLA LEAP and sell weekly covered-call style overlays for accelerated income and growth.
- **Risk profile:** Aggressive (high leverage and decay)

## Guardrails

- Enforce leverage caps relative to total portfolio NAV.
- Require monthly stress checks for gap-risk and volatility shocks.
- Track LEAP theta/vega decay separately from overlay income.

## Output format

1. Long LEAP structure.
2. Overlay call structure.
3. Return paths (flat/up/down).
4. Risk and adjustment rules.
