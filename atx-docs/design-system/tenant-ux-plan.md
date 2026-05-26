# Tenant UX (`tenant_ux`) — per-role routes, landing, white-label chrome

**Status:** **Shipped** in repo for core flows. **Backlog:** the dedicated **`tenant_ux` V2** row was **removed from [`PLAN.md`](../PLAN.md) in May 2026** after multi-role field soak (global admin, tenant admin, app_user). Edge V2 remains an **ops toggle** (`TENANT_UX_ENFORCEMENT_V2`) with optional GCP alerts per [tenant-ux-enforcement.md](../sre-ops/tenant-ux-enforcement.md). **Compliance:** Branding is **display-only** — do not imply different regulatory posture per tenant (`AGENTS.md`, multi-tenant roadmap **10**).

**Related:** [PLAN.md](../PLAN.md) priority **10** (provisioning / bootstrap v1); consolidated architecture: [current-state-features.md](./current-state-features.md) § Tenant UX; ops runbook: [tenant-ux-enforcement.md](../sre-ops/tenant-ux-enforcement.md).

---

## Goals

1. **`global_admin`** configures, per **tenant**, which **user-facing** paths each **platform role** may access: **`global_admin`**, **`advisor`**, **`operator`**, **`viewer`**.
2. Each role has a **default landing path** when policy redirects away from a disallowed route.
3. **Canonical metadata** is versioned in-repo (`app-user-route-catalog.json`); **Mongo** stores **overrides**, **`tenantRoles`**, and **branding** prefs.

**Not in scope:** Replacing **`canUserLogin`** / access-request approval — tenant UX **narrows** surfaces after login.

---

## Shipped (product + engineering)

| Artifact | Notes |
|----------|--------|
| **Route catalog** | `data/platform/app-user-route-catalog.json` — includes **`/xcoach`** with `inWorkspaceProductShell: true` (aligned with `APP_USER_PRODUCT_PATH_PREFIXES`). |
| **Prefixes** | `src/modules/platform/app-user-product-prefixes.ts` — **`/xchat`**, **`/xcoach`**, portfolio, watchlist, xOptions, account, workspace, import-activity. |
| **Platform modules** | `app-user-route-catalog.ts`, `tenant-route-policy.ts`, `tenant-ux-policy-cache`, **`tenant-ux-proxy-policy-path.ts`** (`resolvePolicyPathForRequest`). |
| **Admin APIs** | `GET /api/admin/platform/route-catalog`, `GET/PATCH /api/admin/platform/route-catalog/{tenantId}` (**PATCH** → **`admin_audit_events`** `tenant_ux.route_catalog.patch`). |
| **Role matrix APIs + UI** | `GET/PUT /api/admin/tenants/{tenantId}/roles`, `PATCH .../roles/{role}`; **`/admin/tenants/{tenantId}/roles`**; defaults include **`/xcoach`** for all platform roles. |
| **Runtime guards** | Page-level redirects; workspace rail filtering; **`/access-denied`**. |
| **Edge V2** | `src/proxy.ts` — internal **`GET /api/internal/tenant-ux/policy`**; matcher includes **`/xcoach`**; fail-open + JSON log **`tenant_ux_policy_fetch_error`**; optional **`TENANT_UX_POLICY_FAIL_CLOSED`**; session fail-closed drill cookie via **`/api/admin/platform/tenant-ux/fail-closed-drill`**. |
| **Policy cache bust + observability** | **`bustTenantUxPolicyCacheForTenant`** on role/catalog mutations + **`POST /api/admin/tenants/{tenantId}/policy-cache`**; Mongo **`tenant_ux_observability_events`**; **`GET /api/admin/platform/tenant-ux/observability`** + hub panel. |
| **PWA manifest** | **`src/app/manifest.ts`** — tenant **`name`**, **`theme_color`**, optional **`xf_tenant_logo_url`** icon when signed in (no duplicate **`public/manifest.webmanifest`**). |
| **xChat / batch** | Tenant desk line in **system prompt** + remote-chain fingerprint; welcome header line on approved shell; xChat **batch** inherits tenant block when tenant known. |
| **Branding tokens** | `tenantPreferences` (`xf_accent_color`, **`xf_tenant_logo_url`**, **`xf_tenant_tagline`**, `xf_ui_theme`, brand aliases); **`--xf-tenant-primary`**, **`--xf-tenant-secondary`** in brand kit + root layout + **`TenantBrandingProvider`**. |
| **Guest landing (May 2026)** | `/` and `/home` render **`PublicMarketingLanding`** with variant **`hnwi`** (Austin retail) or **`advisor`** (firm desk). Resolution: `?for=hnwi|advisor` → cookie **`xf_guest_landing_for`** → **`tenantPreferences.guest_landing_audience`** → default **`hnwi`**. Edge: **`src/proxy.ts`** persists `?for=` on marketing paths; **`/xchat`** guest HTML shell allowed at URL (matcher + **`allowsGuestHtmlRender`**). Modules: **`src/lib/marketing/guest-landing-variant.ts`**, **`guest-landing-page.ts`**, **`guest-landing-copy.ts`**. Catalog rows: **`home`**, **`home_alias`**. |
| **Ambient Market Veil** | `tenantPreferences.ambient_market_veil` (boolean, **default-on**) — gates the layered ambient background on `/xchat`, `/xoptions`, `/portfolios`. Stack: **Austin skyline `<img>`** (`/branding/atx-skyline.jpg`, `fetchpriority="low"`, `decoding="async"`, **B&W watermark** via `filter: grayscale(100%) contrast(0.92) brightness(1.05)` + opacity `0.22` so the city reads as a quiet brand mark, not a focal point — WCAG AA preserved against `--xf-text-100` because all product chrome uses opaque `--xf-bg-800` / surface tokens) → **readability gradient** (top-down 0.32→0.42→0.58 dim, lightened to compensate for the dimmer skyline) → **Canvas2D grid/particles**. Surfaced through **`WorkspaceTenantHeaderContext.ambientMarketVeilEnabled`** (`src/lib/workspace-tenant-header.ts`) and resolved via **`isAmbientMarketVeilEnabledForTenant`** (`src/modules/identity/tenant-branding-preferences.ts`). Admin toggle at **`/admin/tenant-preferences/ambient`** (PATCH `tenantPreferences.ambient_market_veil` → `updateTenantAmbientMarketVeil`); dev preview at **`/dev/veil`** (skyline / overlay toggles + opacity slider + filter input). Tunables: **`--veil-opacity`** (default `0.09`), **`--veil-grid-speed`** (default `1.0`), **`--veil-particle-count`** (default `28`), optional **`--veil-accent`** (falls back to `--xf-tenant-accent`); **prop overrides** `skylineSrc` (string \| `null` to disable), `overlay` (CSS `background` value \| `null`), **`skylineFilter`** (CSS `filter` chain, default grayscale watermark — pass `none` for full-colour), and **`skylineOpacity`** (0–1, default `0.22`) for tenant white-label without CSS plumbing. |

