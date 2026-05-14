---
id: xfinance-strategy-wheel
name: xfinance-strategy-wheel
description: Wheel strategy (CSP → Covered Call cycle) for systematic premium collection and assignment-aware income
strategy_type: wheel
risk_level: balanced
market_condition: neutral_to_bullish
complexity: core
underlying_type: stock
tags: [income, assignment, cost_basis_reduction, defined_risk]
---

# xFinance Strategy: Wheel Strategy

## One-sentence definition

Sell cash-secured puts to acquire shares at a discount, then sell covered calls against those shares to generate ongoing premium income in a repeatable cycle.

## Best market conditions

Neutral to mildly bullish outlook on quality names with elevated implied volatility. Ideal when you are comfortable owning the underlying long-term and want to lower effective cost basis through premium collection.

## Risk bucket

**Balanced to Moderate-Aggressive** (assignment risk on puts, upside cap on calls, concentration risk if not managed).

## Payoff Profile (per cycle)

| Metric              | Value                                      |
|---------------------|--------------------------------------------|
| **Max Profit**      | Premium from CSP + Premium from CC         |
| **Max Loss**        | Strike price minus total premiums received (if stock goes to zero) |
| **Breakeven**       | Put strike minus total net premium         |
| **Typical POP**     | 65–80% per leg when strikes are 10–20% OTM |

## Position Sizing Rules

- Cash-secured put: Lock cash equal to (strike × 100 × contracts)
- Covered call: 1 call per 100 shares owned
- Max allocation: Never exceed 5–8% of total portfolio per underlying in a single wheel position
- Reinvest premiums conservatively (do not over-concentrate)

## Worked Example (SPY)

SPY trading at $480.  

- Sell 1× $460 put, 30 DTE for $3.20 → collect $320  
- If assigned: effective purchase price = $456.80  
- Then sell 1× $500 call, 30 DTE for $2.80 → collect another $280  
- Total premium collected in cycle: $600 (1.25% return on capital at risk in ~60 days)

## When to Avoid

- Strong directional conviction (you expect a massive move up or down)
- Low implied volatility environment (premiums too small)
- Names with poor options liquidity or wide spreads
- When you cannot afford assignment (cash or margin constraints)

## Tax & Assignment Notes (HNWI)

Assignment on the put leg sets your cost basis. Covered call assignment may trigger capital gains. Track every premium and assignment event for tax-lot management. Consult your CPA — especially around qualified dividend holding periods and wash-sale rules.

## Quick Reference Table

| Metric     | CSP Leg          | CC Leg              |
|------------|------------------|---------------------|
| Delta      | Positive         | Negative            |
| Theta      | Positive         | Positive            |
| Max Profit | Premium only     | Premium + upside to strike |
| Key Risk   | Assignment       | Upside capped       |

## Guardrails

- Always have cash ready for assignment before selling the put
- Pre-define your exit/roll rules before entering the position
- Never let one wheel position exceed your defined allocation limit
- Review the position at least weekly

## Output Contract

Return **only** valid JSON (no markdown, no commentary).

```json
{
  "ideas": [
    {
      "ideaType": "wheel",
      "underlying": "[TICKER]",
      "strike": [NUMBER],
      "expiry": "YYYY-MM-DD",
      "premium": [NUMBER],
      "contractsRecommended": [1-5],
      "maxContracts": [NUMBER],
      "annualizedROC": [NUMBER],
      "probabilityOfProfit": [0-100],
      "assignmentRiskNote": "[Risk Level]. [Key detail with % OTM]. [Impact].",
      "rationale": "[Strategy logic + liquidity + outlook. Max 220 chars.]"
    }
  ],
  "disclaimer": "Not financial advice. Past performance is not indicative of future results."
}
