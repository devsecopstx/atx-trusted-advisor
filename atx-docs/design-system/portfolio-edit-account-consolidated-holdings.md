# Edit Account — consolidated positions & holdings

**Shipped (app 3.3.8+):** `/portfolio/accounts/[accountId]` includes the same **Holdings** card as the portfolio **Holdings** tab: a single scrollable table with **Symbol**, **Position** (leg / company / cash), **Last** (underlying quote), **Day Δ**, **Value**, **% acct**, **Qty**, **Avg cost**, row remove, and a **Total (mark)** footer.

**Shipped (May 2026):** Per-position **Desk** actions on stock/option rows — **alert** (existing portfolio alert dialog), **options chain** (position-scoped drawer via **`PositionOptionsChainDrawer`** + **`OptionsChainTab`** variant), and **xChat** deep link (`buildPositionDeskHandoffUrls` + prefilled prompt). No account-level **Options Chain** tab on **`/portfolio`** or edit workspace — chain context is tied to the selected position, not the whole account.

**Shipped (desk from table):** Per-row **Desk** opens a dialog with a prefilled title/body, then **`POST /api/portfolios/{portfolioId}/alerts`** with `accountId` + optional `symbol` — persists a portfolio alert and triggers the same desk dispatch path as other alerts (Slack/email when configured). Link to **`/portfolio/alerts`** for the full list.

## Data semantics

| Column | Stocks | Options | Cash |
|--------|--------|---------|------|
| **Last** | Yahoo last for symbol | Same **underlying** last (not option premium) | — |
| **Day Δ** | Underlying change / % | Underlying change / % | — |
| **Value** | shares × last, else book (shares × avg) | **Book**: \|contracts\| × 100 × premium/contract | Notional |
| **% acct** | Row value ÷ sum of row marks | Same | Same |
| **Avg cost** | Cost / share | Premium / contract + `/ct` | USD notional |

**Why:** Option **marks** (last premium) are not yet loaded in this table; the UI labels option value **book** so users still see cost basis for reconciliation. **Automated scanner / price-alert thresholds** (compare stored thresholds to **Last** or future **option mid**, `price-alert-service`, scheduled jobs) remain **product backlog** — not a gap vs the desk-alert path above.

## Code map

- UI: `src/app/portfolio/ui/account-consolidated-holdings-table.tsx`
- CRUD shell + add forms: `src/app/portfolio/ui/account-holdings-crud-card.tsx`
- Edit account page: `src/app/portfolio/accounts/[accountId]/page.tsx` (loads `listPortfolioPositionsByAccount` → `serializePositionsForUi`)
- Account details form (name, broker ref, type, desk fields): `src/app/portfolio/accounts/[accountId]/account-workspace-client.tsx` → `PATCH /api/portfolios/{portfolioId}/accounts/{accountId}`
- Position chain drawer: `src/app/portfolio/ui/position-options-chain-drawer.tsx` + `src/app/portfolio/lib/portfolio-position-options-chain.ts` + shared `src/components/xoptions/option-chain-table.tsx`
- Layout shell: `src/app/portfolio/accounts/[accountId]/account-workspace.tsx`
- Styles: `src/app/portfolio/portfolio.css` (`.portfolio-consolidated-holdings*`)

## Tests & broker-ref stability

- **API (mocked repo):** `tests/integration/portfolio-api-routes.test.ts` — account **PATCH** (`extAccountId`, **`brokerImportLocked`** + **409** on type change, desk fields, outlook alias mapping); **`POST /api/portfolios/{id}/alerts`** (create + invalid `accountId`). **Position PATCH (≥3.24.2):** `tests/integration/positions-backend-bff-proxy.test.ts` — app-user + admin **`PATCH /api/positions/{positionId}`** BFF proxy, 405 forwarding, Mongo fallback; Edit Account stock save uses **`account-holdings-crud-card.tsx`** → **`updateStockPosition`**.
- **Repository (fake Mongo):** `tests/integration/portfolio-provisioning-repository.test.ts` — repeat **`provisionDefaultPortfolioForUser`** does not reset names / **`extAccountId`** / **`type`**; **`updatePortfolioAccountForUser`** + second provision keeps user-set ref (edit account + OAuth-style re-provision).
- **Display helpers:** `tests/unit/account-xref-display.test.ts` — provisioning placeholders vs real refs, **`maskAccountXrefForDisplay`** / **`accountRefLastFourOnlyDisplay`**.
- **Position desk actions:** `tests/unit/portfolio-options-chain-handoff.test.ts`, `tests/unit/portfolio-desk-handoff.test.ts`, `tests/unit/portfolio-account-options-chain-tab-contract.test.ts`.
- **Default-book idempotency (shipped ≥3.7.3):** `provisionDefaultPortfolioForUser` / Spring **`DefaultPortfolioProvisionService`** — see **`auth-and-access.md`**, **`app-user-import-activity.md`**, **`release-notes.md`** (3.7.3).

## Planned follow-ons (not shipped)

1. **Option mid / mark** — Fetch chain quote by `yahooRef` (or OCC key) and show **Last** / **Value** for options; keep book as secondary column if useful.
2. **Automated scanner / threshold alerts** — Row- or field-level rules in `price-alert-service` (or scheduled scanner metadata) using **Last** vs **Avg cost** / future option mid; distinct from the manual **Desk** portfolio alert shipped above.
3. **Filter / search** — Broker-style symbol filter when account has many legs.
4. **Collapsible groups** — If multi-account view ever merges here; single-account table is flat today.
5. **Crypto positions** — `asset_type: "crypto"` + symbol; Yahoo / IBKR quotes; unified % of book with equity/options — [`PLAN.md`](../PLAN.md) § **xMoney & crypto portfolio (704)** Phase 1.

See **PLAN.md** → **Deferred product TODOs** for the scanner/threshold backlog line.