---

## Soak backlog (ops — metrics owners TBD)

Engineering backlog for the former **PLAN 11** row is **closed** (May 2026 field soak); treat the rows below as **runbook / SRE** tasks when enabling V2 in each environment.

| Item | Success signal |
|------|----------------|
| **Staging V2 soak** | `TENANT_UX_ENFORCEMENT_V2=true` for **48–72h**; zero unexpected **`tenant_ux_route_forbidden`** for allowed roles; support playbook exercised. |
| **API family coverage** | **Shipped:** Vitest audit **`tests/unit/tenant-ux-policy-audit.test.ts`** + **`resolvePolicyPathForRequest`** for matcher-covered app_user APIs (add rows when new product **`/api/...`** ships under V2). |
| **Nav/header parity** | **Shipped:** `useTenantUxNavVisibility` + `isPathAllowedByTenantUxRoutes` (prefix subtree match, aligned with server policy) — workspace sidebar/top chrome, macro tape desk nav, xChat composer shortcuts, approved header brand + Tasks pill, legacy manage-workspace rail, `AppUserProductNav`. Edge remains authoritative. |
| **Observability** | **Shipped:** Mongo **`tenant_ux_observability_events`** + admin **`GET /api/admin/platform/tenant-ux/observability`** (recent events + replay). **Remain:** GCP log-based metrics / alerts on **`tenant_ux_route_forbidden_total`**, **`tenant_ux_policy_fetch_latency_ms`**, **`tenant_ux_policy_unavailable_total`**, **`tenant_ux_policy_fetch_error`** — see [tenant-ux-enforcement.md](../sre-ops/tenant-ux-enforcement.md). |
| **Policy cache** | **Shipped:** Redis **`tenant-ux:policy:v2:{userId}:{tenantId}`** (**60s** TTL) + SCAN/DEL bust for tenant on **`tenant_roles`** / route-catalog **`PATCH`** + manual **`POST /api/admin/tenants/{tenantId}/policy-cache`** (`[tenant-ux] explicit policy bust…` log). [redis-cache-next.md](../sre-ops/redis-cache-next.md). |
| **PWA manifest** | **Shipped:** **`src/app/manifest.ts`** (session + tenant branding); static duplicate removed from **`public/`** so the App Router manifest wins at **`/manifest.webmanifest`**. |
| **Denial audit (optional)** | High-volume; prefer metrics first — sampled **`admin_audit_events`** only if compliance mandates. |

---

## Role reference

Platform roles: **`global_admin`**, **`advisor`**, **`operator`**, **`viewer`** (`src/modules/identity/authorization.ts`). **`tenantAssignableRoles`**: advisor, operator, viewer.

---

## Drift control

- New app_user **top-level prefix**: extend **`APP_USER_PRODUCT_PATH_PREFIXES`**, add catalog row with **`inWorkspaceProductShell: true`** where appropriate — **`assertCatalogMatchesWorkspaceProductPrefixes`** fails on mismatch.
- Bump **`schemaVersion`** when breaking catalog shape.

---

## See also

- **`src/modules/surface-policy.ts`**
- **`src/proxy.ts`**
- **`atx-docs/guides/auth-and-access.md`**
