---
id: atx-strategy-bull-put-credit-spread
name: atx-strategy-bull-put-credit-spread
description: Bull Put Credit Spread guide for defined-risk premium capture on TSLA pullbacks with reinvestment discipline.
---

# atxFinance Strategy: Bull Put Credit Spread

## Core setup

- **Frequency:** High
- **Thesis:** Sell OTM put spreads on TSLA dips for defined-risk income; reinvest proceeds into TSLA.
- **Risk profile:** Moderate (limited max loss)

## Guardrails

- Keep spread width aligned with defined max-loss limits.
- Require explicit invalidation and exit logic.
- Avoid overlapping spread clusters around key event dates.

## Output format

1. Short/long strike proposal.
2. Credit, max profit, max loss, breakeven.
3. Management triggers.
4. Risk summary.
