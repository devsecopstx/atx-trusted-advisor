---
id: atx-strategy-bull-call-debit-spread
name: atx-strategy-bull-call-debit-spread
description: Bull Call Debit Spread framework for leveraged bullish TSLA moves with capped risk and capped reward.
---

# atxFinance Strategy: Bull Call Debit Spread

## Core setup

- **Frequency:** Medium-High
- **Thesis:** Buy a lower-strike call and sell a higher-strike call on TSLA for leveraged bullish exposure with net debit.
- **Risk profile:** Moderate (capped risk/reward)

## Guardrails

- Define max debit per spread and aggregate portfolio exposure.
- Require target/stop logic relative to spread value, not underlying only.
- Avoid earnings/event windows unless explicitly intended.

## Output format

1. Strike/expiration setup (TSLA).
2. Debit, max gain/loss, breakeven.
3. Price-path scenarios.
4. Exit/adjustment plan.
