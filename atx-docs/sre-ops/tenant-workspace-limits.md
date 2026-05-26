# Tenant workspace limits (SRE / ops)

Per-tenant quotas for the Next.js BFF. Defaults are code-defined; overrides live on Mongo `core_tenants.workspaceLimits` (partial object, camelCase keys).

## Fields (effective = merge defaults + tenant partial)

| Key | Default | Enforcement |
|-----|---------|-------------|
| `userXoptionsLimit` | 10 | **Billing/admin copy:** per **hour**. **Runtime:** `app_feature_daily_usage` (`feature: xoptions_deck`) UTC day bucket per user+tenant. Signed-in app users with `canUserLogin`; `global_admin` bypass. |
| `userChatLimit` | 10 | **UTC calendar day** cap on xChat asks. **Runtime:** `POST /api/xchat/ask` enforces the **effective tenant+plan limit** (base `workspaceLimits` + `planOverrides.<tier>.userChatLimit` when configured). `global_admin` bypasses workspace caps. |
| `userChatHourlyLimit` | — (omit or `0` = off) | Optional **UTC clock-hour** cap; when &gt; 0, enforced in `ask-usage-limits` before the day bucket. Plan overrides use `0` to clear an inherited hourly cap. |
| `tenantPortfolioLimit` | 1 | New portfolio rows in tenant for that user (admin + app flows). |
| `portfolioAccountLimit` | 1 | New `portfolio_accounts` per portfolio. |
| `userTasksMax` | 5 | Max saved app_user jobs per user (`POST /api/tasks`), surfaced on `/account/tasks` and `/workspace/tasks`. |
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
- **`xchat_usage_limits`**: per-user/tenant minute, hour, and day buckets for `POST /api/xchat/ask` (TTL on `expiresAt`). Document **`key`** format: `{kind}:{userId}:{tenantId|tenant:none}:{bucketStartIso}` where **`bucketStartIso`** is UTC-aligned and uses JavaScript **`Date.toISOString()`** (`.000Z` millis). Next **`ask-usage-limits.ts`** and Spring **`XchatUsageLimitService`** must stay aligned when BFF proxies **`POST /api/xchat/ask/stream`**; **`peekXchatAskUsageCounts`** sums legacy keys (pre-parity **`Instant.toString()`** without millis) for reads only.
- **`app_feature_daily_usage`**: usage rows with TTL on `expiresAt` (~35d). Indexes: unique `key`, TTL on `expiresAt`.

Indexes are created best-effort on first use (same pattern as other identity usage helpers).

## Admin API

- `GET/PATCH /api/admin/tenants/{tenantId}/workspace-limits` — `global_admin` only; **GET** may persist default `workspaceLimits` once when scalars are missing (lazy backfill).
- UI: `/admin/tenant-preferences/workspace-limits` — **session tenant** only. **`/admin/tenant-register/{tenantId}/workspace-limits`** — same panel for **any** tenant id (links from **Edit tenant** / post-create).

## Guest 30-day trial (May 2026)

- **Trigger:** Guest lands on **`/`** or **`/home`** with **`?trial=1`** or clicks **Start 30-Day Free Trial** (sets cookie **`xf_guest_trial_intent`**). X/Google OAuth callbacks call **`provisionGuestTrialOperatorAccess`** (`src/modules/identity/guest-trial.ts`).
- **Grant (first time only):** **`core_users.trialEndsAt`** (+ **`guestTrialStartedAt`**), **`roles`** includes **`operator`**, **`subscriptionPlan: basic`**, **`accountStatus: approved`**, default tenant membership on **`atxfinance-core`** (or session tenant when already assigned).
- **Limits during trial:** **`getPlanLimits('basic')`** + tenant **`workspaceLimits`** / **`planOverrides.basic`** via **`effectiveWorkspaceLimitsForTenantAndPlan`** — same caps as a paying Basic subscriber (xChat day/hr, xOptions desk, portfolio counts per tenant row).
- **Billing gate:** **`trial_active`** → product surfaces allowed without Stripe; after **`trialEndsAt`** → **`trial_expired`** → edge proxy **`requiresBilling`** → **`/account/billing`** (user stays on **basic** plan until Checkout upgrades tier).

## App user surfacing

- `/account/billing` (see `src/app/account/billing/page.tsx`, `billing-plan-grid.tsx`) resolves each retail tier with **`billingCardWorkspaceDisplay`** in `src/lib/billing-plan-workspace-display.ts`:
  - **Signed-in:** loads `core_tenants` by session `tenantId`. **List price** uses `planOverrides.<tier>.price` when set. **Workspace quota rows** use **plan-effective** values (`applyTenantPlanRowToBase`) for all displayed metrics (xOptions/hr, xChat day/hr UTC, portfolios, accounts). **Change persona** / **Chat history** also use plan-effective merges.
  - **Guests:** `/account/billing` resolves the platform default tenant when no session tenant is available, then renders read-only plan cards from that tenant’s `workspaceLimits` + `planOverrides` values (same defaults managed in Admin workspace limits). **≥3.16.3:** Guest layout leads with **`BillingGuestExperience`** (signup + plan pills + OAuth); cards stay comparable below; **Select & Register** updates the pill tier and scrolls to the form (**`billing-plan-cards-client.tsx`** guest mode).
  - **Workspace limits** block on each card: **five** quota rows (xOptions/hr, xChat day UTC, xChat hr UTC, portfolios, accounts) plus **Change persona** (Yes/No) and **Chat history max (turns)**; **price is not duplicated** in that list (only in the card header). App-user task cap (`userTasksMax`) is enforced at task APIs/pages and managed in Admin Workspace limits.

## Parsing / Mongo quirks

Reads (`mergeTenantWorkspaceLimits`, `normalizePlanOverridesFromUnknown`, admin GET) coerce **`userChatHourlyLimit`** from **integer-like doubles** or **numeric strings** when present so plan overrides and tenant rows still merge into billing and `POST /api/xchat/ask` (strict **PATCH** paths use the same coercion). Invalid values are ignored on loose read; invalid **PATCH** bodies still fail validation.

## Deploy / rollback

No migration required: missing `workspaceLimits` resolves to defaults at **runtime**. **Persisted backfill:** `upsertTenantFromParsedSpecV1` and **`GET /api/admin/tenants/{tenantId}/workspace-limits`** write merged default scalars when Mongo has null / planOverrides-only rows so Admin **Tenant register** JSON is not stuck on `null`. Rolling back code without removing DB fields keeps tenant overrides; ensure new code paths tolerate unknown extra keys (they are ignored by merge).

## Related errors (HTTP)

- `workspace_portfolio_account_limit_exceeded` — `403` on account create.
- `workspace_tenant_portfolio_limit_exceeded` — `403` on portfolio create when over cap.
