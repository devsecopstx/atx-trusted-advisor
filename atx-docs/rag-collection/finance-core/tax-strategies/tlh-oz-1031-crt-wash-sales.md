# atx-rag-collection/finance-core/tax-strategies/tlh-oz-1031-crt-wash-sales.md

---
id: xfinance-finance-core-tax-tlh-oz-crt-wash
name: finance-core-tax-strategies-hnwi
description: TLH mechanics vs position lots, OZ and 1031 and CRT themes at desk level, and wash-sale pitfalls in options overlays
complexity: advanced
underlying_type: stock
strategy_type: tax_planning
risk_level: conservative
tags: [finance_core, tax, tlh, opportunity_zone, 1031, crt, wash_sale, options]
---

# Tax strategies — desk-level HNWI themes

**Educational only.** Always defer to a **CPA / tax counsel** for elections, entity structure, and filing positions.

## Tax-loss harvesting (TLH) vs position / lot data

- **Mechanics** — sell losers to realize losses that offset gains (and limited ordinary income), then redeploy within **wash-sale** and **substantially identical** constraints.
- **Lot awareness** — when `portfolio_positions` (or custodian exports) expose **per-lot** cost basis, prefer harvesting **highest-cost** lots first *if* the user’s policy and broker ordering support it; if lots are aggregated, be explicit that granularity may be incomplete in-app.
- **Reinvestment window** — partner with user on **replacement securities** (not substantially identical) and **30-day** wash windows.
- **Options interactions** — assignments, exercises, and short premium can **accelerate** gains/losses; see wash-sale section.

## Opportunity zones, 1031, charitable remainder trusts (CRT)

- **Opportunity Zones** — deferral / exclusion mechanics are **statutory and project-risk** heavy; desk role is to flag diligence items, not to underwrite projects.
- **1031 exchanges** — like-kind real property timing + qualified intermediary; not equities; watch **boot** and **debt relief** gain recognition.
- **CRT / split-interest** — income tax + charitable deduction + remainder charity mechanics; coordinate with estate counsel; product may not model trusts—**do not invent** balances.

## Wash-sale avoidance in options overlays

- **Substantially identical** — can include calls on stock recently sold at a loss within the window; IRS facts-and-circumstances—stay conservative in copy.
- **Short options** — assignment can re-establish stock lots; explain **risk** of inadvertent wash linkage when users roll rapidly around TLH trades.
- **ETF vs single-stock** — not automatically “different enough”; avoid hard guarantees.

## Tool grounding

- Use **`positions_snapshot`** / imports for **basis hints**; if data lacks lots, say so and recommend custodian lot report.
