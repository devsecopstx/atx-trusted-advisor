---
id: xfinance-meta-volatility-iv-rank
name: xfinance-meta-volatility-iv-rank
description: IV rank vs IV percentile and post-event IV crush — regime vocabulary for premium sellers and vol buyers (educational)
strategy_type: volatility_indicators
risk_level: balanced
market_condition: high_volatility
complexity: core
underlying_type: stock
tags: [iv_rank, iv_crush, regime_filter, premium_selling, vol_buying]
---

# xFinance desk: Volatility rank & IV crush (core)

**One-sentence definition:** **IV rank** (and **IV percentile**) tell you if implied volatility is high *for that symbol’s own history* — useful for deciding if selling premium is **cheap edge or crowded**.

**Best market conditions:** Selling premium when **IV rank** is elevated **and** you have a defense plan; buying vol when **IV rank** is low **and** you have a catalyst thesis.

**Risk bucket:** **N/A (filter)** — lowers odds of selling “too cheap” but does not remove tail risk.

**Payoff profile:** **N/A**

**Position sizing rules:** Scale **credit** strategies **down** when IV rank **<20** unless structural edge (e.g. post-crush mean reversion thesis documented).

**Worked example (illustrative):** Name shows **IV rank 82** → options historically expensive vs last year → premium seller **edge statistically**, still needs price to cooperate.

**When to avoid:** Using IV rank alone during **one-off** events (index rebalance, FDA, M&A) where history is a poor guide.

**Tax & assignment (HNWI — not tax advice):** **N/A** directly — but **post-earnings crush** can force faster closes → more taxable events; plan with CPA if churn is high.

**Quick reference**

| Metric | Reads as |
|--------|----------|
| **IV rank** | 0–100 vs **1y** IV range |
| **IV percentile** | % of days IV was lower |
| **IV crush** | IV drop after event → hurts long vega, helps short vega |

## Guardrails

- Pair IV rank with **liquidity** and **skew** — rank alone misses wing risk.
- Log **implied move** vs **realized move** post print to calibrate desk bias.

*Not financial advice.*
