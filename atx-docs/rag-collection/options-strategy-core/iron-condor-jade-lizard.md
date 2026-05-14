---
id: xfinance-strategy-iron-condor-jade-lizard
name: xfinance-strategy-iron-condor-jade-lizard
description: Iron condor and jade lizard — range-bound premium with defined-risk wings
strategy_type: iron_condor
risk_level: balanced
market_condition: range_bound
complexity: core
underlying_type: index
tags: [income, defined_risk, jade_lizard, skew, range_bound]
---

# xFinance Strategy: Iron Condor & Jade Lizard

## One-sentence definition

Sell a call spread and a put spread (Iron Condor) or sell a put spread + naked OTM call (Jade Lizard) to collect premium in range-bound markets with defined maximum loss.

## Best market conditions

Range-bound or low-volatility outlook with elevated implied volatility. Works best on indexes (SPX, RUT) or high-quality stocks with good options liquidity.

## Risk bucket

**Balanced** (defined risk on Iron Condor; Jade Lizard has undefined upside risk on the naked call).

## Payoff Profile (Iron Condor)

| Metric          | Value                                      |
|-----------------|--------------------------------------------|
| **Max Profit**  | Net credit received                        |
| **Max Loss**    | Width of wider spread minus net credit     |
| **Breakeven**   | Short put strike − credit / Short call strike + credit |
| **Typical POP** | 65–75% when strikes are 10–15% OTM         |

## Position Sizing Rules

- Risk no more than 1–2% of portfolio per Iron Condor position
- Width of spreads: 10–25 points on indexes, 5–15 points on stocks
- Prefer 30–45 DTE for best premium-to-risk ratio

## Worked Example (SPY)

SPY @ $480. Sell:

- $460/$455 put spread for $1.20
- $500/$505 call spread for $1.10  
**Net credit:** $2.30  
**Max profit:** $230 per contract  
**Max loss:** $270 per contract (if price moves outside wings)

## When to Avoid

- Strong trending market
- Low implied volatility
- Earnings or major events within the next 7–10 days
- Poor liquidity on chosen strikes

## Tax & Assignment Notes (HNWI)

Iron Condors are usually closed before expiration to avoid assignment. Jade Lizards carry naked call risk — monitor closely. Track premium income as short-term capital gains.

## Quick Reference

| Strategy       | Risk Type          | Best For              | Key Risk          |
|----------------|--------------------|-----------------------|-------------------|
| Iron Condor    | Defined            | Range-bound           | Max loss if breached |
| Jade Lizard    | Defined downside   | Mildly bullish        | Naked call upside |

## Guardrails

- Always define max loss before entry
- Use alerts when price approaches short strikes
- Close or roll at 50% of max profit or when tested
- Never size based on premium alone — size based on risk

## Output Contract

Return only valid JSON.

```json
{
  "ideas": [
    {
      "ideaType": "iron_condor",
      "underlying": "[TICKER]",
      "strike": [NUMBER],
      "expiry": "YYYY-MM-DD",
      "premium": [NUMBER],
      "contractsRecommended": [1-5],
      "maxContracts": [NUMBER],
      "annualizedROC": [NUMBER],
      "probabilityOfProfit": [0-100],
      "assignmentRiskNote": "[Risk Level]. [Wings % OTM]. [Impact].",
      "rationale": "[Logic + liquidity + outlook. Max 220 chars.]"
    }
  ],
  "disclaimer": "Not financial advice. Past performance is not indicative of future results."
}
