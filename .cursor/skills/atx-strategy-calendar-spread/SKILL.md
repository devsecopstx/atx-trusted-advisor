---
id: atx-strategy-calendar-spread
name: atx-strategy-calendar-spread
description: Calendar Spread process for short-term theta capture against longer-dated same-strike exposure on TSLA.
---

# atxFinance Strategy: Calendar Spread

## Core setup

- **Frequency:** Medium
- **Thesis:** Sell short-term and buy longer-term same-strike options on TSLA to target time-decay income.
- **Risk profile:** Moderate (volatility differential risk)

## Guardrails

- Validate term-structure assumptions before opening.
- Monitor IV crush/expansion impact on both legs.
- Predefine roll timing for short leg into next cycle.

## Output format

1. Strike and expiry pair.
2. Net debit and target zone.
3. Volatility/time-decay assumptions.
4. Adjustment and exit criteria.
