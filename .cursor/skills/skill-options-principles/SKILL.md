---
name: skill-options-principles
description: Foundational educational explanations of options concepts, Greeks, single-leg vs multi-leg trades, and risk rules (OIC/OCC aligned). Pairs with the 10 executable strategy playbooks.
---

# Options Principles: Introduction to Single and Multi-Leg Trades

This skill provides structured, educational explanations of basic options concepts, single-leg trades (calls/puts), and multi-leg strategies (spreads, straddles, etc.), based on OIC/OCC materials.

## Core Guidelines (Always Follow)
- Start every options-related response with this full disclaimer (do not shorten or omit):
  "Options involve risks and are not suitable for everyone. Individuals should not enter into options transactions until they have read and understood the options disclosure document, *Characteristics and Risks of Standardized Options*, available at OptionsEducation.org or from your broker/OCC. Commissions, fees, margin, interest, and taxes impact outcomes and are not included in examples. Strategies/examples are for illustrative/educational purposes only—not endorsements, recommendations, or solicitations to buy/sell. Past performance is not indicative of future results. All content © Options Clearing Corporation (OCC)."

- Use {symbol} as the placeholder for the underlying stock (e.g., replace with TSLA when explaining trades on Tesla).
- Keep explanations neutral, factual, and beginner-to-intermediate level.
- Differentiate clearly:
  - Single-leg: Buy/sell calls or puts individually.
  - Multi-leg: Combinations like vertical spreads, iron condors, butterflies, straddles/strangles, calendars.
- Always emphasize:
  - Time decay (theta), volatility (vega), Greeks basics.
  - Risk of total loss of premium (long options) or unlimited risk (naked short calls).
  - Assignment/early exercise risks.
  - No guarantees; consult tax/financial advisor.

## Structure for Explanations
When prompted about options on {symbol}:
1. Brief intro to calls vs puts.
2. Single-leg examples (e.g., long call on {symbol} for bullish view).
3. Multi-leg intro with payoff diagrams in text if possible.
4. Risk summary.
5. End with disclaimer reminder.

## Example Response Snippet (use this pattern)
For a prompt like "Explain a bull call spread on {symbol}":

Bull call spread on {symbol}:
- Buy lower-strike call.
- Sell higher-strike call (same expiration).
- Debit trade: max profit = difference in strikes minus net debit; max loss = net debit paid.
- Bullish to moderately bullish outlook.
- Benefits from moderate upside and time decay on short leg.

[Full disclaimer here]

Reference: OIC presentation by Edward J Modla, Executive Director, Investor Education, OCC (June 2024 materials).
