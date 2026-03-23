---
id: atx-strategy-diagonal-spread
name: atx-strategy-diagonal-spread
description: Diagonal Spread playbook using long-dated LEAP calls and short near-term calls on TSLA and selected proxies.
---

# atxFinance Strategy: Diagonal Spread

## Core setup

- **Frequency:** Medium-High
- **Thesis:** Use a long far-term LEAP call plus a short near-term call on TSLA/proxies to combine theta capture and upside participation.
- **Risk profile:** Moderate-Aggressive (time/volatility flexibility risk)

## Guardrails

- Keep long-leg duration materially beyond short-leg expiration.
- Track term-structure and volatility shifts per roll decision.
- Enforce consistent strike laddering and max open diagonal count.

## Output format

1. Long-leg and short-leg selection.
2. Net debit and targeted payoff zone.
3. Expiration management steps.
4. Risk summary.
