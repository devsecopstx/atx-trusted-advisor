---
id: xfinance-strategy-bull-put-credit-spread
name: xfinance-strategy-bull-put-credit-spread
description: Bull put credit spread — short higher put, long lower put; collect credit for bullish / mild-bull premium with defined risk
strategy_type: bull_put_credit_spread
risk_level: balanced
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [credit_spread, defined_risk, bullish, premium]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Bull put credit spread

**One-sentence definition:** Sell a **higher-strike** put and buy a **lower-strike** put (same expiry) for **net credit**, profiting if the underlying stays **above the short put** at expiry.

**Best market conditions:** **Bullish** to **neutral**; elevated put IV vs your view; willing to cap loss at **width − credit**.

**Risk bucket:** **Balanced** (defined max loss).

**Payoff profile (width W = short − long strikes, credit C, ×100):**

| | |
|--|--|
| **Max profit** | **C** if **≥ short strike** |
| **Max loss** | **(W × 100) − C** if **≤ long put** |
| **Breakeven** | **Short strike − (C / 100)** |

**Position sizing rules:** **1R = (W×100) − C**; cap concurrent spreads so sum **1R** meets NAV policy.

**Worked example (illustrative):** **NVDA** **$120**, short **$110** put, long **$105** put, credit **$1.40** ($140). **W = $5** → max loss **$500 − $140 = $360**; max gain **$140**; BE **$108.60**.

**When to avoid:** Hard bearish trend; gap risk into short strike without roll plan; earnings if implied move can jump through width.

**Tax & assignment (HNWI — not tax advice):** Assignment can land **stock** if one leg exercises asymmetrically — monitor **ex-div** on ITM shorts; CPA for large notionals.

**Quick reference**

| Greek desk read | Short put | Long put |
|-----------------|-----------|----------|
| **Δ** | + (bullish premium) | − hedge |
| **Θ** | + collect | − pay |

## Guardrails

- Keep short strike **below** spot only if thesis supports; deeper OTM lowers credit but raises POP vs max loss efficiency trade-off.
- Predefine **roll to next cycle** vs **close at −X% max loss** rule.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "bull_put_spread",
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
