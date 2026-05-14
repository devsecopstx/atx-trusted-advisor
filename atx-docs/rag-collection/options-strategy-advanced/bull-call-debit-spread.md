---
id: xfinance-strategy-bull-call-debit-spread
name: xfinance-strategy-bull-call-debit-spread
description: Bull call debit spread — long lower call, short higher call; defined risk bullish leverage
strategy_type: bull_call_debit_spread
risk_level: balanced
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [debit_spread, defined_risk, bullish, vertical]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Bull call debit spread

**One-sentence definition:** Buy a **lower-strike** call and sell a **higher-strike** call in the same expiry for a **net debit**, gaining leveraged upside with **capped risk**.

**Best market conditions:** Moderately **bullish**; prefer **IV not extreme** on entry (debit structures hurt if you buy rich vol without follow-through).

**Risk bucket:** **Balanced** (max loss = debit; max gain capped).

**Payoff profile (width W = K₂ − K₁, debit D per spread, ×100):**

| | |
|--|--|
| **Max profit** | **(W × 100) − D** at expiry if **≥ K₂** |
| **Max loss** | **D** if **≤ K₁** |
| **Breakeven** | **K₁ + (D / 100)** per share |

**Position sizing rules:** Risk **1R = D**; typical **≤0.5–1.5%** NAV per spread cluster unless policy allows more.

**Worked example (illustrative):** **SPY** **$500**, buy **$500** call, sell **$510** call, **30 DTE**, pay **$3.20** ($320). **W = $10** → max value **$1,000** → max profit **$680**; max loss **$320**; BE **$503.20**.

**When to avoid:** Strong bearish trend; very wide bid-ask on **OTM** short; earnings binary without sized risk.

**Tax & assignment (HNWI — not tax advice):** Early exercise uncommon on **OTM** shorts but monitor **dividends** on deep ITM shorts; closing spreads is usually a simple 1099-B line — lot sync with CPA.

**Quick reference**

| | Long call | Short call |
|--|-----------|------------|
| **Δ** | + | − |
| **Θ** | − | + |
| **Margin** | Debit paid | Defined by spread |

## Guardrails

- Short strike must be **≥** long strike + **1** strike step; verify width vs move needed.
- Exit if **−40 to −50%** of debit at policy drawdown unless roll thesis exists.

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

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
