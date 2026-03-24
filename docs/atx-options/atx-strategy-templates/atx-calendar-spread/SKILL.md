---
id: xfinance-strategy-calendar-spread
name: xfinance-strategy-calendar-spread
description: Calendar Spread process for short-term theta capture against longer-dated same-strike exposure on TSLA.
---

# xFinance Strategy: Calendar Spread

## How Commonly Used

Medium

## Strategy

Sell short-term and buy longer-term same-strike options on TSLA to target time-decay income.

## Risk Profile

Moderate (volatility differential risk)

## Guardrails

- Validate term-structure assumptions before opening.
- Monitor IV crush/expansion impact on both legs.
- Predefine roll timing for short leg into next cycle.
