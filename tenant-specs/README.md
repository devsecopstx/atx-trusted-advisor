# Tenant specs (`tenant-specs/*.yaml`)

YAML files here describe **additional** `core_tenants` rows (multi-tenant operators). They are **not** a replacement for `tenant_defaults.yaml` (global seed defaults for `npm run seed:admin`).

## Create a spec

Interactive:

```bash
npm run generate:tenant-spec
```

Non-interactive:

```bash
npm run generate:tenant-spec -- --slug acme-advisors --name "Acme Advisors" --email admin@acme.com --xid "123456789" --theme light
```

Omit `--email` in CI/non-interactive mode to skip the **`initialTenantAdmin`** block. Omit **`--xid`** or pass empty when using Google-only admins.

Optional output path:

```bash
npm run generate:tenant-spec -- --slug acme-advisors --name "Acme Advisors" --email admin@acme.com --out tenant-specs/acme-advisors.yaml
```

## Apply to MongoDB

Uses `MONGODB_URI` / DB name from `.env` (same as `seed:admin`).

```bash
npm run seed:tenant -- --file tenant-specs/acme-advisors.yaml
```

**Stuck / slow:** The last step may call the **xAI Management API** (`list` / `create` collection). There is no request timeout; a bad network can hang. Use:

```bash
SKIP_SEED_TENANT_XCHAT_TEAM_COLLECTION=1 npm run seed:tenant -- --file tenant-specs/acme-advisors.yaml
```

The tenant document (including **`rentalProfile`** provisioning when present) still completes; only the optional **`xchat_team_attachments_collection_id`** on `tenantPreferences` is skipped — you can retry later when the API is reachable.

Prints the new/updated tenant **ObjectId** (hex). With **`tenant.initialTenantAdmin`**, the script also upserts **`core_users`** and **`core_tenant_memberships`** (see below).

## Live tenant export (admin UI / background queue)

For drift review against YAML specs without hand-copying Mongo:

1. **Admin → Tenant register →** choose tenant **→ Workspace limits → Export jobs** — queue **live spec YAML** and/or **bootstrap audit CSV**.
2. Jobs persist in **`tenant_admin_export_jobs`** (`pending` → `running` → `completed` / `failed`).
3. Drain with scheduled task category **`tenant_export_worker`** (create **one** tenant-scoped row under **Admin → Tasks**, or **Run** manually after queueing). This category is **excluded** from `npm run ops:scheduled-tasks:sync` bulk upsert — add deliberately per environment.
4. Completed jobs show download links (YAML + CSV). CSV covers `tenant_provision_bootstrap` audit rows (capped at 5k).

## Phase 1 provisioning contract

Optional block **`tenant.initialTenantAdmin`** (object):

| Field | Required | Notes |
| ----- | -------- | ----- |
| **`email`** | yes | Normalized to lowercase; must look like an email. |
| **`xUserId`** | no | X REST API user **`id`** (often numeric) **or** **username / @handle** (e.g. `Somegoodnewsatx`); leading **`@`** is stripped. OAuth matches id on `xAccount.xUserId` first, then handle on `xAccount.username` / `xAccount.xUserId`. Must not already be linked to another **user** (email). |
| **`platformRole`** | no | One of **`advisor`**, **`operator`**, **`viewer`**. Default **`operator`**. Required for app login (`tenant_admin` alone is not a platform login role). |
| **`setAsDefaultSessionTenant`** | no | Default **`true`**. When true, other memberships for this user get **`isDefaultTenant: false`** so the new tenant becomes the session default. Set **`false`** only if the user should keep another default (they need another default membership or they may not resolve a session tenant). |

Optional **`tenant.tenantPreferences`**:
- **`xf_ui_theme`**: **`light`** | **`dark`** | **`system`** — default shell density for users who have not chosen a theme in the UI yet (`light` → soft, `dark` → deep, `system` → follows OS). **`XfThemeBootClient`** reapplies when the OS scheme changes while preference is **`system`**.
- **`xf_accent_color`**: CSS hex **`#rgb`** / **`#rrggbb`** — drives **`--xf-tenant-accent`** (workspace sidebar active states, xOptions row, checkboxes, tenant header border). Default when omitted: **`#8b5cf6`** (same token family as **`--xf-xoptions-accent`**).
- **`xf_tenant_logo_url`**: product header + **workspace sidebar** logo — **`https://…`**, dev **`http://localhost`** / **`127.0.0.1`**, or **`data:image/…;base64,…`** (larger cap than hero; see `src/lib/tenant-logo-url.ts`).
- **`xf_tenant_tagline`**: optional subtitle under tenant **display name** in sidebar + header (max 60 chars).
- **`xchat_brandname`**, **`xstrategybuilder_brandname`**: strings, trimmed, max 80 chars.
- **`xf_brand_palette`**: **`default`** | **`violet`** | **`cyan`** | **`amber`** | **`rose`** | **`emerald`** — accent preset for tenant shells (see `src/lib/tenant-branding-palette.ts`).
- **`xf_hero_icon_url`**: hero / marketing icon — **`https://…`**, **`http://localhost`** / **`127.0.0.1`** only for dev, or **`data:image/png|jpeg|webp|gif|svg+xml;base64,…`** (length cap ~450k chars; prefer hosting for large assets).
- **`watchlist_seed_symbols`**: optional string array (max **48** tickers, uppercased on persist) for tenant-level watchlist templates when auto-watchlist is on — see bootstrap policy below.

