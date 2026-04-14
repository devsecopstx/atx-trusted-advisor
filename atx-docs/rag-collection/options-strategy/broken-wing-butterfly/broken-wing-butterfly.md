---
id: xfinance-strategy-broken-wing-butterfly
name: xfinance-strategy-broken-wing-butterfly
description: Broken wing butterfly — asymmetric long wings for defined risk and a skewed payoff vs a symmetric butterfly or iron fly.
---

# xFinance Strategy: Broken wing butterfly

## How Commonly Used

Medium (advanced)

## Strategy

Build a **butterfly** with **intentionally unequal wings**: e.g. long one lower strike, short two middle strikes, long one higher strike where the upper (or lower) wing is **wider** than the other. Shifts max-profit zone and buying power vs a symmetric fly; payoff is still **defined risk** when fully long/short as a closed structure (no extra naked pieces).

## Risk Profile

Moderate (defined risk when structured as a closed butterfly; outcome depends on width, net debit/credit, and where spot settles)

## Guardrails

- Label max profit, max loss, and breakeven(s) after fills; broken wings skew all three vs a symmetric fly.
- Avoid illiquid strikes; multi-leg inventory is hard to adjust in wide markets.
- Reconcile with margin and “worst case” at expiration under your broker’s methodology.
- Educational context only; not financial advice.
