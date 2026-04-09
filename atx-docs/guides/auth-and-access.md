# Auth and Access Guide

This is the auth/access entrypoint. Use this page for incident triage, then jump to deep docs for implementation details.

## Deep-dive docs

- `src/modules/identity/authorization.ts` (login/role gate behavior)
- `src/modules/surface-policy.ts` (admin_console vs app_user path policy)
- [tenant-ux-plan.md](../design-system/tenant-ux-plan.md) — **Tenant UX (`tenant_ux`):** route catalog, per-role visibility + default landing (Mongo/UI/enforcement backlog); **`GET /api/admin/platform/route-catalog`**
- `src/proxy.ts` (edge auth: guest-capable **HTML** for `/xoptions`, `/portfolio`, `/portfolios`; other protected pages redirect unauthenticated users to `/xchat`; matched **API** paths → 401 without session)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth dual-run/cutover operations)
- `atx-docs/sre-ops/x-oauth-atx-callbacks.md` (callback host/config checklist)

## Platform roles vs tenant membership

Session payload distinguishes:

- **Platform roles (`roles`)**: `global_admin`, `advisor`, `operator`, `viewer`
- **Tenant membership (`tenantRole`)**: `tenant_admin`, `member`

`app_user` in docs means signed-in product users with platform roles `advisor`, `operator`, or `viewer`; it is not a stored role string.

## Surface policy

- `admin_console`: `/admin/*` and `/api/admin/*` (`global_admin` only)
- `app_user`: `/xchat`, `/portfolio`, `/portfolios`, `/import-activity`, `/watchlist`, `/account`, `/workspace`, `/xoptions` (see `APP_USER_PRODUCT_PATH_PREFIXES` in `surface-policy.ts`)

Reference: `src/modules/surface-policy.ts` and `src/proxy.ts`.

**Future (tenant UX):** Per-tenant **narrowing** of which `app_user` paths each **platform role** may hit — see [tenant-ux-plan.md](../design-system/tenant-ux-plan.md); canonical metadata in **`data/platform/app-user-route-catalog.json`**.

## Guest registration MVP (X / Google)

1. User submits **Register for access** on `/xchat` (`POST /api/access-requests/public`) with name, email, and plan. That **upserts `core_users` by normalized email** (lowercased, trimmed) and creates a **pending** access request for platform role **`operator`** (default onboarding role for xOptions / product paths).
2. A **global admin** approves the request in **Admin → Access requests**. Approval adds the login-eligible platform role and provisions default portfolio resources **on that same `core_users` document** (`userId` on the request).
3. The user signs in with **X** or **Google**. The callback **always prefers the `core_users` row whose `email` matches the verified email from the provider** and **moves** `xAccount` / `googleAccount` onto that row if they were previously linked to another user (for example a placeholder X-only row). This keeps approval, subscription, and OAuth identity on one document per tenant’s user set.

**Google email:** The Google callback requires a **verified** `email` + `email_verified` from Google userinfo; without that it redirects with `google_email_required`.

**Portfolio tenant on approve:** Default portfolio provisioning for an approved applicant uses **the tenant stored on the access request** when set (admin can assign it before approve — **`targetTenantId`** on **`PATCH`/`PUT` `/api/admin/access-requests/{id}`**), else **that user’s default tenant membership** (or the platform default tenant `atxfinance-core`), **not** the approving admin’s `session.tenantId`. Using the admin’s tenant used to write `tenant_portfolio` / `portfolio_accounts` under a tenant the applicant’s OAuth session never queries, so the UI looked empty and created a second “Default Portfolio.” When **`tenantId`** is on the row at approve time, the server also **`upsertTenantMembership`** for that user as **`member`** with **`isDefaultTenant: true`** for that tenant.

**Admin tenant column:** **Admin → Access requests** can set or clear the request’s default-book tenant (**Save tenant**) so the right **`core_tenant_memberships`** / portfolio scope applies on approval. Empty string clears the assignment (platform default path on approve). **`targetTenantId`** must be a valid 24-char hex **`ObjectId`** when non-empty.

**Names on re-login:** OAuth completion still runs **idempotent** default-book provisioning so the book exists, but repeat runs **must not** reset user-edited **portfolio / account / watchlist names** (or existing **cash** on the default account). Defaults apply only when inserting new rows or when a name was never set.

### Admin approval → default book (portfolio, $25k account, TSLA watchlist)

When a global admin **approves** an access request in **Admin → Access requests** (`PATCH`/`PUT` `/api/admin/access-requests/{id}`):

1. **Synchronous (same HTTP request, before the row is marked reviewed):** `provisionDefaultPortfolioForUser` runs for the applicant’s tenant (same tenant rules as **Guest registration MVP** above). That creates or updates the **default** `tenant_portfolio` row, **default** `portfolio_accounts` row with **$25,000** paper cash (`DEFAULT_ACCOUNT_CASH_BALANCE` in `src/modules/core-admin/repository.ts`), and a **watchlist** seeded with **TSLA** (`DEFAULT_WATCHLIST_SYMBOL`). If this step throws, the API returns **500** and the request is **not** reviewed.

