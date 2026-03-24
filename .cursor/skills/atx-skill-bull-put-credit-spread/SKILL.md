---
name: atx-skill-bull-put-credit-spread
description: Bull put credit spread guide for defined-risk premium collection on bullish/neutral setups. Use when the user asks for put credit spread strikes, probability-focused income setups, or downside-defined premium trades.
---

# atx-skill Bull Put Credit Spread

## Core setup
- Sell higher-strike put, buy lower-strike put (same expiration).
- Receive net credit; thesis is price stays above short strike.
- Defined max loss from spread width minus net credit.

## Guardrails
- Keep spreads sized to max-loss budget.
- Include break-even and probability framing.
- Include plan for tested short strike.

## Output format
1. Short/long strike proposal.
2. Credit, max profit, max loss, breakeven.
3. Management triggers.
4. Risk summary.
