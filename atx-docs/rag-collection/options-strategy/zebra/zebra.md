---
id: xfinance-strategy-zebra
name: xfinance-strategy-zebra
description: ZEBRA (zero-extrinsic back ratio) — back-ratio style directional structure with reduced extrinsic; advanced Greeks and capital discipline.
---

# xFinance Strategy: ZEBRA (zero-extrinsic back ratio)

## How Commonly Used

Low–medium (niche; advanced)

## Strategy

A **ZEBRA** is a **back-ratio–style** construction (e.g. sell one ATM-ish option, buy two further OTM options on the same side, or the mirror for bearish setups) arranged so **extrinsic** is reduced relative to a naive debit spread or stock replacement story. Treat as **directional** with payoff shape driven by strikes, DTE, and net debit — not a generic “always lower capital than shares” claim without modeling.

## Risk Profile

Aggressive (directional; path-dependent; debit at risk; complexity in rolls and assignment)

## Guardrails

- Model delta, gamma, and theta through the intended hold window; ratio structures flip character quickly near ATM.
- Plan exit or roll rules before **very short DTE** where gamma dominates.
- Use only in liquid names unless slippage is explicitly budgeted.
- Educational context only; not financial advice — no implied guarantees vs stock or other structures.
