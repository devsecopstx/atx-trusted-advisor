# Auth and Access Guide

This is the auth/access entrypoint. Use this page for incident triage, then jump to deep docs for implementation details.

## Deep-dive docs

- `src/modules/identity/authorization.ts` (login/role gate behavior)
- `src/modules/surface-policy.ts` (admin_console vs app_user path policy)
- [tenant-ux-plan.md](../design-system/tenant-ux-plan.md) — **Tenant UX (`tenant_ux`):** route catalog, per-role visibility + default landing (Mongo/UI/enforcement backlog); **`GET /api/admin/platform/route-catalog`**
- `src/proxy.ts` (edge auth: guest-capable **HTML** for `/xoptions`, `/portfolio`, `/portfolios`; other protected pages redirect unauthenticated users to `/xchat`; matched **API** paths → 401 without session; **session grounding** below)
- `GET /api/internal/authz/session-grounding` — used by **`src/proxy.ts`** when **`SESSION_EDGE_GROUNDING`** is enabled (**default on**); validates Mongo user + tenant membership for **`session.tenantId`**
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth dual-run/cutover operations)
- `atx-docs/sre-ops/x-oauth-atx-callbacks.md` (callback host/config checklist)

## Platform roles vs tenant membership

Session payload distinguishes:

- **Platform roles (`roles`)**: `global_admin`, `advisor`, `operator`, `viewer`
- **Tenant membership (`tenantRole`)**: `tenant_admin`, `member`

`app_user` in docs means signed-in product users with platform roles `advisor`, `operator`, or `viewer`; it is not a stored role string.

## Edge session grounding (`SESSION_EDGE_GROUNDING`)

**Shipped:** **≥3.17.x** — For requests that match **`src/proxy.ts`** `config.matcher` and carry **`xf_core_session`**, the proxy **`fetch`**es **`GET /api/internal/authz/session-grounding`** with forwarded **Cookie** (short TTL in-memory cache per cookie value).

**Passes (200 `{ ok: true }`):** Session **`userId`** / **`tenantId`** are valid **ObjectId** hex; **`getCoreUserById`** finds an active, non-suspended user; **`isCoreUserAccountAccessApproved`** (**`core_users.accountStatus`** omitted or **`approved`**); **`resolveTenantMembershipForSessionGrounding`** finds a **`core_tenant_memberships`** row for that user and tenant — canonical **`findOne({ userId, tenantId })`** first, then a bounded scan of the user’s membership rows with **`normalizeTenantIdHexFromStoredMembershipField`** so legacy BSON/string **`tenantId`** shapes still match the session tenant.

**Fails:** **401** JSON **`code`**: `invalid_session`, `user_ineligible`, `account_not_approved`, `no_tenant_membership`. On protected **API** paths the proxy returns **401** **`session_not_grounded`** and clears the session cookie; on **HTML** paths → redirect **`/xchat?error=session_not_grounded`** + cookie clear.

**Transient failures (fail-open):** If the edge **`fetch`** to **`session-grounding`** **throws** (network, timeout ~10s) or the route returns **5xx** / **429**, the proxy **does not** deny or clear the cookie — route handlers still run **`requireSessionUser`** and Mongo checks. Logs **`session_grounding_fetch_error`** with **`failOpen: true`** / **`reason`** (`session_grounding_fetch_throw_or_timeout` or **`session_grounding_upstream_transient`**). **`404`** from the same-origin check is also fail-open (**`reason`**: **`session_grounding_upstream_not_found`**) so **`next dev` (Turbopack)** cold compiles do not clear **`xf_core_session`** while App Router handlers are still registering. This avoids logging users out on refresh when the internal check flakes.

**Disable (break-glass only):** **`SESSION_EDGE_GROUNDING=0`**, **`false`**, or **`no`** — see **`.env.example`**.

**Ops script:** **`npm run ops:users:find-orphans`** — lists **`core_users`** without **`core_tenant_memberships`** (data hygiene; not a substitute for grounding).

## Edge billing + tenant UX policy (same-origin internal `fetch`)

**≥3.17.7** — **`GET /api/internal/authz/billing-access`** and **`GET /api/internal/tenant-ux/policy`** use the same **~10s** **`AbortSignal.timeout`** as session grounding so edge middleware does not hang if origin stalls.

