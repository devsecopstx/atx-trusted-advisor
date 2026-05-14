---
id: xfinance-strategy-bull-put-credit-spread
name: xfinance-strategy-bull-put-credit-spread
description: Bull Put Credit Spread guide for defined-risk premium capture on TSLA pullbacks with reinvestment discipline.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Bull Put Credit Spread

## How Commonly Used

High

## Strategy

Sell OTM put spreads on TSLA dips for defined-risk income; reinvest proceeds into TSLA.

## Risk Profile

Moderate (limited max loss)

## Guardrails

- Keep spread width aligned with defined max-loss limits.
- Require explicit invalidation and exit logic.
- Avoid overlapping spread clusters around key event dates.

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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Low-moderate. Short strike ~8% OTM. Defined max loss at spread width.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

