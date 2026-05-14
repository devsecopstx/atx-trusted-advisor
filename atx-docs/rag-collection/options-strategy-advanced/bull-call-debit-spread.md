---
id: xfinance-strategy-bull-call-debit-spread
name: xfinance-strategy-bull-call-debit-spread
description: Bull Call Debit Spread framework for leveraged bullish TSLA moves with capped risk and capped reward.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Bull Call Debit Spread

## How Commonly Used

Medium-High

## Strategy

Buy a lower-strike call and sell a higher-strike call on TSLA for leveraged bullish exposure with net debit.

## Risk Profile

Moderate (capped risk/reward)

## Guardrails

- Define max debit per spread and aggregate portfolio exposure.
- Require target/stop logic relative to spread value, not underlying only.
- Avoid earnings/event windows unless explicitly intended.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "bull_call_spread",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. Long leg ITM buffer. Debit capped at spread width.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

