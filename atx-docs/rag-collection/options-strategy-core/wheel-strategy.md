---
id: xfinance-strategy-wheel
name: xfinance-strategy-wheel
description: Wheel strategy workflow (CSP to CC cycle) with premium and assignment proceeds reinvested into TSLA shares or LEAPs.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Wheel Strategy

## How Commonly Used

High

## Strategy

CSP to CC cycle on TSLA/proxies; reinvest all premiums and assignment outcomes into TSLA shares/LEAPs.

## Risk Profile

Moderate-Aggressive (volatility and assignment risk)

## Guardrails

- Define transitions between CSP and CC states explicitly.
- Track cost basis and assignment events as first-class records.
- Enforce max allocation thresholds to avoid concentration drift.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "wheel",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. ~10% OTM on CSP leg. Assignment adds shares at lower effective basis.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

