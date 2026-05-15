# atx-rag-collection/finance-core/risk-and-product-education.md

---
id: xfinance-finance-core-risk-education
name: finance-core-risk-product-education
description: Options risk overview, IV/OI intuition, assignment and exercise, and broker-agnostic “what can go wrong” primers
complexity: core
underlying_type: stock
tags: [finance_core, risk, iv, oi, assignment, exercise, education]
---

# Risk & product education (desk)

Broker-agnostic **risk literacy** for options users. Pair with workspace data and live quotes from tools—never invent positions or approvals.

## Options risk overview

- **Defined vs undefined risk** — long options: premium at risk; naked short calls: theoretically unlimited upside loss; naked puts: large notional loss to zero.
- **Leverage** — small premium controls large notional; percentage swings are amplified vs stock.
- **Liquidity** — wide spreads and low OI raise exit cost and slippage; size to what the book can unwind.

## IV (implied volatility)

- **What it reflects** — consensus uncertainty and demand for options premium, not a forecast of realized move by itself.
- **IV rank / percentile (if cited)** — relative to recent history for the same underlying; definitions differ by vendor.
- **IV crush** — post-event IV drop can erode long-vol structures even if direction is “right.”

## Open interest & volume

- **OI** — stock of open contracts; changes slowly; new positions vs closes net into OI.
- **Volume** — activity today; spikes can flag events or crowding, not causality alone.

## Assignment & exercise (US-style mental model)

- **American options** — long holder may exercise early (rare except around dividends/carry); short is assignment risk through process.
- **Cash-settled vs physically settled** — know product type before describing settlement.
- **Pin risk** — gamma into expiry near strike can force painful deltas for dealers and messy marks for customers.

## “What can go wrong” primers

- **Gap through a short vertical** — max loss models assume fills at strikes; gaps break the box.
- **Early assignment on short calls** — dividend capture by counterparty; deep ITM short calls are higher risk around ex-div.
- **Pin / gamma squeeze language** — describe mechanics without sensationalism; cite data.

## Boundaries

- **Suitability / approvals** — user’s broker decides; don’t assert their level.
- **Tax** — high-level only; detailed scenarios → CPA (`tax-expert` persona or external).
- **Legal** — not legal advice; entity and trust questions → qualified attorney.
