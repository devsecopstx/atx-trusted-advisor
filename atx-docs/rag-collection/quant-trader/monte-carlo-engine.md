---
id: xfinance-quant-monte-carlo-engine
name: xfinance-quant-monte-carlo-engine
description: Exact path generation, shock model, correlation & vol stress, jump process, path count, IV sourcing, and output metrics (VaR 95%, CVaR, P(drawdown)) for the book-level tail-risk Monte Carlo used by quant-trader persona and xOptions Quant Trader panel. Aligned with both workspace TS simulator and JVM MonteCarloTailRiskEngine.
category: quant-trader
strategy_type: quant_monte_carlo
risk_level: balanced
complexity: core
underlying_type: portfolio
tags: [monte_carlo, var, cvar, student_t, poisson_jumps, correlation, vol_stress, iv_rank, drawdown, multi_portfolio, greeks]
---

# Quant Trader Monte Carlo Engine — Calculation Transparency

**One-sentence definition:** Simulate thousands of correlated fat-tailed price paths for the actual holdings in one or more user portfolios over a chosen horizon, applying IV-derived volatility, optional Poisson jumps, and two stress regimes, then extract 95% VaR, CVaR, and probability of breaching a user-specified drawdown gate.

## Core Constants (current engine — May 2026)

All values are defined in `src/modules/strategy-options/monte-carlo-tail-risk.ts` (workspace/xChat path) and mirrored in the JVM `MonteCarloTailRiskEngine`.

| Parameter                  | Value          | Meaning / Rationale |
|---------------------------|----------------|---------------------|
| Trading days per year     | 252            | Standard equity convention |
| Degrees of freedom (ν)    | 6              | Student-t shocks for fat tails (vs Gaussian) |
| Base correlation (ρ)      | 0.35           | Typical equity book average |
| Stress correlation crush  | 0.85           | "Correlation crush" regime (everything moves together) |
| Vol spike multiplier      | 2.5×           | 2020-style vol event applied to ATM IV |
| Poisson jump intensity λ  | 1.5 / year     | ~1–2 gap events per year on average |
| Jump size (log)           | μ=-0.03, σ=0.06| Mild negative skew on jumps |
| Default σ (no chain)      | 0.45 (45%)     | Conservative desk default when Yahoo chain missing |
| Default paths (normal)    | 10,000         | Good convergence for 1D/10D VaR on typical books |
| Stress path cap           | 12,000         | Extra paths only for stress slices when requested |
| Risk-free rate (for Greeks)| 4.5%           | Used in BS Greeks rollup alongside MC |

## Path Generation Process (step by step)

1. **Scope resolution (preflight mandatory)**
   - Read `user_workspace_summary` + active `workspace snapshot`.
   - Resolve portfolioIds (explicit, active book, or `portfolioScope: "all"`).
   - For each portfolio, build list of equity holdings with current notionals (from `portfolio_positions`).

2. **IV & volatility per symbol**
   - For each holding, fetch nearest-expiry option chain to `horizonDays` via Yahoo.
   - Take ATM IV (average of nearest OTM call/put).
   - If no chain → `DEFAULT_SIGMA = 0.45`.
   - Apply IV rank filter if `minIvRankPct` supplied (pre-simulation symbol pruning).

3. **Daily shock generation (correlated Student-t)**
   - Draw multivariate Student-t shocks (ν=6) with correlation matrix ρ (base or crushed).
   - Scale by per-symbol σ (from step 2) × √(1/252).
   - Add deterministic drift (risk-free – q, simplified).

4. **Poisson jumps (rare but material)**
   - Each path independently draws number of jumps ~ Poisson(λ = 1.5 × horizon/365).
   - Each jump multiplies price by log-normal factor with the jump params above.
   - Introduces realistic gap risk on concentrated or high-beta books.

5. **Path simulation to horizon**
   - Geometric Brownian + jumps, daily steps.
   - Revalue the book (or synthetic wheel overlay when in wheel context) at each terminal point.
   - Track maximum drawdown along the path for the drawdown gate.

6. **Stress slices (always computed)**
   - **2020 vol spike**: all daily vols × 2.5, same paths.
   - **Correlation crush**: ρ → 0.85, same vols.
   - Report separate VaR/CVaR and P(DD>20%) for each stress regime.

7. **Output quantiles (95% unless overridden)**
   - `var1dPct95`, `var10dPct95`
   - `cvar1dPct95`, `cvar10dPct95` (expected shortfall in the tail)
   - `probDrawdownGt20Pct` (or user `maxDrawdownPct`)
   - Per-portfolio breakdown + weighted combined tail (not simple sum)
   - Greeks exposure rollup at t=0 (delta/gamma/theta/vega notional) from the same holdings snapshot

## Risk Tier Mapping & CVaR Caps (enforced in tool + UI)

See `conservative-balanced-aggressive-quant-parameters.md` for the full table. Quick reference:

- **conservative**: CVaR cap ~8%, tighter IV floors, lower drawdown tolerance
- **moderate** (default): CVaR cap ~12%
- **aggressive**: CVaR cap ~18%, higher IV rank tolerance allowed

The engine itself does not hard-reject paths; the caps are guidance used by the calling quant-trader logic and the xOptions Quant Trader panel when suggesting "risk stance".

## When the trader sees "how the calculation was made"

The `quant-trader` persona (and any future dedicated quant surface) is instructed to:

- After returning tail metrics from `monte_carlo_tail_risk`, offer or proactively retrieve the methodology using `file_search` / collections_search with `category = "quant-trader"` and `strategy_type = "quant_monte_carlo"`.
- Cite the exact constants above.
- Distinguish between the fast workspace simulator (10k paths, Redis-cached 5 min) and the heavier JVM engine used for saved "Hardcore" strategy jobs.
- Never claim the numbers are forecasts — always "illustrative simulations under the stated assumptions".

## Convergence & Validation Notes

- 10k paths is the production default for interactive use.
- If tail estimates look noisy, the engine supports requesting higher path counts (stress cap 12k).
- Cross-check: per-portfolio VaR vs portfolio-weighted combined tail (diversification benefit appears).
- IV rank pre-filter can remove names; the result explicitly lists `filteredSymbols`.

**Educational quant desk only — not investment advice. Past or simulated performance is not indicative of future results. All parameters are subject to periodic recalibration; the RAG document is the source of truth for the version the user saw.**

*Last aligned with engine constants: May 2026 (see `monte-carlo-tail-risk.ts` and JVM equivalent).*