2. **Then:** `enqueueAccessRequestBootstrap` writes `admin_user_bootstrap_profiles` (pending), inserts a **disabled** `admin_scheduled_tasks` row named `access-request-bootstrap:{email}` with `nextRunAt: now` and a `scheduleDescription` explaining that the book was already provisioned — **enabling or “Run now” on that task does not re-run book creation** (category is `notifications` for trace only). A **microtask** immediately runs xChat/xAI bootstrap (`runAccessRequestBootstrap`: idempotent provision again + xAI collection + audit `bootstrap-synced`).

Spring BFF path: `AdminAccessRequestService` uses `DefaultPortfolioProvisionService.provisionForAccessRequestApprovedUser` for the same defaults.

If X does not expose an email, the UI uses the **link email** step so the user can tie their X identity to the same email they registered with.

## Admin — Manage users (destructive delete)

**Global admin** → **Admin → Manage users** → **Delete** runs **`DELETE /api/admin/users/{userId}`** after a prompt that requires typing **`DELETE`**. The server **removes all product data** scoped to that user id **and** normalized email before deleting the **`core_users`** row: portfolios (and nested accounts, positions, watchlists, portfolio-scoped recommendations/alerts/channels), **`core_tenant_memberships`**, **`admin_user_settings`**, **`admin_access_requests`**, **`options_strategy_preferences`**, **`app_user_recommendations`**, **`xchat_logs`**, **`app_feature_daily_usage`**, **`strategy_jobs`**, **`audit_login`** (by user id and by email when purging a full user), **`admin_user_bootstrap_profiles`**, and disabled **`admin_scheduled_tasks`** rows named **`access-request-bootstrap:{email}`**. Admins **cannot** delete their **own** user id from this route (**400**).

**OAuth merge** of a placeholder X user into an existing email account still uses **`purgeEphemeralCoreUserScaffolding`** only (same user id, **no** email-keyed deletes) so another user’s bootstrap or login-audit rows are not touched.

## App user shell (header profile + left rail)

**Signed-in header** (`AppUserHeaderSession`, avatar menu): **Plans & billing** → `/account/billing`, **Legal** → `/legal/terms`, then **Appearance** in a **collapsed** `<details>` (expand for Light / Dark / System via `XfThemePreferenceMenu`). **Submit feedback** and **Logout** stay in the menu actions block.

**Left rail — Account** (`AppUserAccountRailSection`): **Settings** only — **global_admin** links to `/admin/manage_account`; other roles see a muted “Settings” note. **Plans & billing** and **Legal** are **not** duplicated here (use the profile menu). If there is nothing to show (e.g. guest shell with `showSettingsLink={false}`), the Account section is omitted.

**Manage workspace** (`AppUserManageWorkspaceRailSection` on xChat): includes a nested **Default book** disclosure (**collapsed** by default) when `defaultBookLabels` is passed from the page — portfolio name (link to `/portfolio`) and default account label.

**Rail icons:** collapsed-sidebar **expand** and **Manage workspace** row use the shared **`RailSidebarZapIcon`** (yellow lightning, `xf-rail-sidebar-zap-icon*` in `xchat.css`).

**Theme default:** `DEFAULT_XF_UI_THEME_PREFERENCE` is **`dark`**. On first visit, if `localStorage` has no **`xf-ui-theme`** key, **`seedDefaultXfUiThemePreferenceIfUnset`** (called from **`XfThemeBootClient`**) writes **`dark`** and notifies subscribers.

## Access request lifecycle

State machine:

- `new -> triaged -> pending -> approved|rejected|expired`
- Terminal states: `approved`, `rejected`, `expired`

SLA expiry window is 7 days (`ACCESS_REQUEST_SLA_DAYS`).

## OAuth and login consistency

Keep these aligned to avoid missing cookie context and callback failures:

- Browser host used during login
- `X_OAUTH_CALLBACK_URL` host (if set)
- X developer app callback URL

## Common login error meanings

- `email_link_required`: no email claim from X, and OAuth identity did not match `ADMIN_SEED_X_USER_ID` (numeric id), `ADMIN_SEED_X_USERNAME` (handle), or a login-eligible role yet
- `access_request_pending`: account exists but lacks login-allowed role
- `bootstrap_failed`: post-auth bootstrap failed (membership/session persistence path)

## App_user HTTP 500 triage

If admin works but app_user routes fail:

1. Verify `GET /api/health` is `200`.
2. Inspect Cloud Run logs around path + auth callback events.
3. Confirm Mongo schema compatibility for user/portfolio identity fields.
4. Re-check callback/env values (especially empty or incorrect callback URL values).
5. Clear cookies after `AUTH_SECRET` rotation.

If incident is deploy-related, continue in `atx-docs/guides/deploy-and-ops.md`.
