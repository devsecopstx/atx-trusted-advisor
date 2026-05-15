---
id: xfinance-strategy-drawdown-risk-metrics
name: xfinance-strategy-drawdown-risk-metrics
description: VaR, CVaR, max drawdown simulation, Calmar/Sortino framing for options books — enforcing user max drawdown constraints in Monte Carlo output.
strategy_type: quant_risk_metrics
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: portfolio
tags: [var, cvar, drawdown, sortino, calmar, tail_risk, monte_carlo]
---

# xFinance quant desk: Drawdown & risk metrics

**One-sentence definition:** Standardize how **quant-trader** reads and explains **tail metrics** from `monte_carlo_tail_risk` — and how user constraints like **max 15% drawdown** map to **drawdown gates** in tool JSON.

## Metric definitions (tool JSON fields)

| Metric | Field | Interpretation |
|--------|-------|----------------|
| **1D VaR (95%)** | `var1dPct95` | **Positive** = loss magnitude at 95% one-day quantile |
| **10D VaR (95%)** | `var10dPct95` | Same over ~10 trading days |
| **1D CVaR** | `cvar1dPct95` | Expected loss **beyond** VaR threshold (tail average) |
| **10D CVaR** | `cvar10dPct95` | 10-day tail average |
| **P(drawdown > 20%)** | `probDrawdownGt20Pct` | Fraction of paths exceeding **20%** peak-to-trough (0–1 in engine; display as %) |

**Stress slices:** `stress2020VolSpike`, `stressCorrelationCrush` — repeat VaR/CVaR under stressed ρ and vol.

## User max drawdown constraint

When the user specifies **max 15% drawdown**:

1. Pass `maxDrawdownPct: 15` to the tool.
2. Read `drawdownGate` per portfolio:
   - `probDrawdownGtThresholdPct` — P(exceeding **15%**)
   - `passed` — desk rule: **pass** if P(exceed) ≤ **50%** (document in reply)
3. If **fail**, recommend: trim concentration, add protective puts/collars, or shorten horizon — **no invented hedge sizes**.

## Calmar / Sortino (options context)

| Ratio | Desk use |
|-------|----------|
| **Calmar** | Annualized return / **max drawdown** — use **realized** or simulated DD from MC; state horizon |
| **Sortino** | Return / downside deviation — prefer for **income + short vol** books vs Sharpe |

These are **narrative supplements** when user asks — MC tool does not emit Calmar/Sortino directly; do not fabricate numerators.

## Risk tier budgets (1D CVaR caps)

| Tier | Approx 1D CVaR cap | Tool note field |
|------|-------------------|-----------------|
| Conservative | ~8% | `riskTierNote` / breach messaging |
| Moderate (balanced) | ~12% | default desk |
| Aggressive | ~18% | growth / high-beta books |

Compare `cvar1dPct95` to tier cap from book `riskLevel` or explicit user tier.

## Presentation template

1. **Headline** — combined or single-book 1D VaR + CVaR
2. **Drawdown gate** — user threshold vs simulated P(exceed)
3. **Stress** — 2020 vol + correlation crush one-liners
4. **Greeks rollup** — top delta/theta lines from JSON
5. **Disclaimer** — educational only

## Guardrails

- VaR/CVaR are **model outputs** (Student-t + jumps), not exchange guarantees.
- Repeat numbers **exactly** from tool JSON (one decimal on % is fine).

*Not financial advice.*
