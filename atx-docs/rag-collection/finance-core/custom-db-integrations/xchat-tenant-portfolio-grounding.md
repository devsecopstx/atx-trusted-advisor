# atx-rag-collection/finance-core/custom-db-integrations/xchat-tenant-portfolio-grounding.md

---
id: xfinance-finance-core-custom-db-xchat-grounding
name: finance-core-mongo-portfolio-grounding-meta
description: Meta reference for how xChat atx_function queries tenant portfolio collections for real-time grounding
complexity: core
underlying_type: stock
strategy_type: platform_meta
risk_level: balanced
tags: [finance_core, meta, mongodb, tenant_portfolio, portfolio_accounts, portfolio_positions, atx_function, xchat]
---

# Custom DB integrations (meta) — xChat & portfolio grounding

**Meta doc:** explains how **live** workspace data reaches xChat through **`atx_function`** (and related paths), not SQL access from the model.

## Core Mongo collections (names)

- **`tenant_portfolio`** — workspace books (per user / tenant); default portfolio selection drives **`portfolioId`** on ask routes.
- **`portfolio_accounts`** — custodian ledgers under a portfolio (**cash**, margin flags, tax wrapper hints where modeled).
- **`portfolio_positions`** — holdings and option legs; may include **lot** or basis fields depending on import/custodian—**never assume** richer lot data than the snapshot shows.
- **`portfolio_watchlists`** — watchlist symbols and desk metadata for **`watchlist_snapshot`**.
- **`core_users` / `core_tenants`** — identity, tenant, limits; govern what automation may run.

## How xChat queries (conceptual)

- **`atx_function`** bundles read-only portfolio operations (`portfolio_summary`, `positions_snapshot`, `watchlist_snapshot`, `account_health`, `market_quote`) scoped to **session user + tenant**, optionally narrowed by **`portfolioId`** on the request.
- **No ad-hoc Mongo from the model** — the LLM does not run queries; the app executes allowlisted tools and returns JSON the model must interpret.

## Grounding rules for writers

- When describing “what we store,” **match shipped collection names** above; if a field is uncertain, say “when present on the row.”
- For **integrations** (e.g., broker CSV/API), point to import routes and disclaim **latency** vs custodian source of truth.

## Related segments

- **Primitives** — `primitives-and-mechanics.md`
- **Rebalancing + scanners** — `rebalancing-mechanics/calendar-threshold-opportunistic.md`
- **Tax lots** — `tax-strategies/tlh-oz-1031-crt-wash-sales.md` (when lot data exists on positions or custodian exports)
