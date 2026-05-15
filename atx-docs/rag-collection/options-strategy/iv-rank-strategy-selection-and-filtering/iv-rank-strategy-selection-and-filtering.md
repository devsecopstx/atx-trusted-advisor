---
id: xfinance-strategy-iv-rank-filtering
name: xfinance-strategy-iv-rank-filtering
description: Quantitative IV rank filters (e.g. >60%), term-structure plays, and earnings/vol-event overlays for wheel and premium-selling Monte Carlo scope.
strategy_type: quant_iv_rank
risk_level: balanced
market_condition: high_volatility
complexity: core
underlying_type: stock
tags: [iv_rank, iv_percentile, term_structure, earnings, wheel, monte_carlo, filtering]
---

# xFinance quant desk: IV rank — selection & filtering

**One-sentence definition:** **IV rank** gates which holdings enter a **Monte Carlo** or **wheel** scan — e.g. **>60%** means simulate only names where implied vol is elevated vs their 1-year range.

## IV rank floor in Monte Carlo

| User language | Tool arg | Engine behavior |
|---------------|----------|-----------------|
| "IV rank > 60%" | `minIvRankPct: 60` | Estimate IV rank from Yahoo chain ATM IV vs desk heuristic; **drop** symbols below floor |
| "high IV names only" | `minIvRankPct: 50` (default desk unless user specifies) | Same filter |
| No IV mention | omit `minIvRankPct` | All equity holdings in book |

**Empty book after filter:** Report per portfolio — do not substitute watchlist symbols unless user pivots to **strategy_recommendations**.

## IV rank vs IV percentile

| Metric | Desk rule |
|--------|-----------|
| **IV rank** | 0–100 vs 52-week IV range — primary filter for premium **sellers** |
| **IV percentile** | % of days IV was lower — confirm with user on ambiguous "high vol" |

Pair IV rank with **liquidity** (OI/volume on chain) before recommending strikes.

## Term-structure plays (45-day wheel horizon)

- Target expiry ≈ **45 DTE** for wheel/CC Monte Carlo — engine picks nearest chain to `horizonDays`.
- **Backwardation** (front IV > back): favors **short front** structures; note in narrative when term slope is steep.
- **Contango:** calendar / diagonal overlays may beat naked front short vol — defer to **strategy_recommendations** after MC.

## Earnings / vol-event overlay

| Regime | Filter adjustment |
|--------|-------------------|
| **Within 7 days of earnings** | IV rank often **inflated** — flag `assignmentRiskNote` style warning; optional raise floor to 70% for **new** premium |
| **Post-earnings crush** | IV rank may **collapse** next session — MC paths use pre-crush chain; say "event risk not fully captured" |
| **Index rebalance / FDA** | Do not rely on IV rank alone — cross-check `earnings-playbook` meta doc |

## Wheel + IV rank workflow

1. Preflight holdings per portfolio
2. `monte_carlo_tail_risk` with `minIvRankPct` + `horizonDays: 45`
3. If user wants strikes: `strategy_recommendations` with symbols that **passed** filter
4. Narrate **filteredSymbols** / empty-book messages from tool JSON

## Quick reference

| IV rank | Premium seller bias |
|---------|---------------------|
| **< 20** | Scale down credit unless structural thesis |
| **40–60** | Neutral — size normally |
| **> 60** | Statistical edge for **short vol** — still needs price defense |
| **> 80** | Crowded — check skew wings and gap risk |

*Not financial advice.*
