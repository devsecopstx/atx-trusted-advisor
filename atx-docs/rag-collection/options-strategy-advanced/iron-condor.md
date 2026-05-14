---
id: xfinance-strategy-iron-condor
name: xfinance-strategy-iron-condor
description: Iron condor — short OTM put spread + short OTM call spread; range income with defined wings (advanced depth).
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Iron condor (advanced)

**One-sentence definition:** Sell a **bull put spread** below the market and a **bear call spread** above the market (same expiry), collecting **net credit** if spot finishes between the **inner short strikes**.

**Best market conditions:** **Range-bound** or mean-reverting names; **IV elevated** vs realized you can harvest; width you can **adjust or close** before breach.

**Risk bucket:** **Balanced** (defined max loss = larger of wing widths minus credit, per standard symmetric IC construction).

**Payoff profile (net credit C; put wing Wₚ; call wing W꜀; ×100):**

| | |
|--|--|
| **Max profit** | **C** if spot expires between **short put** and **short call** |
| **Max loss** | **max(Wₚ, W꜀)×100 − C** at worst wing touch (standard box; verify your strikes) |
| **Breakevens** | **Short put − C/100** and **short call + C/100** |

**Position sizing rules:** Treat **1R** as max loss per IC; typical **≤1–3%** NAV per IC for balanced desks.

**Worked example (illustrative):** **SPY** **$500**, short **$480/$475** put spread + short **$520/$525** call spread, net **$1.20** ($120). Max profit **$120** OTM; if **$525** call side blown, loss bounded by **$5** wing minus credit (simplified).

**When to avoid:** Strong trend days; single-stock **gap** names; IV **too low** (credit tiny vs wing risk).

**Tax & assignment (HNWI — not tax advice):** Index options may carry **1256** treatment — confirm; equity IC on stocks: track **assignment** on short legs inside spreads.

**Quick reference**

| Zone | Greeks (simplified) |
|------|---------------------|
| **Center** | +Θ (collect time) |
| **Near short strike** | Gamma risk rises |
| **IV up** | Short vega hurts |

## Guardrails

- **Adjust** at **50% of max profit** or **X%** of width to short — pick one policy.
- Never run IC without **liquidity** on **all four** legs.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "iron_condor",
      "underlying": "[TICKER]",
      "strike": [NUMBER],
      "expiry": "YYYY-MM-DD",
      "premium": [NUMBER],
      "contractsRecommended": [1-5],
      "maxContracts": [NUMBER],
      "annualizedROC": [NUMBER],
      "probabilityOfProfit": [0-100],
      "assignmentRiskNote": "[Risk Level]. [Key risk detail with % OTM or buffer]. [Impact on position].",
      "rationale": "[Strategy logic + liquidity + outlook alignment. Max 220 characters.]"
    }
  ],
  "disclaimer": "Not financial advice. Past performance is not indicative of future results."
}
```

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
