# atx-rag-collection/finance-core/portfolio-construction/modern-portfolio-theory-hnwi.md

---
id: xfinance-finance-core-mpt-hnwi-portfolio-construction
name: finance-core-mpt-multi-book-concentration
description: MPT refresher, multi-book architecture for taxable vs retirement vs legacy, and concentrated equity guardrails for HNWI desks
complexity: core
underlying_type: stock
strategy_type: portfolio_construction
risk_level: balanced
tags: [finance_core, mpt, hnwi, multi_portfolio, concentration, diversification]
---

# Portfolio construction — MPT, multi-book architecture, concentration

Educational desk reference for **workspace-grounded** conversations (use `atx_function` snapshots when available). Not tax or legal advice.

## Modern Portfolio Theory (practical refresher)

- **Mean–variance intuition** — investors care jointly about expected return and variance/covariance; diversification lowers portfolio variance when assets are not perfectly correlated.
- **Efficient frontier (conceptual)** — set of portfolios maximizing return for a given risk (or minimizing risk for a target return); real books add constraints (no short, max single-name, tax wrappers).
- **Inputs are noisy** — expected returns are unstable; prefer **robust** implementations: caps, sleeves, and rebalancing rules over point-estimate “optimal” weights.
- **Implementation gap** — frictions (commissions, spreads, taxes, corporate actions) matter more at HNWI scale; pair MPT language with **post-trade** and **liquidity** checks.

## Multi-portfolio architecture (taxable / retirement / legacy)

- **Why separate books** — different **risk budgets**, **distribution horizons**, **beneficiaries**, and **tax character** (ordinary vs long-term cap gains vs tax-deferred/free).
- **Product mapping** — workspace **portfolios** (`tenant_portfolio`) hold **custodian accounts** (`portfolio_accounts`) and **positions** (`portfolio_positions`); default book vs additional books is an org/policy choice, not a strategy label.
- **Cross-book transfers** — often taxable events or custodian-specific; flag “confirm with CPA/custodian” when users ask for journal-style moves.
- **Legacy / trust sleeves** — may sit in separate legal entities; in-product data may be partial—never invent trust terms; ask which book the user means and what the custodian shows.

## Concentrated stock & diversification thresholds

- **Single-name risk** — employer stock, post-IPO, founder positions: **liquidity**, **collateral value**, and **option overlay** capacity dominate; “diversify % per year” is a planning conversation, not a universal rule.
- **Desk heuristics (illustrative, not prescriptive)** — many desks **flag** concentration when a single equity name exceeds **~10–20%** of liquid net worth or book value; escalate planning when **>15%** of a risk-sensitive book unless the user documents a deliberate holding period / QSBT-type context (CPA).
- **Diversification paths** — staged sales, exchange funds (where available), options collars, charitable techniques (see `tax-strategies/`), and new-money allocation into non-correlated sleeves—always tie to **stated** risk tolerance and **observed** positions.

## Tool discipline (xChat)

- Prefer **`portfolio_summary`**, **`positions_snapshot`**, and **`account_health`** before proposing concentration trades.
- Use **`market_quote`** / **`yahoo_finance`** for spot context; do not fabricate custodian-specific constraints.
