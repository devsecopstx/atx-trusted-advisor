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

Prints the new/updated tenant **ObjectId** (hex). With **`tenant.initialTenantAdmin`**, the script also upserts **`core_users`** and **`core_tenant_memberships`** (see below).

## Phase 1 provisioning contract

Optional block **`tenant.initialTenantAdmin`** (object):

| Field | Required | Notes |
| ----- | -------- | ----- |
| **`email`** | yes | Normalized to lowercase; must look like an email. |
| **`xUserId`** | no | X REST API user **`id`** (often numeric) **or** **username / @handle** (e.g. `Somegoodnewsatx`); leading **`@`** is stripped. OAuth matches id on `xAccount.xUserId` first, then handle on `xAccount.username` / `xAccount.xUserId`. Must not already be linked to another **user** (email). |
| **`platformRole`** | no | One of **`advisor`**, **`operator`**, **`viewer`**. Default **`operator`**. Required for app login (`tenant_admin` alone is not a platform login role). |
| **`setAsDefaultSessionTenant`** | no | Default **`true`**. When true, other memberships for this user get **`isDefaultTenant: false`** so the new tenant becomes the session default. Set **`false`** only if the user should keep another default (they need another default membership or they may not resolve a session tenant). |

Optional **`tenant.tenantPreferences`**:
- **`xf_ui_theme`**: **`light`** | **`dark`** | **`system`** — default shell density for users who have not chosen a theme in the UI yet (`light` → soft, `dark` → deep, `system` → follows OS).
- **`xchat_brandname`**, **`xstrategybuilder_brandname`**: strings, trimmed, max 80 chars.

Merged with dotted Mongo paths so other keys (e.g. admin-set flags) are not wiped.

Idempotent: safe to re-run; **`isDefault`** on the tenant row is always forced **`false`** (never steals platform default tenant from **`seed:admin`**).

## Locked decisions (pre–Phase 2)

- **Roles:** **`operator`** (default) or **`advisor`** + **`tenant_admin` membership** — not **`global_admin`** unless `/admin` access is intended.
- **Auth:** Real **email** + optional **`xUserId`** (API id or handle) in YAML; fully seeds **`xAccount`** when set. X OAuth resolves by API **`id`**, then by **handle** on stored `xAccount` fields. **Google:** same email row; OAuth links `googleAccount` on first sign-in — **`xUserId` not required** for Google-only admins.
- **Branding:** Display aliases only; no per-tenant regulatory claims. **v1:** names in `tenantPreferences`; logos/colors later.
- **Provisioning:** **CLI + YAML** for v1.

## Rules

- **`slug`**: lowercase letters, digits, single hyphens (no leading/trailing hyphen). Unique in `core_tenants`.
- **`isDefault`**: must stay **`false`** for specs applied via `seed:tenant`. The single default tenant remains `atxfinance-core` from `seed:admin`.
- **`workspaceLimits`**: optional partial override (same shape as `core_tenants.workspaceLimits` in app code).

## Example

See `_example.yaml`.
