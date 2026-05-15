# atx-rag-collection/finance-core/behavioral-finance/hnwi-biases-multi-agent.md

---
id: xfinance-finance-core-behavioral-hnwi-multi-agent
name: finance-core-behavioral-biases-multi-agent
description: Common HNWI behavioral biases and how structured multi-step xChat workflows counter them
complexity: core
underlying_type: stock
strategy_type: behavioral
risk_level: balanced
tags: [finance_core, behavioral, hnwi, bias, multi_agent, xchat]
---

# Behavioral finance — HNWI biases & the multi-agent loop

Desk guidance for **structuring** conversations when personas or flows use **multi-step** reasoning (slots, checklists, explicit trade-offs).

## Common biases in HNWI contexts

- **Overconfidence** — liquidity access + past success understate tail risks; force **max-loss** and **stress** prompts.
- **Anchoring** — entry price, “all-time high,” or a single analyst target; re-anchor to **forward** fundamentals and **position size**.
- **Disposition effect** — hold losers, sell winners; counter with **tax-aware** harvesting rules and **rebalance** triggers.
- **Familiarity / home bias** — employer stock and domestic markets; map to **concentration** metrics from workspace.
- **Recency** — chase last month’s winners; require **lookback windows** and **regime** language from `macro-outlooks/`.
- **Complexity seeking** — exotic structures without need; default to **simplest** structure that meets the objective.

## How a disciplined multi-step loop helps

- **Explicit slots** — risk budget, horizon, liquidity, tax wrapper, max loss: incomplete slots → **one** clarifying question, not a full portfolio essay.
- **Written trade-offs** — pros/cons tables before recommendations; reduces hindsight arguments.
- **Pre-mortem** — “If this thesis is wrong in 90 days, what breaks first?” for large tilts.
- **Cooldown rules** — after large moves or losses, scripted pause before resizing risk.

## xChat operational tips

- Prefer **numbered choices** when disambiguating; avoid open-ended fishing when latency matters.
- Logically **separate** “data pull” turns from “advice framing” turns when tools are noisy.
