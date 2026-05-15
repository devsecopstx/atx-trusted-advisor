---
id: xfinance-strategy-monte-carlo-wheel
name: xfinance-strategy-monte-carlo-wheel
description: Monte Carlo tail-risk simulation for 45-day covered-call wheel books — path engine, IV rank gates, max drawdown constraints, multi-portfolio scope (aligns with atx_function monte_carlo_tail_risk).
strategy_type: quant_monte_carlo
risk_level: balanced
market_condition: high_volatility
complexity: core
underlying_type: portfolio
tags: [monte_carlo, wheel, covered_call, iv_rank, drawdown, var, cvar, multi_portfolio]
---

<!-- OUTPUT CONTRACT: Narrative desk playbook for quant-trader + file_search; tool JSON remains source of truth for numbers. -->

# xFinance quant desk: Monte Carlo wheel simulation

**One-sentence definition:** Simulate **book-level** P&L paths for a **45-day** (or user-specified) **wheel / covered-call** horizon using correlated equity shocks, optional Poisson jumps, and Yahoo ATM IV — then report **VaR**, **CVaR**, and **P(drawdown)** with user filters (**IV rank ≥ 60%**, **max 15% drawdown**).

## When to run (NL → tool, no clarification)

| User phrase | Action |
|-------------|--------|
| "Monte Carlo" + "wheel" / "covered call" | `monte_carlo_tail_risk` |
| "across my portfolios" / "all portfolios" / "my three portfolios" | `portfolioScope: "all"`, `perPortfolioRisk: true` — **never** ask which books |
| "IV rank > 60%" | `minIvRankPct: 60` — filter holdings per book before paths |
| "max 15% drawdown" | `maxDrawdownPct: 15` — drawdown gate on simulated paths |
| "45-day" | `horizonDays: 45` — chain pick ≈ nearest expiry to horizon |

**Count mismatch:** If the user says "three portfolios" but preflight lists two, simulate **every owned book** in the workspace summary and note the count in the reply.

## Path engine (aligned with production)

| Layer | Setting | Notes |
|-------|---------|-------|
| **Base process** | Log-normal daily returns with **Student-t** (ν≈6) shocks | Fat tails vs Gaussian-only |
| **Correlation** | Base ρ≈0.35; **stress correlation crush** ρ≈0.85 slice | Second stress table in tool JSON |
| **Vol stress** | **2020 vol spike** multiplier (~2.5× ATM IV) | Separate stress VaR/CVaR |
| **Jumps** | Poisson (~1.5/yr), log-normal jump size | Gap risk on concentrated books |
| **Paths** | Default **10k** workspace paths; stress cap **12k** | Raise only when user asks for convergence study |
| **Chains** | Yahoo nearest-expiry to `horizonDays` | ATM IV drives per-name σ; missing chain → desk default σ |

## Convergence checks (desk)

1. Re-run at **2× paths** if 1D vs 10D VaR ordering looks inverted or P(DD>20%) is noisy (±2pp swing).
2. Compare **per-portfolio** vs **combined weighted** tail — combined is not sum of VaRs.
3. If IV filter removes all names, report "no holdings passed IV rank floor" per book — do not invent symbols.

## Wheel-specific modeling notes

- **CSP leg:** Collateral and assignment shift effective weights — engine uses **current equity notionals** from workspace positions.
- **Short calls:** Greeks rollup in tool output; narrate **delta notional** and **theta/day** from JSON only.
- **Reinvestment:** Monte Carlo paths do **not** auto-reinvest premiums unless a future job spec says so — state that assumption when user asks about "reinvest all premiums."

## Example NL mapping

> Run a Monte Carlo on my 45-day covered-call wheel across my three portfolios with current IV rank > 60% and max 15% drawdown.

```json
{
  "operation": "monte_carlo_tail_risk",
  "portfolioScope": "all",
  "perPortfolioRisk": true,
  "horizonDays": 45,
  "minIvRankPct": 60,
  "maxDrawdownPct": 15,
  "risk": "moderate"
}
```

## Guardrails

- Educational quant desk — not investment advice.
- Never fabricate holdings, portfolio ids, or tail metrics; use preflight + tool JSON.
- After metrics, offer **strategy_recommendations** or **xOptions Hardcore jobs** for saved artifacts.

*Not financial advice.*
