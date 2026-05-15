---
id: xfinance-strategy-quant-risk-tiers
name: xfinance-strategy-quant-risk-tiers
description: One-page mapping of conservative, balanced (moderate), and aggressive risk tolerances to Monte Carlo simulation inputs — ties to options-coreskills and monte_carlo_tail_risk.
strategy_type: quant_risk_tiers
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: portfolio
tags: [conservative, moderate, aggressive, balanced, monte_carlo, risk_tier, coreskills]
---

# xFinance quant desk: Conservative / balanced / aggressive parameters

**One-sentence definition:** Map desk **risk tiers** to **`monte_carlo_tail_risk`** `risk` argument and CVaR budget interpretation — use **per-portfolio** tiers when simulating multiple books.

## Tier → tool argument

| Desk label | Tool `risk` | Watchlist `riskProfile` map |
|------------|-------------|----------------------------|
| **Conservative** | `conservative` | `conservative` |
| **Balanced / moderate** | `moderate` | default / unset |
| **Aggressive / growth** | `aggressive` | `growth` → aggressive |

**Multi-book:** set `perPortfolioRisk: true` and infer tier **per portfolio** from workspace summary `riskLevel` unless user overrides globally.

## Simulation input matrix

| Parameter | Conservative | Balanced (moderate) | Aggressive |
|-----------|--------------|---------------------|------------|
| **1D CVaR budget (approx)** | ≤ **8%** | ≤ **12%** | ≤ **18%** |
| **Path count (default)** | 10k | 10k | 10k (optional 20k for convergence) |
| **Vol assumption bias** | Lower effective σ when ambiguous | ATM IV as-is | Allow upper-quartile σ in narrative stress |
| **Jump / tail emphasis** | Highlight **correlation crush** slice | Balanced stress table | Highlight **2020 vol spike** slice |
| **Rebalancing (narrative)** | Tighten after **5%** book DD | Review at **10%** | Accept **15%** user gate if passed |
| **Structure bias post-MC** | Protective puts, collars | Put spreads, defined-risk credit | Ratio overlays, wider short strikes |

## Mapping to options-coreskills

| Core skill slug | Default tier | Notes |
|-----------------|--------------|-------|
| **wheel** | moderate | Size down if combined CVaR breaches conservative cap |
| **covered-calls** | moderate | Capped upside — conservative books use farther OTM |
| **cash-secured-puts** | moderate | Conservative: cash-secured only, no naked |
| **iron-condor** | moderate | Conservative: half normal contract count |

## NL inference

| User says | `risk` |
|-----------|--------|
| "conservative book" / "capital preservation" | `conservative` |
| "balanced" / "moderate" / omitted on multi-book | `perPortfolioRisk: true` |
| "aggressive growth" / "max premium" | `aggressive` |

## Hedge overlay hints (from engine)

Tool JSON includes `hedgeOverlayHint` per tier — repeat verbatim; do not invent hedge notionals.

*Not financial advice.*
