---
id: xfinance-strategy-covered-calls
name: xfinance-strategy-covered-calls
description: Covered Calls playbook for TSLA shares with weekly/bi-weekly OTM call sales and premium reinvestment.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Covered Calls

## How Commonly Used

Very High

## Strategy

Sell 3-10% OTM weekly/bi-weekly calls on TSLA shares; reinvest premiums to grow TSLA holdings.

## Risk Profile

Moderate (capped upside)

## Guardrails

- Confirm shares are owned before recommending short calls.
- Maintain assignment-aware decision points near expiration.
- Preserve tax/event-awareness notes for rolling decisions.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "covered_call",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Low-moderate. ~8% OTM. Call-away caps upside above strike on share inventory.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

