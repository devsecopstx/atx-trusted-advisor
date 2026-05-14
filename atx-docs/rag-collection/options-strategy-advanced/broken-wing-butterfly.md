---
id: xfinance-strategy-broken-wing-butterfly
name: xfinance-strategy-broken-wing-butterfly
description: Broken wing butterfly — asymmetric wings for skewed payoff vs symmetric fly; defined risk when fully closed
strategy_type: broken_wing_butterfly
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [butterfly, skew, defined_risk, asymmetric]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Broken wing butterfly (BWB)

**One-sentence definition:** A **butterfly** with **unequal wings** (one side wider) so max profit / max loss / breakevens **shift** vs a symmetric fly — still **defined risk** if there is **no extra naked leg**.

**Best market conditions:** Mild **directional skew** with desire to reduce one-side cost vs symmetric fly; **IV** view on body vs wings.

**Risk bucket:** **Balanced** (defined risk when fully boxed; verify net debit/credit and strikes).

**Payoff profile (net debit D common; widths per wing; ×100):**

| | |
|--|--|
| **Max profit** | **Plateau** near body — model (often **fly width − D** in ideal zone) |
| **Max loss** | **Wider wing side** dominates worst case — compute per construction |
| **Breakeven** | **Two** strikes — model |

**Position sizing rules:** **1R = modeled max loss**; keep **≤1–2%** NAV per fly for balanced desks.

**Worked example (illustrative):** **SPY** put BWB: long **$480**, short **2× $490**, long **$495** — **asymmetric** put wings shift risk vs **$480/490/500** symmetric — **model** max loss if SPY **<< $480**.

**When to avoid:** If any leg leaves **unintended naked** exposure after partial fill; illiquid wings.

**Tax & assignment (HNWI — not tax advice):** Exercise on one wing only can break symmetry — **close combo** before expiry if policy requires.

**Quick reference**

| vs symmetric fly | BWB |
|------------------|-----|
| **Cost** | Often different debit/credit |
| **Skew** | Expresses directional bias |

## Guardrails

- Label **max profit / max loss / BE** **after** fills in ticket system.
- Confirm **margin** on skewed flies with broker **before** size-up.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary).

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

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
