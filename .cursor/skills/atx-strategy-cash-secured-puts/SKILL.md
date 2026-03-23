---
id: atx-strategy-cash-secured-puts
name: atx-strategy-cash-secured-puts
description: Cash-Secured Puts framework for TSLA, RKLB, and RDW with premium capture and discounted assignment entry.
---

# atxFinance Strategy: Cash-Secured Puts

## How Commonly Used

Very High

## Strategy

Sell OTM puts on TSLA/RKLB/RDW; collect premium or acquire shares at a discount for compounding.

## Risk Profile

Moderate (assignment obligation)

## Guardrails

- Ensure full cash collateral coverage per contract.
- Define acceptable assignment levels before entry.
- Use consistent position sizing per ticker volatility regime.
