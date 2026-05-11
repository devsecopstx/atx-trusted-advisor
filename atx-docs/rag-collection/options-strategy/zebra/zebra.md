---
id: xfinance-strategy-zebra
name: xfinance-strategy-zebra
description: ZEBRA (zero-extrinsic back ratio) — back-ratio style directional structure with reduced extrinsic; advanced Greeks and capital discipline.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: ZEBRA (zero-extrinsic back ratio)

## How Commonly Used

Low–medium (niche; advanced)

## Strategy

A **ZEBRA** is a **back-ratio–style** construction (e.g. sell one ATM-ish option, buy two further OTM options on the same side, or the mirror for bearish setups) arranged so **extrinsic** is reduced relative to a naive debit spread or stock replacement story. Treat as **directional** with payoff shape driven by strikes, DTE, and net debit — not a generic “always lower capital than shares” claim without modeling.

## Risk Profile

Aggressive (directional; path-dependent; debit at risk; complexity in rolls and assignment)

## Guardrails

- Model delta, gamma, and theta through the intended hold window; ratio structures flip character quickly near ATM.
- Plan exit or roll rules before **very short DTE** where gamma dominates.
- Use only in liquid names unless slippage is explicitly budgeted.
- Educational context only; not financial advice — no implied guarantees vs stock or other structures.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "zebra",
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

**assignmentRiskNote** (≤180 chars): start with risk level (**Low**, **Low-moderate**, **Moderate**, **High**); include % OTM or buffer; end with position impact. Example: `High. Directional skew. Defined risk only if fully legged.`

**rationale** (≤220 chars): strategy logic + liquidity + outlook alignment only.

