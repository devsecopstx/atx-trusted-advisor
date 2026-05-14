---
id: xfinance-strategy-poor-mans-covered-call
name: xfinance-strategy-poor-mans-covered-call
description: Poor man's covered call — long LEAP call as stock substitute + short OTM calls for income; leverage + decay risk
strategy_type: poor_mans_covered_call
risk_level: conservative
market_condition: bullish
complexity: advanced
underlying_type: stock
tags: [income, leap, leverage, pmcc, covered_call_style]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Poor man's covered call (PMCC)

**One-sentence definition:** Buy a **deep ITM long-dated call** (LEAP) and sell **shorter OTM calls** against it to simulate covered-call income **without** owning 100 shares outright.

**Best market conditions:** **Bullish** quality names; **LEAP bid/ask** reasonable; plan to **roll shorts** through cycles.

**Risk bucket:** **Aggressive** (LEAP can decay; short calls cap upside on the **synthetic** stock story).

**Payoff profile:** Path-dependent; **max loss** often modeled as **LEAP debit** if short calls expire worthless but LEAP collapses — use platform.

| Desk anchor | |
|-------------|--|
| **Max loss (policy)** | Initial **LEAP debit** + net roll debits (simplified cap) |
| **Max profit** | Capped near **short strike + roll credits** vs LEAP intrinsic path |
| **Breakeven** | Model across rolls — not one number |

**Position sizing rules:** LEAP notional ≈ **delta × 100 × contracts** as rough share equiv; keep **short call ≤ LEAP contracts**; cap **≤1–2%** NAV on LEAP debit for starter.

**Worked example (illustrative):** **SPY** LEAP long **$400** call **18mo** costs **$115** ($11,500/contract); sell **monthly $500** call for **$2** — must ensure **short ≤ long** contracts and margin for **diagonal** per broker.

**When to avoid:** High **rates** / carry hurting long calls; bear trend; LEAP **wide spread** eats edge.

**Tax & assignment (HNWI — not tax advice):** PMCC is not identical stock for **holding period** / **dividend** treatment — CPA; short calls can be assigned → **short stock** hedge risk if broker auto-hedges.

**Quick reference**

| | LEAP long | Short call |
|--|-----------|------------|
| **Δ** | High + | Smaller − |
| **Margin** | **PM** rules — not standard covered |

## Guardrails

- Only open if **extrinsic** on LEAP is **controlled** vs your roll edge.
- If short goes **ITM**, have **roll/close** plan before **ex-div**.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). Map automation to **`diagonal_spread`** when PMCC is the active structure (long-dated + short-dated calls) unless your surface adds a dedicated enum.

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
