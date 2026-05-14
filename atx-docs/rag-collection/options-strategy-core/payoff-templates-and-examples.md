---
id: xfinance-meta-payoff-templates
name: xfinance-meta-payoff-templates
description: Payoff building blocks — vertical, iron condor, single-leg — max profit / max loss / breakeven cheat sheet (illustrative numbers)
strategy_type: payoff_reference
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: stock
tags: [reference, breakeven, templates, vertical_spread, education]
---

# xFinance desk: Payoff templates & examples (core)

**One-sentence definition:** **Reusable formulas** for max profit, max loss, and breakevens for common building blocks so desk math stays consistent.

**Best market conditions:** **N/A** — reference card.

**Risk bucket:** **N/A**

**Payoff profile (templates per 1 contract / standard U.S. equity options ×100 multiplier):**

| Structure | Max profit | Max loss | Breakeven(s) |
|-----------|------------|----------|--------------|
| **Long call (K, debit D)** | Unlimited | **D** | **K + D/100** per share equivalent |
| **Long put** | Large (toward zero) | **D** | **K − D/100** |
| **Bull call vertical** (buy K₁, sell K₂, K₁<K₂, debit D) | **(K₂−K₁)×100 − D** | **D** | Lower BE **K₁ + D/100** |
| **Bull put credit** (sell higher put, buy lower, credit C, width W) | **C** | **W×100 − C** | Short strike − **C/100** |
| **Iron condor** (net credit C, put width Wₚ, call width W꜀) | **C** | max(**Wₚ, W꜀**)×100 − C (standard symmetric wings per side) | Two breakevens: short put − C/100 ; short call + C/100 |

**Position sizing rules:** Convert every structure to **max loss dollars** before comparing to NAV cap.

**Worked example (illustrative):** **Bull call spread** **NVDA**: buy **$120** call, sell **$130** call, pay **$3.50** ($350). Max value at expiry **$10/share** → max profit **($10 − $3.50)×100 = $650**; max loss **$350**; BE **$123.50**.

**When to avoid:** Using templates without checking **early exercise**, **dividends**, and **European vs American** style (most U.S. equity = American).

**Tax & assignment (HNWI — not tax advice):** Verticals can become **stock** via assignment on one leg — reconcile **immediately** with broker and CPA.

**Quick reference**

| Step | Action |
|------|--------|
| **1** | Write strikes, credit/debit, width |
| **2** | Compute max loss **before** send |
| **3** | Check liquidity on **long** wing first |

*Educational templates only; not financial advice.*
