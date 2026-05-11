---
id: xfinance-strategy-broken-wing-butterfly
name: xfinance-strategy-broken-wing-butterfly
description: Broken wing butterfly — asymmetric long wings for defined risk and a skewed payoff vs a symmetric butterfly or iron fly.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Broken wing butterfly

## How Commonly Used

Medium (advanced)

## Strategy

Build a **butterfly** with **intentionally unequal wings**: e.g. long one lower strike, short two middle strikes, long one higher strike where the upper (or lower) wing is **wider** than the other. Shifts max-profit zone and buying power vs a symmetric fly; payoff is still **defined risk** when fully long/short as a closed structure (no extra naked pieces).

## Risk Profile

Moderate (defined risk when structured as a closed butterfly; outcome depends on width, net debit/credit, and where spot settles)

## Guardrails

- Label max profit, max loss, and breakeven(s) after fills; broken wings skew all three vs a symmetric fly.
- Avoid illiquid strikes; multi-leg inventory is hard to adjust in wide markets.
- Reconcile with margin and “worst case” at expiration under your broker’s methodology.
- Educational context only; not financial advice.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "butterfly",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `Moderate. Body near spot. Max loss equals net debit paid.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

