---
id: xfinance-strategy-broken-wing-butterfly
name: Broken Wing Butterfly
description: Asymmetric butterfly with intentionally unequal wings — defined-risk directional skew for income or mild bias.
risk: Moderate (defined risk when fully legged; max loss = net debit paid; skewed max-profit zone)
outlook: 
  - Conservative (protective overlay on core holdings)
  - Balanced (neutral-to-mildly bullish/bearish income generation)
  - Aggressive (high-IV directional plays on liquid names)
cursorSkill: skill-options-broken-wing-butterfly
tags: 
  - asymmetric-butterfly
  - defined-risk
  - directional-skew
  - income-generation
  - high-iv
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
