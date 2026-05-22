---
id: xfinance-quant-iv-rank-filtering
name: xfinance-quant-iv-rank-filtering
description: Quantitative IV rank filters (e.g. >60%), term-structure plays, and earnings/vol-event overlays used inside Monte Carlo scope for the quant-trader persona.
category: quant-trader
strategy_type: quant_iv_rank
risk_level: balanced
market_condition: high_volatility
complexity: core
underlying_type: stock
tags: [iv_rank, iv_percentile, term_structure, earnings, wheel, monte_carlo, filtering]
---

# Quant Trader: IV Rank — Selection & Filtering

**One-sentence definition:** **IV rank** gates which holdings enter a **Monte Carlo** or **wheel** simulation — e.g. **>60%** means only names where implied volatility is elevated relative to their own 1-year range.

## IV rank floor in Monte Carlo

| User language          | Tool arg                | Engine behavior |
|------------------------|-------------------------|-----------------|
| "IV rank > 60%"        | `minIvRankPct: 60`      | Drop symbols below floor before running paths |
| "high IV names only"   | `minIvRankPct: 50`      | Default desk behavior when not specified |
| No IV mention          | (omit)                  | All equity holdings in the book |

**Empty book after filter:** The tool returns `filteredSymbols` per portfolio. Never invent replacement symbols.

## IV rank vs IV percentile

| Metric            | Desk usage |
|-------------------|------------|
| **IV rank**       | 0–100 vs 52-week range — primary filter for premium sellers |
| **IV percentile** | % of historical days IV was lower — use for confirmation |

## Term structure & event overlays (45-day horizon)

- Target expiry ≈ `horizonDays` (engine picks nearest chain).
- **Backwardation** (front IV elevated): favors short front premium.
- **Earnings within 7 days**: IV often inflated — consider raising floor or adding assignment warning.
- **Post-earnings crush**: paths use pre-event IV; note that realized vol drop may not be fully modeled.

## Workflow with Monte Carlo

1. Preflight workspace holdings.
2. Call `monte_carlo_tail_risk` with `minIvRankPct`.
3. Narrate the `filteredSymbols` list from the result.
4. If user wants strike ideas on the survivors → follow up with `strategy_recommendations`.

**When a trader asks "why did you exclude XYZ?"** → retrieve this document (`category = "quant-trader"`, `strategy_type = "quant_iv_rank"`) and explain the filter.

*Educational only — not investment advice.*
