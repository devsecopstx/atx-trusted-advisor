---
id: xfinance-strategy-ratio-spread
name: xfinance-strategy-ratio-spread
description: Ratio spreads (e.g. 1×2, 1×3) — unequal legs for directional or vol skew; advanced capital efficiency with tail risk to manage.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Ratio spread

## How Commonly Used

Medium (advanced / pro-oriented)

## Strategy

Open a **ratio spread**: typically buy one closer strike and sell two (or more) further OTM strikes on the same side (calls or puts), or the inverse pattern depending on bias. Used for skewed payoff and capital efficiency versus a simple vertical; the **short extra longs** create **tail risk** that must be sized and monitored.

## Risk Profile

Aggressive (uncapped or large tail risk on the “naked” side of the ratio without further protection)

## Guardrails

- Size the short leg count so a gap move cannot exceed the account’s risk budget; assume assignment and gap risk explicitly.
- Prefer liquid series; wide bid/ask on ratio structures magnifies model error.
- Plan adjustments or exits **before** the structure becomes a one-sided naked profile you did not intend.
- Educational context only; not financial advice — confirm suitability with your own policy and compliance constraints.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "ratio_spread",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `High. Short leg ratio > long. Tail risk if move overshoots.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

