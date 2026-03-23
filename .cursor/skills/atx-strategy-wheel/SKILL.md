---
id: atx-strategy-wheel
name: atx-strategy-wheel
description: Wheel strategy workflow (CSP to CC cycle) with premium and assignment proceeds reinvested into TSLA shares or LEAPs.
---

# atxFinance Strategy: Wheel Strategy

## Core setup

- **Frequency:** High
- **Thesis:** CSP to CC cycle on TSLA/proxies; reinvest all premiums and assignment outcomes into TSLA shares/LEAPs.
- **Risk profile:** Moderate-Aggressive (volatility and assignment risk)

## Guardrails

- Define transitions between CSP and CC states explicitly.
- Track cost basis and assignment events as first-class records.
- Enforce max allocation thresholds to avoid concentration drift.

## Output format

1. Current phase assessment.
2. Proposed next trade in cycle.
3. Transition triggers (assign/expire/roll).
4. Risk and capital usage summary.
