# Aggressive Cash-Secured Puts on TSLA – Mid-Term Accumulation Skill

This skill teaches Cursor how to explain and structure aggressive cash-secured put selling on {symbol} (default: TSLA) targeting -10% OTM strikes with 30–50% cash allocation to buy discounted shares on assignment.

## Always Include First (Full Disclaimer – Never Omit/Shorten)
"Options involve risks and are not suitable for everyone. Individuals should not enter into options transactions until they have read and understood the options disclosure document, *Characteristics and Risks of Standardized Options*, available at OptionsEducation.org or from your broker/OCC. Commissions, fees, margin, interest, and taxes impact outcomes and are not included in examples. Strategies/examples are for illustrative/educational purposes only—not endorsements, recommendations, or solicitations to buy/sell. Past performance is not indicative of future results. © Options Clearing Corporation (OCC)."

## Core Rules for This Skill
- Default underlying: {symbol} = TSLA
- Strike selection: -8% to -12% OTM (aggressive: center around -10%)
- Allocation: 30–50% of available cash/margin buying power (aggressive tier)
- Duration: 30–60 days (monthly or 6–8 week expirations preferred)
- Goal: Collect premium → if assigned, acquire TSLA shares 8–12% below current price → immediately sell OTM covered calls to start wheel
- Risk emphasis: Obligation to buy 100 shares × contracts at strike if assigned; max loss = strike price – premium received (if TSLA → $0); requires full cash reserve (no naked puts)
- Reinvestment: All premiums + any excess cash → buy more TSLA shares or LEAP calls for compounding toward $10M portfolio by 2030

## Response Pattern (use this structure)
1. Current TSLA price + proposed -10% strike example
2. Premium estimate (hypothetical or last known chain data)
3. Cash required = (strike × 100 × contracts)
4. Breakeven = strike – premium received
5. Upside case: TSLA rallies → keep premium, repeat CSP
6. Downside case: Assignment → own shares cheaper, sell CCs
7. Aggressive adjustment: Roll down/out if deep ITM to avoid early assignment
8. Close with full disclaimer

## Quick Example Snippet (pattern to follow)
Aggressive CSP on TSLA (~$450):
- Sell JAN 2026 $405 put (-10% OTM) for ~$12.50 credit
- Cash required per contract: $40,500
- Breakeven: $392.50
- If assigned: Acquire 100 TSLA at effective $392.50 (12.8% discount)
- Then sell 5–10% OTM covered calls to generate income while holding for long-term growth

[Full disclaimer]

Reference: OIC standardized options education materials (June 2024).