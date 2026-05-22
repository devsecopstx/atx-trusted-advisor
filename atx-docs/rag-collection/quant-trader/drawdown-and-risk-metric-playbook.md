---
id: xfinance-quant-drawdown-risk-metrics
name: xfinance-quant-drawdown-risk-metrics
description: VaR, CVaR, max drawdown simulation, and user drawdown-gate logic used by the quant-trader persona when running Monte Carlo tail risk.
category: quant-trader
strategy_type: quant_risk_metrics
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: portfolio
tags: [var, cvar, drawdown, tail_risk, monte_carlo, risk_gate]
---

# Quant Trader: Drawdown & Risk Metrics

**One-sentence definition:** How `monte_carlo_tail_risk` computes and reports tail loss numbers, and how a user-supplied `maxDrawdownPct` becomes an enforceable gate in the results.

## Core metrics returned by the tool

| Metric                      | JSON field                  | Meaning |
|----------------------------|-----------------------------|---------|
| 1D / 10D VaR (95%)         | `var1dPct95`, `var10dPct95` | Positive loss magnitude at the 95th percentile |
| 1D / 10D CVaR              | `cvar1dPct95`, `cvar10dPct95` | Average loss in the tail beyond VaR |
| P(drawdown > X%)           | `probDrawdownGt20Pct` (or threshold) | Fraction of simulated paths that breached the drawdown level |

Stress views (`stress2020VolSpike`, `stressCorrelationCrush`) repeat the same metrics under stressed conditions.

## User-supplied drawdown constraint

When the trader says “max 15% drawdown”:

1. Pass `maxDrawdownPct: 15` to the tool.
2. Read `drawdownGate` object per portfolio:
   - `probDrawdownGtThresholdPct`
   - `passed` (true if probability of breach is acceptable per tier)
3. If the gate fails, surface concrete recommendations (reduce concentration, add hedges, shorten horizon).

## Risk-tier drawdown budgets

See `conservative-balanced-aggressive-quant-parameters.md` for the current caps per risk stance.

## When to cite this document

Any time a user asks:
- “What does CVaR actually mean here?”
- “How is the drawdown probability calculated?”
- “Why did this book fail the max drawdown gate?”

→ Retrieve with `category = "quant-trader"` and `strategy_type = "quant_risk_metrics"`.

*Educational quant desk only — not investment advice.*
