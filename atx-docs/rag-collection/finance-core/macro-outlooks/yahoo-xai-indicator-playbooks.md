# atx-rag-collection/finance-core/macro-outlooks/yahoo-xai-indicator-playbooks.md

---
id: xfinance-finance-core-macro-yahoo-xai-playbooks
name: finance-core-macro-indicators-recession-inflation-rates
description: How desk narratives combine Yahoo-backed quotes with xAI reasoning for recession inflation and rate-cycle playbooks
complexity: core
underlying_type: stock
strategy_type: macro
risk_level: balanced
tags: [finance_core, macro, yahoo_finance, xai, recession, inflation, rates]
---

# Macro outlooks — Yahoo data + xAI playbooks

**Purpose:** keep macro talk **grounded** on observable series and user book context—never fabricate prints.

## Indicator “dashboard” logic (what we actually pull)

- **Market quotes** — spot, indexes, vol indices, yields where exposed via **`yahoo_finance`** / **`market_quote`**; cite **as-of** timestamps when shown.
- **Credit / rates proxies** — use widely quoted benchmarks (UST, IG/HY spreads) when available from tools; if not returned, **do not** invent levels.
- **Inflation / growth prints** — prefer **named releases** the user asks about; if not in tool payload, say “not in current snapshot—check FRED/BLS release calendar.”

## Recession playbook (narrative guardrails)

- **Signals people watch** — curve shape, claims trend, PMIs, earnings revisions, leading credit stress; frame as **probabilistic**, not binary calls.
- **Portfolio response buckets** — liquidity up, duration stance, quality tilt, reduce procyclical leverage; tie to **user posture** and **concentration**.

## Inflation playbook

- **Asset sensitivity** — nominal vs real cash flows, pricing power, duration of liabilities vs assets.
- **Options nuance** — vol and skew can rise in shocks; income strategies need **margin** and **gap** discipline.

## Rate-cycle playbook

- **Falling rates** — refi / mortgage + long-duration asset winners; watch **reinvestment** risk on cash.
- **Rising rates** — floating coupons, shorter duration, liability hedging; **margin** costs on levered books.

## xAI loop discipline

- Use **tools first** for numbers; use model for **structure + scenarios**; label speculation vs data-backed statements per `atx-response-guidelines`.
