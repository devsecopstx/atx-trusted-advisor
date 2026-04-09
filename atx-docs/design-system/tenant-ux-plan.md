# Tenant UX (`tenant_ux`) — per-role routes & landing

**Status:** **Partially shipped** in repo (catalog + admin export API). **Open:** Mongo-backed overrides, admin **`tenant_roles`** UI, runtime enforcement.

**Related:** Multi-tenant roadmap row in [PLAN.md](../PLAN.md) (priority **10**); this plan is the **app-user navigation / compliance** slice (which HTML routes each **platform role** may see and **default landing** after login).

---

## Goals

1. **`global_admin`** configures, per **tenant** (platform/compliance), which **user-facing** paths each **platform role** may access: **`global_admin`**, **`advisor`**, **`operator`**, **`viewer`**.
2. Each role has a **default landing path** (post-login / “home”) when the tenant policy allows it.
3. **Canonical metadata** stays versioned in-repo for drift control; **Mongo** (or equivalent) stores **overrides** and auditability.

**Not in scope for v1 of this doc:** Changing coarse **`canUserLogin`** behavior — tenant UX **narrows** product surfaces; it does not replace access-request approval.

---

## Shipped in repo

| Artifact | Purpose |
|----------|---------|
| **`data/platform/app-user-route-catalog.json`** | Versioned catalog: `entries[]` with `pathPattern`, `pathMatch`, `label`, `groupId`, `complianceSummary`, `defaultVisibleForRoles`, `guestHtmlShell`, `inWorkspaceProductShell`, optional `redirectsTo` / `implementationNote`; `suggestedDefaultLandingPathByRole`; `groups`. |
| **`src/modules/platform/app-user-route-catalog.ts`** | Zod validation, **`getAppUserRouteCatalog()`**, **`isPathVisibleForRoleByCatalogDefaults()`**, test helper **`assertCatalogMatchesWorkspaceProductPrefixes()`** (must match **`APP_USER_PRODUCT_PATH_PREFIXES`** in **`surface-policy.ts`**). |
| **`GET /api/admin/platform/route-catalog`** | **`global_admin` only** — returns parsed catalog JSON for **DB import** / compliance tooling. OpenAPI: **`CURRENT_STATE_ROUTES`**. |
| **Tests** | `tests/unit/app-user-route-catalog.test.ts`, `tests/integration/admin-platform-route-catalog.test.ts` |

**Import workflow:** `curl` the GET with admin session cookie, or copy **`data/platform/app-user-route-catalog.json`** into your ETL.

---

## Open backlog (product / engineering)

1. **Mongo schema** (names indicative): e.g. `tenant_role_route_policy` keyed by **`tenantId`** + **`role`**, storing **allowed path patterns** (or diffs vs catalog defaults), **`defaultLandingPath`**, **`updatedAt`**, **`updatedBy`**.
2. **Admin UI** — **`/admin/.../tenant-roles`** (exact path TBD): matrix editor (routes × roles), default landing pickers, “reset to catalog defaults” per tenant.
3. **Write API** — `PUT/PATCH` (or `POST`) under **`/api/admin/tenants/:tenantId/...`** for policy mutations; **audit** events.
4. **Runtime enforcement** — after session resolve:
   - **HTML:** `src/proxy.ts` and/or **layouts** for app_user shells: if path not allowed for **effective role**, redirect to role **default landing** or **403** page.
   - **API:** align **`/api/app-user/*`** (and any unauthenticated guest exceptions) with the same policy so the UI cannot bypass with direct fetch.
5. **Nav generation** — **`WorkspaceProductSidebar`**, **`app_user-product-nav.tsx`**, headers: hide or disable links for disallowed routes (avoid “click → redirect”-only UX where possible).
6. **Proxy gap** — Catalog notes **`/xcoach`** matcher alignment in **`src/proxy.ts`**; fix when xCoach is policy-gated.

---

## Role reference

Platform roles (**`roles`** on session): **`global_admin`**, **`advisor`**, **`operator`**, **`viewer`** (`src/modules/identity/authorization.ts`).

- **`tenantAssignableRoles`** in catalog: **`advisor`**, **`operator`**, **`viewer`** — typical access-request / manage-users targets.
- **`global_admin`**: admin console + optional app shell; default landing in catalog seed is **`/admin`**.

---

## Drift control

- When adding a new **app_user** top-level prefix, update **`APP_USER_PRODUCT_PATH_PREFIXES`** and add a matching **catalog** row with **`inWorkspaceProductShell: true`** — unit test **`assertCatalogMatchesWorkspaceProductPrefixes`** fails on mismatch.
- Bump **`schemaVersion`** in JSON when breaking shape; teach Zod + migrators if needed.

---

## See also

- **`src/modules/surface-policy.ts`** — product path prefixes vs admin console.
- **`src/proxy.ts`** — edge guest HTML vs redirect matrix.
- **`atx-docs/guides/auth-and-access.md`** — roles and access lifecycle.