- **Billing:** Non-OK responses or **`fetch`** errors already **fail-open** on **`requiresBilling`** (no session cookie clear).
- **Tenant UX policy:** Malformed JSON on **200** is treated like an outage: **fail-open** (**allow**) unless **`TENANT_UX_POLICY_FAIL_CLOSED`** — then matched **API** paths get **503** **`tenant_ux_policy_unavailable`** (still **no** cookie clear).

## Surface policy

- `admin_console`: `/admin/*` and `/api/admin/*` (`global_admin` only)
- `app_user`: `/xchat`, `/portfolio`, `/portfolios`, `/import-activity`, `/watchlist`, `/account`, `/workspace/tasks`, `/workspace`, `/xoptions` (see `APP_USER_PRODUCT_PATH_PREFIXES` in `surface-policy.ts`)

Reference: `src/modules/surface-policy.ts` and `src/proxy.ts`.

**Future (tenant UX):** Per-tenant **narrowing** of which `app_user` paths each **platform role** may hit — see [tenant-ux-plan.md](../design-system/tenant-ux-plan.md); canonical metadata in **`data/platform/app-user-route-catalog.json`**.

## Open signup + guest trial (X / Google / email)

1. **Any signup** (X OAuth, Google OAuth, **`POST /api/access-requests/public`**, or email-link completion after X-without-email) calls **`provisionOpenSignupTrialAccess`** → **`provisionGuestTrialOperatorAccess`**: platform role **`operator`**, **`accountStatus: approved`**, plan **`basic`**, and a **30-day `trialEndsAt`**. No trial-cookie / marketing intent is required. Do **not** use **`ALLOW_ANY_X_USER_LOGIN`** for this (keep prod **`false`**).
2. **Public email register** (`/signup`, `/xchat` guest, `/account/billing` guest): upserts **`core_users`**, sets initial **`passwordHash`**, provisions trial access, and returns **`status: "approved"`** with **`trialProvisioned: true`**. It does **not** create a blocking pending access request. **Admin → Access requests** remains for role upgrades / manual onboarding.
3. **Billing is optional for product access.** `isAppUserProductAccessAllowedState` allows **`trial_active`**, **`trial_expired`**, **`approved_unpaid`**, **`past_due`**, and **`canceled`** (only **`pending`** / no login role is denied). Proxy and **`POST /api/xchat/ask`** share that helper. A dismissible **trial-until-billing** modal (`TrialBillingNoticeModal` on the workspace product rail) + banner copy encourage completing **`/account/billing`**; dismiss uses **`sessionStorage`**.
4. OAuth still prefers the **`core_users`** row whose **`email`** matches the verified provider email and **moves** `xAccount` / `googleAccount` onto that row when needed. Session creation remains gated by **`core_users.emailVerifiedAt`** where applicable (`error=email_unverified`). Placeholder X identities without a real email stay on **`email_link_required`** until link-email, which then open-provisions trial access.

**Google email:** The Google callback requires a **verified** `email` + `email_verified` from Google userinfo; without that it redirects with `google_email_required`.

**Portfolio tenant on approve (Next.js):** Approval **does not** fall back to the platform default tenant or **`resolveTenantIdForApprovedUserPortfolio`**. The **`admin_access_requests`** row must have **`tenantId`** set when **`status: "approved"`** is applied, and the **same HTTP request** must include **`targetTenantId`** (non-empty 24-char hex), **`requestedPlan`**, and **`requestedRole`** so the admin explicitly confirms assignment (UI sends one **`PUT`**). Otherwise the API returns **400** (validation or code **`access_request_tenant_required`**). Provisioning and **`upsertTenantMembership`** (**`member`**, **`isDefaultTenant: true`**) use that tenant — **not** the approving admin’s **`session.tenantId`**.

**Admin → Access requests:** Per-row **role**, **plan**, and **tenant** pickers; optional **note** on approve/reject (**`reviewNote`**, stored on the request + audit snippet). **Save tenant** / **Save plan only** still issue **`PUT`** with **`targetTenantId`** or **`requestedPlan`** alone. Clearing tenant (**`targetTenantId`: `""`**) removes **`tenantId`** from the row for pending requests; **Approve** remains blocked until a tenant is selected again.

