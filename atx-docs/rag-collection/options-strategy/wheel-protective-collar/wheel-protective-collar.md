---
id: xfinance-strategy-wheel-protective-collar
name: xfinance-strategy-wheel-protective-collar
description: Defined-risk wheel entry — cash-secured put sold with a long protective put collar floor on the same expiry.
strategy_type: wheel_collar
risk_level: balanced
market_condition: high_volatility
complexity: multi_leg
underlying_type: stock
tags: [wheel, collar, protective_put, cash_secured_put, defined_risk, income]
---

# xFinance Strategy: Wheel + protective put collar

**One-sentence definition:** Sell a **cash-secured put** for wheel income while buying a **lower-strike long put** on the same expiry to cap assignment downside — defined-risk premium collection before the covered-call phase.

## Structure (entry leg)

| Leg | Side | Purpose |
|-----|------|---------|
| Short put | Sell | Wheel CSP — premium + optional assignment |
| Long put | Buy | Collar floor — limits max loss if assigned |

After assignment, transition to **covered call** overlay while retaining or rolling the long put per book policy.

## Desk filters (scanner defaults)

- **IV rank** ≥ **45%** (premium edge for sellers)
- **DTE** **21–45** (theta sweet spot aligned with Phase 3 scanners)
- **Short put |Δ|** ~**0.15–0.30** when chain supports it

## Output contract

Return **only** valid JSON when structured output is requested:

```json
{
  "ideas": [
    {
      "ideaType": "wheel_collar",
      "underlying": "[TICKER]",
      "shortPutStrike": 0,
      "longPutStrike": 0,
      "expiry": "YYYY-MM-DD",
      "netCredit": 0,
      "maxLossUsd": 0,
      "rationale": "Defined-risk wheel entry with collar floor."
    }
  ],
  "disclaimer": "Educational use only. Not financial advice."
}
```

*Not financial advice.*
