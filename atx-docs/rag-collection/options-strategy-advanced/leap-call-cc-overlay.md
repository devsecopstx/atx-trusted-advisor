---
id: xfinance-strategy-leap-call-cc-overlay
name: xfinance-strategy-leap-call-cc-overlay
description: LEAP call plus covered-call-style short overlays — aggressive bullish carry with path risk
strategy_type: leap_call_overlay
risk_level: aggressive
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [leap, covered_call_overlay, income, leverage]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: LEAP call + covered-call overlay

**One-sentence definition:** Own a **long-dated ITM call** and sell **short-dated OTM calls** (often weekly) against it to harvest **premium** while keeping **levered upside** until shorts cap further gains.

**Best market conditions:** **Bullish** grind-up; **liquid** LEAP and weeklies; operator bandwidth to **roll shorts**.

**Risk bucket:** **Aggressive** (leverage + gamma on shorts + LEAP decay if stock stalls).

**Payoff profile:** Same family as **PMCC** — model on platform; **policy max loss** often **LEAP debit + rolls**.

| | |
|--|--|
| **Max profit** | Path: short credits + LEAP intrinsic rise (capped by short strikes over window) |
| **Max loss** | Anchor **LEAP debit** if thesis breaks |
| **Breakeven** | Multi-segment — model |

**Position sizing rules:** Treat overlay book as **single risk chain**; cap **≤1–2%** NAV on LEAP debit; shorts **never** exceed long contracts.

**Worked example (illustrative):** **NVDA** LEAP **$90** call **Jan next** @ **$42** ($4,200); sell **$140** weekly call @ **$1.20** — track **cumulative short credits** vs LEAP mark weekly.

**When to avoid:** Earnings without width to breathe; IV collapse on LEAP; inability to manage **rolls**.

**Tax & assignment (HNWI — not tax advice):** Short assignment can create **hedge stock** or exercise chain — broker-dependent; CPA for large books.

**Quick reference**

| Risk | Mitigation |
|------|------------|
| **Short ITM** | Roll **up/out** or buy back |
| **LEAP IV down** | Size smaller; diversify expiries |

## Guardrails

- Stress **−30%** underlying + **−10 IV pts** on LEAP before entry.
- Stop adding shorts if **3** consecutive rolls net **debit**.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). Use **`diagonal_spread`** `ideaType` for LEAP + short-call overlay unless your enum adds `leap_overlay`.

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

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
