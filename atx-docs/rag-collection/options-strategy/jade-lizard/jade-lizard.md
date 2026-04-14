---
id: xfinance-strategy-jade-lizard
name: xfinance-strategy-jade-lizard
description: Jade lizard — short OTM put plus short call spread for neutral-to-bullish income with capped risk on the call side.
---

# xFinance Strategy: Jade lizard

## How Commonly Used

Medium

## Strategy

Combine a **short OTM put** with a **short call spread** (short nearer call, long further OTM call). Goal is **net credit** (or very small debit) with **no naked call risk above the long call**; primary risk remains on the **put** side (assignment / downside). Fits **neutral-to-slightly-bullish** views where call upside is not the main bet.

## Risk Profile

Moderate (put downside and assignment; call side defined by the long wing)

## Guardrails

- Ensure the call spread is fully covered by the long call — do not leave a naked short call.
- Size the short put for cash-secured or margin rules you actually run under.
- Track earnings, dividends, and early assignment on the put leg.
- Educational context only; not financial advice — do not cite hypothetical backtests as product proof.
