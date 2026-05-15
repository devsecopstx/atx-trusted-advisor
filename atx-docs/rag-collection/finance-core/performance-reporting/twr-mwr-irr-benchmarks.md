# atx-rag-collection/finance-core/performance-reporting/twr-mwr-irr-benchmarks.md

---
id: xfinance-finance-core-performance-twr-mwr-irr
name: finance-core-performance-reporting-metrics
description: Time-weighted vs money-weighted returns IRR framing and benchmark selection for HNWI reporting conversations
complexity: core
underlying_type: stock
strategy_type: performance
risk_level: balanced
tags: [finance_core, performance, twr, mwr, irr, benchmark, reporting]
---

# Performance reporting — TWR vs MWR, IRR, benchmarks

Clarify **what question each metric answers**; avoid mixing them in one sentence without labels.

## Time-weighted return (TWR)

- **Answers** — “How did the **manager/strategy** perform ignoring the timing of cash flows?”
- **Use** — comparing to a benchmark or peer when **external cash flows** are large or lumpy.
- **Caveat** — not the investor’s personal dollar-weighted experience.

## Money-weighted return (MWR) / IRR

- **Answers** — “What return did **this investor’s dollars** experience given when they deposited or withdrew?”
- **Use** — lifestyle and **goal** tracking; can look poor if deposits happen before rallies (path-dependent).
- **IRR nuance** — multiple roots possible with exotic cash flows; funds often publish **Modified Dietz** approximations.

## Benchmark selection

- **Appropriate match** — cap-weight vs equal-weight, hedged vs unhedged, **after-tax** benchmarks for taxable books when relevant.
- **Blended benchmarks** — 60/40 or custom policy mixes when IPS defines them.
- **Don’t cherry-pick** — if workspace doesn’t store a benchmark series, say so; use **`yahoo_finance`** for index proxies when aligned with user consent.

## Desk phrasing

- Always pair a number with **period** (ITD, YTD, 3Y ann.) and **currency**.
- When product metrics are absent, guide the user on **what to export** from custodian vs what xChat can approximate from **`portfolio_summary`**.
