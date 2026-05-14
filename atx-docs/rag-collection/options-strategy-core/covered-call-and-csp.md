---
id: xfinance-strategy-covered-call-csp
name: xfinance-strategy-covered-call-csp
description: Covered Call and Cash-Secured Put strategies – core income generation tools with defined mechanics and risk management.
---

# xFinance Strategy: Covered Call & Cash-Secured Put (CSP)

## Covered Call

**One-sentence definition:** Own shares and sell an OTM call against them to collect premium while capping upside.

**Best market conditions:** Neutral to moderately bullish with elevated IV.

**Risk bucket:** **Balanced**

**Payoff (per 100 shares + 1 short call):**

- Max Profit: Strike − basis + premium (capped)
- Max Loss: Stock to $0 minus premium
- Breakeven: Basis − premium

**Position Sizing:** 1 call per 100 shares owned. Limit to stocks you are comfortable owning long-term.

**Worked Example:** NVDA @ $120 basis, sell $130 call 45 DTE for $2.50. Max gain if called = $1,250 + premium.

**When to Avoid:** Strong bullish conviction you refuse to cap; illiquid options; tax-sensitive lots.

**Tax & Assignment:** Call-away can trigger gains and affect qualified dividend status. Track carefully.

**Quick Reference**

| Metric | Value                  |
|--------|------------------------|
| Delta  | Net ~0.35–0.65         |
| Theta  | Positive               |
| POP    | Higher when more OTM   |

## Cash-Secured Put (CSP)

**One-sentence definition:** Sell an OTM put with cash reserved to buy shares at the strike if assigned.

**Best market conditions:** Bullish or neutral with willingness to own the stock at a lower price.

**Risk bucket:** **Balanced**

**Payoff (short 1 put):**

- Max Profit: Premium received
- Max Loss: Strike × 100 − premium
- Breakeven: Strike − premium

**Position Sizing:** Cash reserved = strike × 100 × contracts. Respect concentration limits.

**Worked Example:** SPY @ $480, sell $460 put 30 DTE for $3.00. Effective buy price if assigned = $457.

**When to Avoid:** Bearish outlook; low liquidity; imminent binary events.

**Tax & Assignment:** Assignment sets cost basis. Watch dividend capture rules.

**Quick Reference**

| Metric | Value             |
|--------|-------------------|
| Delta  | Positive (rises)  |
| Theta  | Positive          |
| POP    | Higher when OTM   |

## Guardrails

- Never sell naked options without proper collateral
- Pre-define assignment handling rules
- Review weekly and roll or close as needed

## Output Contract

Return only valid JSON.

```json
{
  "ideas": [
    {
      "ideaType": "covered_call",
      "underlying": "[TICKER]",
      "strike": [NUMBER],
      "expiry": "YYYY-MM-DD",
      "premium": [NUMBER],
      "contractsRecommended": [1-5],
      "maxContracts": [NUMBER],
      "annualizedROC": [NUMBER],
      "probabilityOfProfit": [0-100],
      "assignmentRiskNote": "[Risk Level]. [% OTM detail]. [Impact].",
      "rationale": "[Logic + liquidity + outlook. Max 220 chars.]"
    }
  ],
  "disclaimer": "Not financial advice. Past performance is not indicative of future results."
}
