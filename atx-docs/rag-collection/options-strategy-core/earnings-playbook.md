---
id: xfinance-meta-earnings-playbook
name: xfinance-meta-earnings-playbook
description: Earnings-window playbook — reduce size, define invalidation, and separate vol trade from directional thesis (educational)
strategy_type: earnings_event
risk_level: aggressive
market_condition: high_volatility
complexity: core
underlying_type: stock
tags: [earnings, event_risk, sizing, catalyst, playbook]
---

# xFinance desk: Earnings playbook (core)

**One-sentence definition:** **How to behave** around known earnings dates when running premium or vol structures — without treating the print as a lottery ticket.

**Best market conditions:** High IV **before** print if you are **selling** premium you can defend; **after** crush if you are buying vol you expect to expand again (both paths need explicit thesis).

**Risk bucket:** **Aggressive** if you size binary events like “usual” weeks — treat earnings as **its own risk class**.

**Payoff profile:** **N/A (event-driven)** — depends on chosen structure (vertical, iron fly, long straddle, etc.).

**Position sizing rules:** Cut **≤50%** of normal width/notional vs non-event weeks unless mandate says otherwise; **no** martingale on loss into the print.

**Worked example (illustrative):** **NVDA** earnings in **48h** — baseline desk rule: if IV rank **>70**, credit structures must keep **short strikes** outside **1-day implied move** band from spot **or** pass the trade.

**When to avoid:** Illiquid weeklies with **$0.50**+ bid-ask on body; single-name concentration + earnings overlap across book.

**Tax & assignment (HNWI — not tax advice):** Assignment through earnings can land lots you did not want for **QSBS**/**wash** planning — pre-flag with CPA if size is material.

**Quick reference**

| Phase | Desk focus |
|-------|------------|
| **T−5** | IV rank, implied move, open interest at shorts |
| **T−1** | Liquidity, margin cushion, roll/close triggers |
| **T+1** | Crush vs realized gap; defend or exit |

## Guardrails

- Separate **vol trade** thesis from **directional** thesis — if both exist, size the stricter one.
- Post-earnings **IV crush** hurts long premium; plan exit **before** decay wins.

*Not financial advice.*
