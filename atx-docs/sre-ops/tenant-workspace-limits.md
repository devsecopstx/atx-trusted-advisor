# Tenant workspace limits (SRE / ops)

Per-tenant quotas for the Next.js BFF. Defaults are code-defined; overrides live on Mongo `core_tenants.workspaceLimits` (partial object, camelCase keys).

## Fields (effective = merge defaults + tenant partial)

| Key | Default | Enforcement |
|-----|---------|-------------|
| `userXoptionsLimit` | 10 | **Billing/admin copy:** per **hour**. **Runtime:** `app_feature_daily_usage` (`feature: xoptions_deck`) UTC day bucket per user+tenant. Signed-in app users with `canUserLogin`; `global_admin` bypass. |
| `userChatLimit` | 10 | **Billing/admin copy:** per **hour**. **Runtime:** `min(plan max, userChatLimit)` in `POST /api/xchat/ask` with UTC day usage; `global_admin` bypasses cap. |
| `tenantPortfolioLimit` | 1 | New portfolio rows in tenant for that user (admin + app flows). |
| `portfolioAccountLimit` | 1 | New `portfolio_accounts` per portfolio. |

**Product vs runtime:** xOptions/xChat are labeled **per hour** on `/account/billing`, admin workspace limits, xOptions gate, and xChat limit errors. The **Runtime** column above is source of truth for the current counter implementation; align code and docs when moving to true hourly metering.

### Per-plan overrides (`workspaceLimits.planOverrides`)

Keyed by retail tier id: `basic`, `premium_monthly`, `premium_plus_monthly`. Legacy documents may still use `premium_plus_yearly`; it is normalized to `premium_plus_monthly` on read. Each value is a partial of the quota fields above, plus optional:

| Key | Default | Notes |
|-----|---------|--------|
| `price` | **10** (see `DEFAULT_TENANT_PLAN_PRICE` in `tenant-workspace-limits.ts`) | Admin-managed **list price in USD** (whole dollars) for that tier in this tenant. Not used for quota enforcement; use `resolvedTenantPlanPrice()` when displaying billing. Stripe Price IDs remain env-driven; keep amounts aligned before rotating `STRIPE_PRICE_*`. |

## Mongo collections

- **`core_tenants`**: optional `workspaceLimits` subdocument.
- **`app_feature_daily_usage`**: usage rows with TTL on `expiresAt` (~35d). Indexes: unique `key`, TTL on `expiresAt`.

Indexes are created best-effort on first use (same pattern as other identity usage helpers).

## Admin API

- `GET/PATCH /api/admin/tenants/{tenantId}/workspace-limits` — `global_admin` only.
- UI: `/admin/tenant-preferences/workspace-limits` (session `tenantId` is the managed tenant). Legacy `/admin/tenant-workspace` redirects there.

## App user surfacing

- `/account/billing` (see `src/app/account/billing/page.tsx`, `billing-plan-grid.tsx`) resolves each retail tier with **`billingCardWorkspaceDisplay`** in `src/lib/billing-plan-workspace-display.ts`:
  - **Signed-in:** loads `core_tenants` by session `tenantId`, merges `workspaceLimits` + `planOverrides.<tier>` via `mergeTenantWorkspaceLimits` + `applyTenantPlanRowToBase` (same shape as enforcement). **List price** on the card uses `planOverrides.<tier>.price` (USD whole dollars) when set; otherwise catalog from `ATX_BILLING_PLANS`.
  - **Guests:** list **price** and four **catalog** cap strings from `src/lib/atx-billing-plan-limits.ts` (aligned with `atx-docs/resouces/atx-limits.txt.tsv`).
  - **Workspace limits** block on each card: exactly **four** rows (xOptions/hr, xChat/hr, portfolios/user, accounts/portfolio); **price is not duplicated** in that list (only in the card header). Labels follow published billing copy (per-hour caps for xOptions/xChat on the card).

## Deploy / rollback

No migration required: missing `workspaceLimits` resolves to defaults. Rolling back code without removing DB fields keeps tenant overrides; ensure new code paths tolerate unknown extra keys (they are ignored by merge).

## Related errors (HTTP)

- `workspace_portfolio_account_limit_exceeded` — `403` on account create.
- `workspace_tenant_portfolio_limit_exceeded` — `403` on portfolio create when over cap.
