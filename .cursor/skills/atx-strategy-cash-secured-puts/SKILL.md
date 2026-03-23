---
id: atx-strategy-cash-secured-puts
name: atx-strategy-cash-secured-puts
description: Cash-Secured Puts framework for TSLA, RKLB, and RDW with premium capture and discounted assignment entry.
---

# atxFinance Strategy: Cash-Secured Puts

## Core setup

- **Frequency:** Very High
- **Thesis:** Sell OTM puts on TSLA/RKLB/RDW; collect premium or acquire shares at a discount for compounding.
- **Risk profile:** Moderate (assignment obligation)

## Guardrails

- Ensure full cash collateral coverage per contract.
- Define acceptable assignment levels before entry.
- Use consistent position sizing per ticker volatility regime.

## Output format

1. Strike/expiration candidate.
2. Collateral and premium estimate.
3. Breakeven and assignment outcome.
4. Roll criteria and risk summary.
