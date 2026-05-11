---
id: xfinance-strategy-calendar-spread
name: xfinance-strategy-calendar-spread
description: Calendar Spread process for short-term theta capture against longer-dated same-strike exposure on TSLA.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Calendar Spread

## How Commonly Used

Medium

## Strategy

Sell short-term and buy longer-term same-strike options on TSLA to target time-decay income.

## Risk Profile

Moderate (volatility differential risk)

## Guardrails

- Validate term-structure assumptions before opening.
- Monitor IV crush/expansion impact on both legs.
- Predefine roll timing for short leg into next cycle.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "calendar_spread",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. Near leg ~5% OTM. Theta decay vs long-leg vega risk.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

