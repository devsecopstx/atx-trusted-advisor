---
id: xfinance-strategy-calendar-spread
name: xfinance-strategy-calendar-spread
description: Calendar spread — same strike, different expiries; trade near-term decay vs longer-dated vega.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Calendar spread

**One-sentence definition:** **Long** a **far-dated** option and **short** a **near-dated** option at the **same strike** (calls or puts) — you pay net debit and bet on **term structure + vol path** near the short expiry.

**Best market conditions:** Expect **near-term theta** to decay faster than long-leg decay; stable-ish spot around strike into front expiry; vol regime you can articulate.

**Risk bucket:** **Balanced** (can become **Aggressive** if oversized — **vega** shocks hurt long leg).

**Payoff profile:** **Path-dependent** — no single clean max like a vertical; at front expiry: P/L ≈ value(long) − value(short) given spot.

| Desk view | |
|-----------|--|
| **Max loss (practical bound)** | Often approx **net debit** if both legs worthless / mismanaged — model in platform |
| **Max profit** | Model near strike at short expiry; **not** unlimited |
| **Breakeven** | **Two** roots — use risk graph |

**Position sizing rules:** **1R ≈ net debit** for starter policy; size small vs NAV because **gamma/vega** flip near ATM.

**Worked example (illustrative):** **SPY** **$500** strike, **short 2W** call **$2.00**, **long 8W** call **$5.80**, net debit **$3.80** ($380/ spread). Profit zone often **near $500** into short expiry if vol behaves — **verify** with tool, not napkin.

**When to avoid:** Huge directional drift away from strike; front-week **binary** events; illiquid back month.

**Tax & assignment (HNWI — not tax advice):** Rolling shorts creates **multiple** gain/loss events — track for ST/LT mix; assignment uncommon on calendars but **exercise** risk on ITM shorts exists — broker policy.

**Quick reference**

| Leg | Primary exposure |
|-----|------------------|
| Short near | **+Θ**, **−Vega** (simplified) |
| Long far | **−Θ**, **+Vega** |

## Guardrails

- Plan **roll or close** of short leg **T−2** if liquidity thins.
- Never assume “free theta” — **IV crush** on long leg can dominate.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary). For holdings + watchlist prompts, return up to **three** `ideas` when supported.

```json
{
  "ideas": [
    {
      "ideaType": "calendar_spread",
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
