---
name: skill-cash-secured-puts
description: Cash-secured puts framework for TSLA/RKLB/RDW with discounted entry targeting and premium capture. Use when the user asks for CSP strikes, collateral sizing, assignment planning, or put-selling cadence.
---

# skill Cash-Secured Puts

## Core setup
- Sell puts only with full collateral reserved.
- Typical strike selection: 8-12% OTM for aggressive premium capture.
- Use 30-60 DTE windows unless user asks for shorter duration.

## Guardrails
- No uncovered short puts.
- Always state cash requirement: strike x 100 x contracts.
- Include assignment plan (accept shares vs roll).

## Output format
1. Strike/expiration candidate.
2. Collateral and premium estimate.
3. Breakeven and assignment outcome.
4. Roll criteria and risk summary.
