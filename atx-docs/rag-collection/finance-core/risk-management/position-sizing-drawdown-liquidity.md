# atx-rag-collection/finance-core/risk-management/position-sizing-drawdown-liquidity.md

---
id: xfinance-finance-core-risk-sizing-drawdown-liquidity
name: finance-core-position-sizing-drawdown-liquidity
description: Posture-based sizing bands, drawdown and vol targeting concepts, and HNWI liquidity / cash-flow matching
complexity: core
underlying_type: stock
strategy_type: risk_management
risk_level: balanced
tags: [finance_core, risk, sizing, drawdown, volatility, liquidity, hnwi]
---

# Risk management — sizing, drawdown, liquidity

Desk language for **educational** use with workspace data. Align copy with tenant **risk posture** labels (`conservative` / `balanced` / `aggressive`) when present.

## Position sizing by risk posture (illustrative bands)

These are **conversation anchors**, not firm rules—custodian margin, concentration, and tax lots override.

| Posture | Typical max single-name equity sleeve (liquid book) | Notes |
| --- | --- | --- |
| **Conservative** | **~2%** of book / liquid net worth per name (ex cash) | Smaller options complexity; prioritize survival liquidity. |
| **Balanced** | **~3–4%** | Room for conviction + diversification; overlays sized to max loss. |
| **Aggressive** | **up to ~5%** (sometimes higher with documented plan) | Requires explicit **max loss**, **liquidity**, and **assignment** planning—never glamorize. |

- **Options notionals** — size off **max loss** and **collateral**, not premium alone; tie back to posture.
- **Correlated baskets** — treat sector/ETF clusters as one “economic exposure” when warning on concentration.

## Drawdown control & volatility targeting

- **Drawdown limits** — policy bands (e.g., reduce risk after **X%** peak-to-trough) are implemented in **playbooks + monitoring**, not magic formulas; scheduled scanners and alerts surface breaches—see `rebalancing-mechanics/`.
- **Vol targeting (concept)** — scale gross exposure inversely to realized vol when a mandate explicitly allows; retail/HNWI hybrids often use **static** strategic weights + **tactical** trims instead.
- **Behavioral guardrails** — pair mechanical rules with **pre-commit** checklists (when to pause selling, when to call CPA) — see `behavioral-finance/`.

## Liquidity & cash-flow matching (HNWI)

- **Buckets** — near-term cash needs (0–2y), lifestyle reserve, long-horizon growth, illiquid private sleeves; mismatch is a top failure mode.
- **Liability-driven framing** — match bond/cash duration to known outflows (tuition, distributions, laddered maturities) when users describe liabilities.
- **Margin & LOC** — cheaper until it isn’t; stress **rate resets** and **maintenance** on concentrated books; use `account_health` when exposed in tools.

## xChat usage

- Pull **`positions_snapshot`** and **`account_health`** before advising size changes.
- If data is stale or partial, say so—do not infer missing balances.
