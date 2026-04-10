# Tenant workspace limits (SRE / ops)

Per-tenant quotas for the Next.js BFF. Defaults are code-defined; overrides live on Mongo `core_tenants.workspaceLimits` (partial object, camelCase keys).

## Fields (effective = merge defaults + tenant partial)

| Key | Default | Enforcement |
|-----|---------|-------------|
| `userXoptionsLimit` | 10 | **Billing/admin copy:** per **hour**. **Runtime:** `app_feature_daily_usage` (`feature: xoptions_deck`) UTC day bucket per user+tenant. Signed-in app users with `canUserLogin`; `global_admin` bypass. |
| `userChatLimit` | 10 | **UTC calendar day** cap on xChat asks. **Runtime:** merged effective value (tenant base + `planOverrides` for the user’s tier) in `POST /api/xchat/ask` (`ask-usage-limits` day bucket); `global_admin` bypasses workspace caps. |
| `userChatHourlyLimit` | — (omit or `0` = off) | Optional **UTC clock-hour** cap; when &gt; 0, enforced in `ask-usage-limits` before the day bucket. Plan overrides use `0` to clear an inherited hourly cap. |
| `tenantPortfolioLimit` | 1 | New portfolio rows in tenant for that user (admin + app flows). |
| `portfolioAccountLimit` | 1 | New `portfolio_accounts` per portfolio. |
| `changePersonaEnabled` | **true** | App users: xChat persona picker enabled. When **false**, picker is disabled ( **`global_admin`** sessions ignore). Per-plan override in `planOverrides.<tier>`. |
| `chatHistoryMax` | **10** | Recent prompts loaded in xChat thread + `/api/xchat/history?limit=` (clamped 1–500 in UI). Per-plan override. |

**Product vs runtime:** xOptions remain **per hour** in billing copy while enforcement may still use a UTC day bucket (`app_feature_daily_usage`). xChat shows **hour (UTC)** and **day (UTC)** on `/account/billing` when configured; 429 responses distinguish `xchat_hourly_limit_exceeded` vs `xchat_daily_limit_exceeded`.

### Per-plan overrides (`workspaceLimits.planOverrides`)

Keyed by retail tier id: `basic`, `premium_monthly`, `premium_plus_monthly`. Legacy documents may still use `premium_plus_yearly`; it is normalized to `premium_plus_monthly` on read. Each value is a partial of the quota fields above, plus optional:

| Key | Default | Notes |
|-----|---------|--------|
| `price` | **10** (see `DEFAULT_TENANT_PLAN_PRICE` in `tenant-workspace-limits.ts`) | Admin-managed **list price in USD** (whole dollars) for that tier in this tenant. Not used for quota enforcement; use `resolvedTenantPlanPrice()` when displaying billing. |
| `stripeProductId` | — | Optional Stripe **Product** id (`prod_…`); admin reference; Checkout uses `stripePriceId`. |
| `stripePriceId` | — | Optional Stripe **Price** id (`price_…`). When set, `POST /api/billing/checkout-session` uses this for the tier instead of `STRIPE_PRICE_*` env (same Stripe account as `STRIPE_SECRET_KEY`). |

## Mongo collections

- **`core_tenants`**: optional `workspaceLimits` subdocument.
- **`xchat_usage_limits`**: per-user/tenant minute, hour, and day buckets for `POST /api/xchat/ask` (TTL on `expiresAt`).
- **`app_feature_daily_usage`**: usage rows with TTL on `expiresAt` (~35d). Indexes: unique `key`, TTL on `expiresAt`.

Indexes are created best-effort on first use (same pattern as other identity usage helpers).

## Admin API

- `GET/PATCH /api/admin/tenants/{tenantId}/workspace-limits` — `global_admin` only.
- UI: `/admin/tenant-preferences/workspace-limits` (session `tenantId` is the managed tenant). Legacy `/admin/tenant-workspace` redirects there.

## App user surfacing

- `/account/billing` (see `src/app/account/billing/page.tsx`, `billing-plan-grid.tsx`) resolves each retail tier with **`billingCardWorkspaceDisplay`** in `src/lib/billing-plan-workspace-display.ts`:
  - **Signed-in:** loads `core_tenants` by session `tenantId`, merges `workspaceLimits` + `planOverrides.<tier>` via `mergeTenantWorkspaceLimits` + `applyTenantPlanRowToBase` (same shape as enforcement). **List price** on the card uses `planOverrides.<tier>.price` (USD whole dollars) when set; otherwise catalog from `ATX_BILLING_PLANS`.
  - **Guests:** list **price** and four **catalog** cap strings from `src/lib/atx-billing-plan-limits.ts` (aligned with `atx-docs/resouces/atx-limits.txt.tsv`).
  - **Workspace limits** block on each card: **five** quota rows (xOptions/hr, xChat day UTC, xChat hr UTC, portfolios, accounts) plus **Change persona** (Yes/No) and **Chat history max (turns)**; **price is not duplicated** in that list (only in the card header).

## Parsing / Mongo quirks

Reads (`mergeTenantWorkspaceLimits`, `normalizePlanOverridesFromUnknown`, admin GET) coerce **`userChatHourlyLimit`** from **integer-like doubles** or **numeric strings** when present so plan overrides and tenant rows still merge into billing and `POST /api/xchat/ask` (strict **PATCH** paths use the same coercion). Invalid values are ignored on loose read; invalid **PATCH** bodies still fail validation.

## Deploy / rollback

No migration required: missing `workspaceLimits` resolves to defaults. Rolling back code without removing DB fields keeps tenant overrides; ensure new code paths tolerate unknown extra keys (they are ignored by merge).

## Related errors (HTTP)

- `workspace_portfolio_account_limit_exceeded` — `403` on account create.
- `workspace_tenant_portfolio_limit_exceeded` — `403` on portfolio create when over cap.
