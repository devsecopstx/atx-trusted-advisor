---
id: xfinance-strategy-zebra
name: xfinance-strategy-zebra
description: ZEBRA — zero extrinsic back ratio style construction; advanced directional with path risk
strategy_type: zebra
risk_level: aggressive
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [ratio, directional, path_dependent, extrinsic]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: ZEBRA (zero extrinsic back ratio)

**One-sentence definition:** A **ratio-style** options construction (e.g. sell **1** ATM-ish, buy **2** OTM on same side) engineered to **reduce extrinsic** vs naive debit spreads — still **directional** with **path-dependent** payoff.

**Best market conditions:** When desk model shows **edge** vs vanilla vertical on **same view**; **liquid** chain; ability to **adjust** fast.

**Risk bucket:** **Aggressive** (debit at risk; **gamma** near ATM; complexity).

**Payoff profile:** **Model-only** — no single universal formula; verify **max loss** includes gap scenarios.

| | |
|--|--|
| **Max profit** | Zone-based — risk graph |
| **Max loss** | Often **net debit** + adverse path; tail cases worse if unbalanced |
| **Breakeven** | Two roots typical — model |

**Position sizing rules:** **≤0.25–0.75%** NAV per ZEBRA for exploratory; scale only with **replay** history.

**Worked example (illustrative):** **NVDA** bullish ZEBRA-style sketch: sell **1× $130** call, buy **2× $145** calls, net **debit $D** — **must** run broker risk graph; numbers here are **placeholders** only.

**When to avoid:** Wide spreads; inability to babysit **last week**; unclear margin on ratio.

**Tax & assignment (HNWI — not tax advice):** Exercise/assignment on ratio legs → **complex** stock/option mix — CPA if material.

**Quick reference**

| | |
|--|--|
| **Edge claim** | Must be **model-verified**, not marketing |
| **Roll** | Pre-scripted |

## Guardrails

- Paper-trade **3** cycles before live if desk is new to ZEBRAs.
- Hard **time stop** if thesis not working by **T−5** to expiry.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary).

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

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
