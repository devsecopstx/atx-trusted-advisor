---
id: xfinance-strategy-diagonal-spread
name: xfinance-strategy-diagonal-spread
description: Diagonal spread — long far option + short near option at different strikes; theta harvest with directional bias
strategy_type: diagonal_spread
risk_level: aggressive
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [time_spread, rolls, theta, leveraged_carry]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Diagonal spread

**One-sentence definition:** Hold a **longer-dated** option and repeatedly sell **shorter-dated** options against it (often **different strikes**), blending **calendar** and **vertical** behavior.

**Best market conditions:** **Bullish** (call diagonal) or **bearish** (put diagonal) with plan to **roll shorts**; back month **liquid**.

**Risk bucket:** **Aggressive** vs single verticals — path, **vega**, and **roll cadence** dominate outcomes.

**Payoff profile:** **Path-dependent** — use platform risk graph; **practical max loss** often anchored to **net debit** + management rules.

| | |
|--|--|
| **Max profit** | Model at short expiries — not a single formula |
| **Max loss (policy)** | Desk may cap at **initial debit + roll debits** |
| **Breakeven** | Two-sided — model |

**Position sizing rules:** **≤0.5–1%** NAV per diagonal chain for first tranche; scale only after roll P/L distribution known.

**Worked example (illustrative):** **NVDA** call diagonal: long **Jan** **$100** call, roll **weekly** **$110** short calls against it — each roll is its own **credit/debit** event; track **cumulative** roll P/L separate from LEAP mark.

**When to avoid:** Illiquid LEAPs; trend that blows through short strike without roll liquidity; inability to monitor **weekly**.

**Tax & assignment (HNWI — not tax advice):** Frequent rolls → many **short-term** events; LEAP may be **LT** if held >1y separately — **straddle** tax rules may apply if positions offset — CPA mandatory for large notionals.

**Quick reference**

| Leg | Role |
|-----|------|
| Long back | **+Vega**, **−Θ** |
| Short front | **+Θ**, stabilizes carry |

## Guardrails

- Long leg **DTE** should materially exceed shorts (e.g. **≥3×**).
- Cap **open rolls** if cumulative credits cannot offset a gap move.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "diagonal_spread",
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