**Names on re-login:** OAuth completion still runs **idempotent** default-book provisioning so the book exists, but repeat runs **must not** reset user-edited **portfolio / account / watchlist names** (or existing **cash** on the default account). Defaults apply only when inserting new rows or when a name was never set. **Broker identity on the default account:** repeat provision **must not** overwrite **`portfolio_accounts.extAccountId`** or **`type`** once the default account row exists (**Next `provisionDefaultPortfolioForUser`**, Spring **`DefaultPortfolioProvisionService.provision`** — **≥3.7.3**), so CSV import matching and Account details edits are not clobbered by the next login or shell provision.

### Admin approval → default book (portfolio, account, watchlist)

When a global admin **approves** an access request (`PATCH`/`PUT` `/api/admin/access-requests/{id}` on **Next**):

1. **Grants:** **`addRoleToCoreUser`**, **`updateCoreUserSubscriptionPlan`**, **`upsertTenantMembership`** (**`member`**, **`isDefaultTenant: true`**) for the request’s **`tenantId`** — same tenant requirement as above.
2. **Book bootstrap (role-aware):** **`ensureTenantBootstrapForUser`** applies **`core_tenants.tenantPreferences.bootstrap_policy`** (structured per-role flags; legacy **`bootstrap_default_portfolio_watchlist`** still maps in). **Default** is **lazy**: first successful **OAuth / Google / email-password** session also calls **`ensureTenantBootstrapForUser`** (idempotent). **Eager on approve** runs only when **`tenantPreferences.bootstrap_on_approve`** is **true** (YAML:**`tenant.bootstrapOnApprove`** on seed specs); failures are **best-effort** (logged / audit; approval still completes). **Watchlist seeds** use tenant **`watchlist_seed_symbols`**, override symbols from policy, else desk defaults (`src/data/default-watchlist-desk-symbols.json`) when **`defaultWatchlist`** is true for that role — **viewers** get no auto-book by default unless policy overrides say otherwise.
3. **Email/password invite:** If the approved user has no **`passwordHash`**, **`issueCredentialInviteForUser`** + desk SMTP (**`sendAccessApprovedPasswordInviteEmail`**) runs; else **`sendAccessApprovedSignInEmail`**. Ordered so xAI quota errors on later bootstrap do **not** block the credential path.
4. **Async xAI bootstrap:** **`enqueueAccessRequestBootstrap`** + microtask **`runAccessRequestBootstrap`** (per-user collection path) — separate from Mongo book provisioning.

**Spring BFF path:** JVM **`DefaultPortfolioProvisionService.provisionForUser`** reads the same tenant **`bootstrap_policy`** / **`watchlist_seed_symbols`** / legacy **`bootstrap_default_portfolio_watchlist`** as Next **`ensureTenantBootstrapForUser`** (skips portfolio when policy denies that platform role). **`bootstrap_on_approve`** and persistence remain Next-first from **`seed:tenant`** and admin tenant APIs.

If X does not expose an email, the UI uses the **link email** step so the user can tie their X identity to the same email they registered with.

## Admin — Manage users (directory + onboarding test)

**≥3.19.1:** **Admin → Desk & operations → Manage users & access** (`/admin/manage-users`; hub entry under **Desk & operations** since **≥3.24.6**) lists **Access requests** first, then **Users** (sortable columns; grouped section headers). **Create user** opens a dedicated card from the toolbar; **User settings** opens broker/portfolio/notification defaults for the selected approved user. Pending onboarding rows (open request + **`core_users`** with no login role) appear **only** in **Access requests** until approval — not duplicated under **Users**. Approve/reject use shield/circle access icons; approval still requires tenant + role + plan on **`PUT /api/admin/access-requests/{id}`**. **Onboarding test** checkbox creates a pending request via **`POST /api/admin/access-requests`** without immediate login provisioning.

## Admin — Manage users (credential invite resend)

