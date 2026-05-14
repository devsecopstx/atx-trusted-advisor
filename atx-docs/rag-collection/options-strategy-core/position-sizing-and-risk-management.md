---
id: xfinance-meta-position-sizing
name: xfinance-meta-position-sizing
description: Cross-strategy position sizing and risk budget rules for options overlays on HNWI books (not a single payoff structure)
strategy_type: position_sizing
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: stock
tags: [risk_management, portfolio, sizing, hnwi, cross_cutting]
---

# xFinance desk: Position sizing & risk management (core)

**One-sentence definition:** A **policy layer** for how much capital, how many contracts, and how much single-name heat you allow per options structure — before strike selection.

**Best market conditions:** Always — sizing is regime-agnostic; tighten in high correlation / high VIX / earnings season if desk policy says so.

**Risk bucket:** **N/A (cross-cutting)** — implements **Conservative / Balanced / Aggressive** *caps* on the book, not a trade payoff.

**Payoff profile:** **N/A** — applies to CSP, spreads, wheel, overlays alike.

**Position sizing rules (starter desk policy — customize):**

| Rule | Conservative | Balanced | Aggressive |
|------|--------------|----------|------------|
| **Max options risk per ticker** | ≤ **3–5%** NAV in max loss | ≤ **8–12%** | ≤ **15%** only with explicit IC sign-off |
| **Max naked / CSP collateral** | Cash-secured only; sum strikes ×100 ≤ cap | Same + liquidity buffer | PM rules must mirror stress test |
| **Max contracts per idea** | Align to income-ideas cap (**1–5**) | Same | Same |
| **Concentration** | Top **3** names ≥ **60%** book → no new premium sold without hedge ticket | Moderate enforcement | Document exception only |

**Worked example (illustrative):** Book **$2M** NAV, **Balanced** tier: max **$160k** defined loss open per ticker across spreads. One **$5**-wide credit put spread → max loss **$500** per spread → cap **320** spreads **theoretical** — in practice liquidity and margin reduce far lower; desk uses **≤20** concurrent spreads per name as *operational* cap.

**When to avoid:** Sizing rules that ignore **gap risk** and **correlation** (semis, megacap tech move together); rules that change intra-month without audit.

**Tax & assignment (HNWI — not tax advice):** Large assignment can change basis lots and year-end gain budget — size so assignments are **fundable** and **reportable** without fire sales.

**Quick reference**

| Check | Question |
|-------|----------|
| **1R** | What is max loss per trade in dollars? |
| **ΣR** | Sum of open 1R across book ≤ policy? |
| **Liquidity** | Can you exit 50% in **1×** ADV without moving the market? |

## Guardrails

- Never size from premium alone — always **max loss first**.
- Recompute after splits, special dividends, and M&A.

*Not financial advice; desk policy only.*
