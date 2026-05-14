---
id: xfinance-strategy-straddle-strangle
name: xfinance-strategy-straddle-strangle
description: Long straddle / strangle — long call + put for volatility or gap expression; full debit at risk
strategy_type: straddle
risk_level: aggressive
market_condition: high_volatility
complexity: core
underlying_type: stock
tags: [volatility, debit, strangle, catalyst, theta_negative]
---

# xFinance Strategy: Straddle & strangle (long)

**One-sentence definition:** A **long straddle** is long ATM call + long ATM put same expiry; a **long strangle** widens strikes — you pay debit and need a **large move** or **IV expansion** to profit.

**Best market conditions:** Cheap vol vs forecast move; catalyst calendar; willingness to cut loss if move fails.

**Risk bucket:** **Aggressive** (full debit at risk; theta bleeds daily).

**Payoff profile (long straddle, net debit D):**

| | |
|--|--|
| **Max profit** | Unlimited upside; large downside (put side) |
| **Max loss** | **D** (premium paid) if both expire worthless |
| **Breakevens** | Strike ± (D per share) for ATM straddle (same strike K): **K ± D** |

**Position sizing rules:** Risk **1R = debit**; typical starter **≤0.5–1%** NAV per pure vol punt unless mandate differs.

**Worked example (illustrative):** **SPY** **$500**, buy **$500** call + **$500** put **14 DTE**, pay **$8** total ($800). Need expiry move **> $8** from **$500** before time decay to have intrinsic edge (simplified; ignores carry).

**When to avoid:** Chronic long vol without catalyst; wide bid-ask on both legs; earnings **after** IV already bid to extremes without edge thesis.

**Tax & assignment (HNWI — not tax advice):** Closing legs may generate ST gains if held **<1y** — lot tracking matters on large debits.

**Quick reference (long straddle)**

| Greek | Sign | Note |
|-------|------|------|
| **Vega** | **+** | Loves IV up |
| **Theta** | **−** | Pays daily |
| **Gamma** | **+** near ATM | P/L accelerates near strike |

## Guardrails

- Pre-set **max loss** = debit; no averaging down without new thesis.
- For **income** strangles (short) see **advanced** iron condor / jade docs — do not confuse with this **long** primer.

## Output contract

Use **`ideaType`** from active desk template; long vol ideas often map to **`calendar_spread`** / **`diagonal_spread`** in automation — confirm enum for your surface. If no machine envelope applies, omit JSON and use markdown desk report per tenant policy.

*Not financial advice.*
