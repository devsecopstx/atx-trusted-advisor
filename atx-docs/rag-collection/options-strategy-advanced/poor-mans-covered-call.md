---
id: xfinance-strategy-poor-mans-covered-call
name: xfinance-strategy-poor-mans-covered-call
description: Poor Man's Covered Call structure using 2027 LEAP exposure plus short OTM calls for leveraged income.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Poor Man's Covered Call

## How Commonly Used

High

## Strategy

Buy a 2027 LEAP call and sell short OTM calls on TSLA; target leveraged income toward long-term growth goals.

## Risk Profile

Moderate-Aggressive (LEAP leverage)

## Guardrails

- Validate LEAP delta/depth before short-call overlays.
- Monitor time decay and IV regime shifts each roll cycle.
- Enforce roll/defense triggers if short leg approaches ITM early.

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

