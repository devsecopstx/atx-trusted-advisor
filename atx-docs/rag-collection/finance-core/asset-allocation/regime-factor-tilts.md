# atx-rag-collection/finance-core/asset-allocation/regime-factor-tilts.md

---


id: xfinance-finance-core-regime-factor-allocation
name: finance-core-regime-factor-tilts
description: Regime-aware stock/fi/alternatives framing and factor tilts mapped to conservative balanced aggressive postures
complexity: core
underlying_type: stock
strategy_type: asset_allocation
risk_level: balanced
tags: [finance_core, asset_allocation, regime, factors, value, momentum, quality]
---

# Asset allocation — regimes & factor tilts

High-level framing for **desk conversations**; not a model catalog. Combine with **`portfolio_summary`** / outlook fields when available.

## Regime-aware models (equity / fixed income / alternatives)

- **Regime signals (examples)** — growth vs inflation surprises, real rates, credit spreads, USD strength; use **macro-outlooks/** for how Yahoo + narrative playbooks fit together.
- **Equity sleeve** — raise/lower beta vs baseline when user mandate allows **tactical** shifts; document assumptions (“risk-on/off”) in plain English.
- **Fixed income** — duration as sensitivity to rates; match horizon to liabilities; prefer **laddered** or **barbell** language over picking “the” optimal duration.
- **Alternatives** — private credit, RE, infra: illiquidity premia vs **cash drag** and **reporting lag**; never promise liquidity that docs don’t support.

## Factor tilting (value, momentum, quality)

- **Value** — cheap vs fundamentals; can endure long drawdowns; size tilts to **max tracking error** the user accepts.
- **Momentum** — trend persistence until reversals; transaction costs and tax turnover matter for taxable books.
- **Quality** — profitability, balance-sheet strength, earnings stability; often blended as **defensive** sleeve in late-cycle language.
- **Posture mapping** — **conservative** → tilt toward quality + shorter duration; **balanced** → modest multifactor; **aggressive** → allow larger active bets with explicit risk budget.

## Implementation notes

- Workspace may expose **scoring factors / outlook** on books—treat as **user + admin** inputs, not a black-box optimizer.
- When users lack an IPS, propose **ranges** and **decision rules** instead of point weights.
