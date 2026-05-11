---
id: xfinance-strategy-iron-condor
name: xfinance-strategy-iron-condor
description: Iron Condor framework for range-bound premium capture on KTOS/PLTR and defense proxies with defined risk.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Iron Condor

## How Commonly Used

Medium-High

## Strategy

Deploy range-bound short spreads on KTOS/PLTR defense proxies; harvest premium for TSLA reinvestment.

## Risk Profile

Moderate (defined risk if range holds)

## Guardrails

- Set wings and width consistently with account risk budget.
- Avoid low-liquidity strikes and unstable bid/ask conditions.
- Use proactive adjustment rules when price approaches short strikes.

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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. Wings ~15% OTM. Max loss if underlying exits short strikes.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

