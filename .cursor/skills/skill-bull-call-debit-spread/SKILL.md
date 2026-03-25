---
name: skill-bull-call-debit-spread
description: Bull call debit spread framework for leveraged bullish exposure with capped risk and reward. Use when the user asks for call spread setups, cost-reduced bullish trades, or defined-risk upside structures.
---

# skill Bull Call Debit Spread

## Core setup
- Buy lower-strike call, sell higher-strike call (same expiration).
- Pay net debit; thesis is moderate upside into expiry.
- Max gain capped at strike width minus debit.

## Guardrails
- Keep strike width aligned to expected move.
- Always compute breakeven and max risk clearly.
- Include early-profit/decay exit guidance.

## Output format
1. Strike/expiration setup.
2. Debit, max gain/loss, breakeven.
3. Price-path scenarios.
4. Exit/adjustment plan.
