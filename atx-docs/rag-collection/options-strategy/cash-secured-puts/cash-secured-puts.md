---
id: xfinance-strategy-cash-secured-puts
name: xfinance-strategy-cash-secured-puts
description: Cash-Secured Puts framework for TSLA, RKLB, and RDW with premium capture and discounted assignment entry.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Cash-Secured Puts

## How Commonly Used

Very High

## Strategy

Sell OTM puts on TSLA/RKLB/RDW; collect premium or acquire shares at a discount for compounding.

## Risk Profile

Moderate (assignment obligation)

## Guardrails

- Ensure full cash collateral coverage per contract.
- Define acceptable assignment levels before entry.
- Use consistent position sizing per ticker volatility regime.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "cash_secured_put",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. ~12% OTM. Assignment adds shares at effective cost below spot.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

