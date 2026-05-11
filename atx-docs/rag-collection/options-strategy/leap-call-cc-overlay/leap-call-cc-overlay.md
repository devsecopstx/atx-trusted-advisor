---
id: xfinance-strategy-leap-call-cc-overlay
name: xfinance-strategy-leap-call-cc-overlay
description: LEAP Call plus Covered Call Overlay for aggressive TSLA exposure using long-dated ITM LEAPs and short weekly calls.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: LEAP Call + CC Overlay

## How Commonly Used

Medium

## Strategy

Hold a long 2028 ITM TSLA LEAP and sell weekly covered-call style overlays for accelerated income and growth.

## Risk Profile

Aggressive (high leverage and decay)

## Guardrails

- Enforce leverage caps relative to total portfolio NAV.
- Require monthly stress checks for gap-risk and volatility shocks.
- Track LEAP theta/vega decay separately from overlay income.

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

