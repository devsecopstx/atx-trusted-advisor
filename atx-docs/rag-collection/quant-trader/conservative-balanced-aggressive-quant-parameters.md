---
id: xfinance-quant-risk-tiers
name: xfinance-quant-risk-tiers
description: Risk-tier (conservative / moderate / aggressive) mapping, CVaR caps, default IV rank floors, drawdown tolerances, horizon guidance, and watchlist riskProfile → MC tier translation used by the quant-trader persona and xOptions Quant Trader panel.
category: quant-trader
strategy_type: quant_risk_tier
risk_level: balanced
complexity: core
underlying_type: portfolio
tags: [risk_tier, conservative, moderate, aggressive, cvar_cap, iv_rank_floor, drawdown_tolerance, watchlist_riskprofile]
---

# Quant Risk Tiers & Parameter Guidance

The Monte Carlo engine itself is parameter-agnostic. The tier system provides **guardrails and sensible defaults** for the `quant-trader` persona and the dedicated Quant Trader UI.

## Tier → CVaR Cap (soft guidance in tool responses)

| Tier          | Typical CVaR 95% Cap (10D) | Use Case | IV Rank Floor (typical) | Max Drawdown Gate (typical) | Horizon Default |
|---------------|----------------------------|----------|---------------------------|-------------------------------|-----------------|
| conservative  | ~8%                        | Capital preservation, retirement sleeves | ≥ 70–75                   | 10–12%                        | 30–45 days      |
| moderate      | ~12%                       | Balanced income + growth (most common)   | ≥ 55–60                   | 15–18%                        | 45 days         |
| aggressive    | ~18%                       | Growth / opportunistic books             | ≥ 40–45                   | 20–25%                        | 45–60 days      |

These caps are **not hard rejections** inside the simulator. They are used by the calling logic (persona prompt + xOptions panel) to color results, suggest stance, and decide whether to surface "this book is running hot relative to your stated risk profile."

## watchlist riskProfile / desk profile → MC Tier

Implemented in `mapWatchlistRiskProfileToMcTier` and the quant-trader preflight:

- `"conservative"` → conservative
- `"growth"` → aggressive
- anything else (moderate, balanced, null) → moderate

The persona is instructed to respect the pre-computed `riskLevel` on each portfolio in the workspace summary unless the user explicitly overrides ("treat this book as aggressive for the sim").

## Recommended Starting Filters by Tier (for NL → tool args)

When the user says "run a Monte Carlo on my wheel book" without numbers, the quant-trader persona supplies:

- conservative: `minIvRankPct: 70`, `maxDrawdownPct: 12`, `horizonDays: 30`
- moderate:    `minIvRankPct: 55`, `maxDrawdownPct: 15`, `horizonDays: 45`
- aggressive:  `minIvRankPct: 40`, `maxDrawdownPct: 22`, `horizonDays: 45`

These are starting points only — the user can always override in natural language.

## Why these numbers?

- CVaR caps were chosen so that a "moderate" 45-day wheel book on a typical diversified IA portfolio has roughly a 1-in-20 chance of a 12% tail loss under the modeled regime — a level most professional desks consider "noticeable but survivable."
- IV rank floors ensure the simulation only includes names that are actually expensive on a relative basis (the whole point of the wheel / income sleeve).
- Drawdown gates prevent the model from cheerfully reporting "only 9% VaR" while having a 35% probability of a 25% account drawdown (common when short premium is concentrated).

**All parameters are desk conventions and are expected to evolve.** The authoritative source is this document + the constants in the engine source. When a trader asks "why did you use 55% IV rank floor?", cite this file.

*Educational only. Not investment advice.*
