# atx-rag-collection/finance-core/legacy-estate/grats-ilit-dynasty-portfolio-integration.md

---
id: xfinance-finance-core-legacy-estate-grat-ilit-dynasty
name: finance-core-legacy-estate-portfolio-integration
description: How portfolio books interface with estate planning themes GRATs ILITs dynasty trusts at educational desk level
complexity: advanced
underlying_type: stock
strategy_type: estate_planning
risk_level: conservative
tags: [finance_core, estate, grat, ilit, dynasty_trust, legacy, hnwi]
---

# Legacy & estate — portfolio integration (GRATs, ILITs, dynasty trusts)

**Educational framing only.** Estate instruments are **legal documents + tax elections**—the app may only show **subset** of household balance sheet.

## GRATs (Grantor Retained Annuity Trusts)

- **Concept** — transfer appreciation out of estate if the grantor survives the term; annuity strips value back to grantor by design.
- **Portfolio link** — funding asset selection (volatility, dividend policy) matters for **annuity satisfaction**; illiquid marks need appraisal discipline.
- **Product boundary** — do not infer GRAT balances from `tenant_portfolio` unless user confirms mapping.

## ILITs (Irrevocable Life Insurance Trusts)

- **Concept** — own policies outside estate; premium funding and Crummey letters are operational details for counsel.
- **Portfolio link** — **cash-flow** for premiums vs taxable book; avoid recommending policy changes without insurance specialist.

## Dynasty trusts (generation-skipping)

- **Concept** — long-horizon trusts with GST tax complexity; state situs matters.
- **Portfolio link** — **sub-accounts** or excluded assets may not appear in workspace; ask explicitly what book is in view.

## Safe desk behaviors

- **Never** fabricate trust terms, beneficiaries, or tax IDs.
- When users conflate **personal book** vs **trust-owned** assets, pause and label **data scope** before risk advice.
