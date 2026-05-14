---
id: xfinance-strategy-diagonal-spread
name: xfinance-strategy-diagonal-spread
description: Diagonal Spread playbook using long-dated LEAP calls and short near-term calls on TSLA and selected proxies.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Diagonal Spread

## How Commonly Used

Medium-High

## Strategy

Use a long far-term LEAP call plus a short near-term call on TSLA/proxies to combine theta capture and upside participation.

## Risk Profile

Moderate-Aggressive (time/volatility flexibility risk)

## Guardrails

- Keep long-leg duration materially beyond short-leg expiration.
- Track term-structure and volatility shifts per roll decision.
- Enforce consistent strike laddering and max open diagonal count.

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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. Short leg ~6% OTM. Roll short if delta rises.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

