---
id: xfinance-strategy-portfolio-quant-aggregation
name: xfinance-strategy-portfolio-quant-aggregation
description: Aggregating Monte Carlo and risk metrics across multiple portfolios, sub-accounts (IRA, TOD, ROTH), and blended outlooks — quant-trader multi-book playbook.
strategy_type: quant_portfolio_aggregation
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: portfolio
tags: [multi_portfolio, sub_accounts, aggregation, outlook_blend, monte_carlo]
---

# xFinance quant desk: Portfolio-level aggregation

**One-sentence definition:** When the user scopes **"all portfolios"** or names multiple books, run **per-portfolio** simulations first, then present a **combined weighted** tail view — without asking them to pick ids when preflight already lists owned books.

## Scope rules (strict)

| Signal | Behavior |
|--------|----------|
| Workspace summary lists N portfolios (max **5**) | Simulate **all N** with `portfolioScope: "all"` |
| User says "my three portfolios" but N=2 | Run both; reply: "Workspace lists **2** owned portfolios; you mentioned **3**." |
| Single active book + no multi-book phrase | `workspace` scope or explicit `portfolioIds` |
| Mixed risk tiers | `perPortfolioRisk: true` — map each book's `riskLevel` / account `riskProfile` to conservative \| moderate \| aggressive |

## Sub-accounts inside one portfolio

- **Aggregation unit** for Monte Carlo is the **portfolio** document (all accounts + positions rolled up).
- **Sub-account types** (IRA, TOD, ROTH, taxable) affect **tax narrative only** in this playbook — not separate path engines unless user requests account-level splits (future).
- **Cash splits** across sub-accounts: include in book notional for weighting; CSP collateral must be **fundable** across the split — flag in narrative if cash < collateral hint from holdings.

## Outlook blending

| Source | Use |
|--------|-----|
| Active book `watchlist.outlook` | Primary for **strategy_recommendations** on that book |
| `investmentOutlook` / wheel candidates | Symbol universe for income structures post-MC |
| Per-book `riskLevel` | MC tier when `perPortfolioRisk: true` |
| Tenant account outlook block | Desk guardrails — do not override user-stated filters |

When comparing books, table: **portfolio name**, **1D VaR**, **CVaR**, **P(DD>20%)**, **drawdown gate pass/fail**, top **Greeks** line.

## Combined book (weighted)

- Tool returns `combinedTailRisk` — weights from **filtered holdings notionals** across books.
- **Do not** add VaRs arithmetically across portfolios; cite combined JSON only.
- If one book is cash-only, it lowers combined equity beta — say so explicitly.

## Multi-portfolio NL examples

- "Across my portfolios" → all books, no clarification question.
- "Aggressive book only" → match name in summary → single `portfolioIds` entry.
- "Roth and growth" → fuzzy match friendly names to ids from preflight.

## Guardrails

- Max **5** portfolios per MC call — if user has more, simulate top five by equity notional and note truncation.
- Never expose full 24-char ids in user-facing copy unless debugging — use names + short id prefix.

*Not financial advice.*
