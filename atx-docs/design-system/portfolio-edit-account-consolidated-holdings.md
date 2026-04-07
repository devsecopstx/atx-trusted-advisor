# Edit Account — consolidated positions & holdings

**Shipped (app 3.3.8+):** `/portfolio/accounts/[accountId]` includes the same **Holdings** card as the portfolio **Holdings** tab: a single scrollable table with **Symbol**, **Position** (leg / company / cash), **Last** (underlying quote), **Day Δ**, **Value**, **% acct**, **Qty**, **Avg cost**, row remove, and a **Total (mark)** footer.

## Data semantics

| Column | Stocks | Options | Cash |
|--------|--------|---------|------|
| **Last** | Yahoo last for symbol | Same **underlying** last (not option premium) | — |
| **Day Δ** | Underlying change / % | Underlying change / % | — |
| **Value** | shares × last, else book (shares × avg) | **Book**: \|contracts\| × 100 × premium/contract | Notional |
| **% acct** | Row value ÷ sum of row marks | Same | Same |
| **Avg cost** | Cost / share | Premium / contract + `/ct` | USD notional |

**Why:** Option **marks** (last premium) are not yet loaded in this table; the UI labels option value **book** so users still see cost basis for alerts and reconciliation. **Scanner / price-alert** follow-on can compare stored thresholds to **Last** (underlying) and/or future **option mid** once chain quotes are wired per row.

## Code map

- UI: `src/app/portfolio/ui/account-consolidated-holdings-table.tsx`
- CRUD shell + add forms: `src/app/portfolio/ui/account-holdings-crud-card.tsx`
- Edit account page: `src/app/portfolio/accounts/[accountId]/page.tsx` (loads `listPortfolioPositionsByAccount` → `serializePositionsForUi`)
- Layout shell: `src/app/portfolio/accounts/[accountId]/account-workspace.tsx`
- Styles: `src/app/portfolio/portfolio.css` (`.portfolio-consolidated-holdings*`)

## Planned follow-ons (not shipped)

1. **Option mid / mark** — Fetch chain quote by `yahooRef` (or OCC key) and show **Last** / **Value** for options; keep book as secondary column if useful.
2. **Price-alert UX** — From this table, “Set alert” prefill symbol, underlying last, avg cost, and suggested threshold (product + `price-alert-service` / scanner jobs).
3. **Filter / search** — Broker-style symbol filter when account has many legs.
4. **Collapsible groups** — If multi-account view ever merges here; single-account table is flat today.

See **PLAN.md** → Design and UX roadmap for the alert/scanner binding line.
