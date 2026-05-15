# atx-rag-collection/finance-core/primitives-and-mechanics.md

---
id: xfinance-finance-core-primitives
name: finance-core-primitives-mechanics
description: Order types, settlement, margin, stock long/short, corporate actions, and reading chains/quotes at desk level
complexity: core
underlying_type: stock
tags: [finance_core, primitives, mechanics, settlement, margin, orders]
---

# Primitives & mechanics (desk)

Concise reference for **how markets and accounts behave** before strategy-specific playbooks.

## Orders & execution

- **Market vs limit** — market prioritizes fill speed; limit caps price adverse selection.
- **Day vs GTC** — session vs until canceled; good-til-date variants where offered.
- **Stops / stop-limits** — trigger becomes market or limit; gap risk through the trigger.
- **Partial fills** — working remainder until filled, canceled, or expired.

## Settlement & lifecycle

- **T+1 equities (US)** — confirm post-trade settlement cadence with the user’s broker; don’t assume legacy T+2.
- **Ex-dividend** — price often adjusts; option strikes may adjust on special dividends (policy varies).
- **Splits** — strikes/qty typically adjusted; verify chain after corporate action.

## Margin (conceptual)

- **Reg T / portfolio margin** — higher leverage regimes have different liquidation rules; never invent a user’s margin type.
- **Maintenance vs initial** — short options and stock loan can lift requirements sharply.
- **Pattern day trader** — label-only summary: FINRA rule of thumb for frequent day trades in margin accounts; user must confirm with broker.

## Long vs short stock

- **Long** — delta +1 per 100 shares; dividends flow to owner unless lent out.
- **Short** — borrow/rebate, hard-to-borrow fees, buy-in risk, unlimited loss on upside (theoretically).

## Corporate actions (desk level)

- **M&A, spinoffs** — symbols and deliverables change; chains may be adjusted or delisted.
- **Special dividends** — may drive option adjustments; treat as “verify chain” not “guess adjustment.”

## Chains & quotes (how to read)

- **Bid / ask / mid** — mid is indicative; tradable prices are bid/ask with size.
- **Open interest & volume** — OI is contracts outstanding; volume is session prints. High OI ≠ liquidity by itself.
- **IV column** — model-dependent; compare across strikes/expiries within the same chain snapshot.
- **Greeks (intuition)** — delta (directional sensitivity), gamma (delta stability), theta (time decay), vega (IV sensitivity). Use tool-backed numbers when available; don’t fabricate.

## Boundaries

- **Broker-specific** margin rates, routing, and tax lots → user’s custodian or CPA.
- **Strategy selection** → `options-strategy-core` / `options-strategy-advanced`.