**≥3.12.7:** For approved users who still need email/password setup, **Manage users** exposes **Resend invite** when **`resendPasswordInviteAvailable`** is true on **`GET /api/admin/users`** (same rules as approve-time invite: login role, no **`passwordHash`**, non-placeholder email, active, not **`ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY`**). **`POST /api/admin/users/{userId}/resend-credential-invite`** rotates **`credentialInviteTokenHash`** / **`credentialInviteExpiresAt`** and sends **`sendAccessApprovedPasswordInviteEmail`**; audit **`credential_invite_resent`** or **`credential_invite_resend_email_failed`**. Does **not** replace Access Requests approve flow — use when the original mail was missed or the 7-day link expired.

## Admin — Manage users (destructive delete)

**Global admin** → **Admin → Manage users** → **Delete** runs **`DELETE /api/admin/users/{userId}`** after a prompt that requires typing **`DELETE`**. The server **removes all product data** scoped to that user id **and** normalized email before deleting the **`core_users`** row: portfolios (and nested accounts, positions, watchlists, portfolio-scoped recommendations/alerts/channels), **`core_tenant_memberships`**, **`admin_user_settings`**, **`admin_access_requests`**, **`options_strategy_preferences`**, **`app_user_recommendations`**, **`xchat_logs`**, **`app_feature_daily_usage`**, **`strategy_jobs`**, **`audit_login`** (by user id and by email when purging a full user), **`admin_user_bootstrap_profiles`**, and disabled **`admin_scheduled_tasks`** rows named **`access-request-bootstrap:{email}`**. Admins **cannot** delete their **own** user id from this route (**400**).

**OAuth merge** of a placeholder X user into an existing email account still uses **`purgeEphemeralCoreUserScaffolding`** only (same user id, **no** email-keyed deletes) so another user’s bootstrap or login-audit rows are not touched.

## App user shell (header profile + left rail)

**Signed-in header** (`AppUserHeaderSession`, avatar menu): **Plans & billing** → `/account/billing`, **Legal** → `/legal/terms`, then **Appearance** in a **collapsed** `<details>` (expand for Light / Dark / System via `XfThemePreferenceMenu`). **Submit feedback** and **Sign out** stay in the menu actions block.

**Workspace product rail — footer profile** (**≥3.17.10**, `WorkspaceProfileFooterMenu` under **`WorkspaceProductSidebar`**): The bottom avatar row opens a **portal** menu anchored **above** the trigger (bottom-up animation). Menu items include **Profile** → `/account/billing`, **Legal**, **Resources** → `/resources/guides` when the tenant route policy allows it, **Feedback** (same modal pattern as the header — `RailUserFeedbackDialog` / `USER_FEEDBACK_OPEN_EVENT`), **Settings** / **Reference docs** / **Admin hub** for **global_admin** when applicable, optional **Link Google**, **Plans & billing** → `/account/billing` (row placed **directly above** **Sign out**), and **Sign out** (destructive confirm + bracket-style icon). **`Ctrl/Cmd+Shift+L`** opens the sign-out confirmation when focus is not in an editable field.

**Left rail — Account** (`AppUserAccountRailSection`): **Settings** only — **global_admin** links to `/admin/manage_account`; other roles see a muted “Settings” note. **Plans & billing** and **Legal** are **not** duplicated here (use the header or workspace footer profile menu). If there is nothing to show (e.g. guest shell with `showSettingsLink={false}`), the Account section is omitted.

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
- `email_unverified`: account has login role but `core_users.emailVerifiedAt` is missing; verification token/email was (best-effort) issued and OAuth session is denied until verify-email completes
- `bootstrap_failed`: post-auth bootstrap failed (membership/session persistence path)
- `session_not_grounded`: edge proxy rejected the session after **`GET /api/internal/authz/session-grounding`** returned **401** (stale cookie, suspended/rejected/unapproved user, missing membership) or another **non-2xx** response that is **not** in the proxy’s fail-open set (see § Edge session grounding)

## App_user HTTP 500 triage

If admin works but app_user routes fail:

1. Verify `GET /api/health` is `200`.
2. Inspect Cloud Run logs around path + auth callback events.
3. Confirm Mongo schema compatibility for user/portfolio identity fields.
4. Re-check callback/env values (especially empty or incorrect callback URL values).
5. Clear cookies after `AUTH_SECRET` rotation.

If incident is deploy-related, continue in `atx-docs/guides/deploy-and-ops.md`.
