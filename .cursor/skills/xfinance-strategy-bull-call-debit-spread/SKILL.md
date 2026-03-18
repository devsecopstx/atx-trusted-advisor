---
id: xfinance-strategy-bull-call-debit-spread
name: xfinance-strategy-bull-call-debit-spread
description: Bull Call Debit Spread framework for leveraged bullish TSLA moves with capped risk and capped reward.
---

# xFinance Strategy: Bull Call Debit Spread

## How Commonly Used

Medium-High

## Strategy

Buy a lower-strike call and sell a higher-strike call on TSLA for leveraged bullish exposure with net debit.

## Risk Profile

Moderate (capped risk/reward)

## Guardrails

- Define max debit per spread and aggregate portfolio exposure.
- Require target/stop logic relative to spread value, not underlying only.
- Avoid earnings/event windows unless explicitly intended.
