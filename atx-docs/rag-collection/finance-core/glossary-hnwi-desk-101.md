# atx-rag-collection/finance-core/glossary-hnwi-desk-101.md

---
id: xfinance-finance-core-glossary-desk101
name: finance-core-glossary-hnwi-desk-101
description: Reusable definitions and framing for HNWI desk conversations across strategies
complexity: core
underlying_type: stock
tags: [finance_core, glossary, hnwi, desk_101, definitions]
---

# Glossary / HNWI desk 101

Stable language for **many strategies and chats**. Expand in long-form only in strategy docs or compliance copy elsewhere.

## Book & workspace

- **Book / portfolio** — user-scoped container of accounts and positions; “default book” is product language for their primary workspace portfolio.
- **Account** — custodian sub-ledger (cash, margin, tax wrapper) under a portfolio; not interchangeable with “strategy.”
- **Notional** — dollars controlled by an options position (approx `contracts × multiplier × reference`); distinguish from premium paid/received.

## Income vs hedge

- **Income sleeve** — premium collection with defined or bounded risk budget (CC, CSP, spreads, condors per playbook).
- **Hedge sleeve** — pays premium to reduce tail or gap risk (protective puts, collars, risk reversals as appropriate).
- **Net delta / beta** — directional exposure to the underlying or index; use tool-backed snapshots when available.

## Risk posture (labels)

- **Conservative** — prioritize preservation, smaller size, shorter options complexity, clearer max loss.
- **Balanced** — mix income and moderate growth; spreads and condors common.
- **Aggressive** — higher risk budget; still requires explicit max-loss and liquidity discipline—never glamorize.

## Options vocabulary (short)

- **Premium** — price of the option contract; buyer pays, seller collects (before fees).
- **Intrinsic / extrinsic** — intrinsic = max(0, ITM amount); extrinsic = remainder (time + vol).
- **ITM / ATM / OTM** — relative to spot or forward, depending on chain display; state which reference you mean.
- **Roll** — close + reopen to new strike/expiry for thesis or defense; has cost and tax implications.
- **POP vs P/L** — probability of profit is not expected profit; don’t conflate in copy.

## Service posture

- **Educational, not advice** — tie recommendations to user-stated goals, constraints, and **observed** workspace data.
- **Disclaimers** — follow `atx-response-guidelines` / `compliance-disclaimers` for required footer language.

## Where deeper content lives

- **Structures & payoffs** → `options-strategy-core` / `options-strategy-advanced`
- **How to format answers** → `atx-response-guidelines`
- **Mechanics detail** → `primitives-and-mechanics.md` in this folder