**Bootstrap policy (PLAN 10, YAML under `tenant`):**

- **`bootstrapPolicy`** (object) — maps to Mongo **`tenantPreferences.bootstrap_policy`**: **`defaultPortfolio`** and **`defaultWatchlist`**, each an object with **`viewer`**, **`operator`**, **`advisor`** booleans. Optional **`overrides`**: **`role`**, optional **`defaultPortfolio`** / **`defaultWatchlist`**, optional **`symbols`** (tickers). Omit for defaults (viewers: no auto-book; operators/advisors: book + desk list from `src/data/default-watchlist-desk-symbols.json`).
- **`bootstrapOnApprove`** (boolean) — maps to **`tenantPreferences.bootstrap_on_approve`**. **Default false:** book provisioning runs on **first successful login** (idempotent). **True:** also runs **best-effort** during access-request approve (failures do not block approval).

**Validation / generator parity:** `src/lib/tenant-spec-v1-parse.ts` (**`npm run seed:tenant`**, admin tenant create); `scripts/lib/tenant-spec-schema.mjs` (**`npm run generate:tenant-spec`**).

**Runtime / merge:** `getTenantShellBrandingForHex` reads branding keys above; bootstrap prefs are consumed by **`ensureTenantBootstrapForUser`** (`src/modules/core-admin/tenant-user-bootstrap.ts`). Merged with dotted Mongo paths so other keys are not wiped.

Idempotent: safe to re-run; **`isDefault`** on the tenant row is always forced **`false`** (never steals platform default tenant from **`seed:admin`**).

## Locked decisions (pre–Phase 2)

- **Roles:** **`operator`** (default) or **`advisor`** + **`tenant_admin` membership** — not **`global_admin`** unless `/admin` access is intended.
- **Auth:** Real **email** + optional **`xUserId`** (API id or handle) in YAML; fully seeds **`xAccount`** when set. X OAuth resolves by API **`id`**, then by **handle** on stored `xAccount` fields. **Google:** same email row; OAuth links `googleAccount` on first sign-in — **`xUserId` not required** for Google-only admins.
- **Branding:** Display aliases + optional **`xf_brand_palette`** / **`xf_hero_icon_url`** in `tenantPreferences`; product surfaces consume when wired. No per-tenant regulatory claims in stored copy.
- **Provisioning:** **CLI + YAML** for v1.

## Rules

- **`slug`**: lowercase letters, digits, single hyphens (no leading/trailing hyphen). Unique in `core_tenants`.
- **`isDefault`**: must stay **`false`** for specs applied via `seed:tenant`. The single default tenant remains `atxfinance-core` from `seed:admin`.
- **`workspaceLimits`**: optional partial override (same shape as `core_tenants.workspaceLimits` in app code). Omitting it still yields **persisted defaults** on upsert (`npm run seed:tenant` / **`POST /api/admin/tenants`**) so Admin **Tenant register** is not stuck on `null`. Per-plan overrides and the full form: **`/admin/tenant-register/{tenantId}/workspace-limits`** or session-tenant **`/admin/tenant-preferences/workspace-limits`**.
- **`rentalProfile`** (optional): AI rental / white-label tier — **`tier`**, **`strategyBias`** (`conservative` \| `balanced` \| `aggressive`), **`maxPortfolios`**, **`maxDailyTokens`**, optional **`xaiModelOverride`**, **`expiresAt`** (ISO-8601), **`apiKeyEnabled`**. When present, **`npm run seed:tenant`** upserts a default **published** rental persona and sets **`rentalProfile.defaultPersonaId`** + **`rentalExpiresAt`**. Validation: `src/modules/platform/tenant-rental-profile.ts`. Ops: **`atx-docs/sre-ops/rental-ai-platform.md`**.

## Example

See `_example.yaml`.
