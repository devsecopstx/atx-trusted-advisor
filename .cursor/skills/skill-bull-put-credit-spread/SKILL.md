---
name: skill-bull-put-credit-spread
description: Bull put credit spread guide for defined-risk premium collection on bullish/neutral setups. Use when the user asks for put credit spread strikes, probability-focused income setups, or downside-defined premium trades.
skill_family: options-strategy
last_updated: 2026-05-19
---

# skill Bull Put Credit Spread

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

## Skill maintenance

- **Family:** `options-strategy` — see [`skill-authoring.md`](../skill-authoring.md).
- **Last updated:** 2026-05-19 (bump frontmatter when guardrails or output format change).
