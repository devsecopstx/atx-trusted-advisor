# Tenant UX edge enforcement (V2)

**Scope:** Next.js **`src/proxy.ts`** — authenticated **app_user** HTML + matched API paths — enforced when **`TENANT_UX_ENFORCEMENT_V2`** is enabled (`1` / `true` / `yes`).

## Rollout

1. **Staging first** — set env on the **Next** Cloud Run service; validate core flows (`/xchat`, `/portfolios`, `/portfolio`, `/xoptions`, `/xcoach`) for seeded tenants and a tenant with **restricted** routes.
2. **Soak** — **48–72 hours** minimum with monitoring; confirm **`tenant_ux_policy_fetch_error`** logs are rare and investigated when present.
3. **Production** — enable per environment; optional **tenant allowlist** via a future **`core_tenants`** flag if product needs phased rollout (not required for env-wide flip).

## Environment

| Variable | Default | Behavior |
|----------|---------|----------|
| **`TENANT_UX_ENFORCEMENT_V2`** | off | When **on**, proxy calls **`GET /api/internal/tenant-ux/policy?pathname=…`** (session cookie forwarded). |
| **`TENANT_UX_POLICY_FAIL_CLOSED`** | off | When **on**, **non-OK** or **network error** from the policy route returns **503** **`tenant_ux_policy_unavailable`** (API) or **`/access-denied?code=tenant_ux_policy_unavailable`** (HTML). When **off** (**soak default**), failures **fail-open** (allow request) and emit one-line JSON stderr: **`type: tenant_ux_policy_fetch_error`**. |

See repo **`.env.example`** for canonical comments.

## Operator checklist (misconfig)

1. User reports **`/access-denied`** — confirm role + **`tenant_roles`** / route-catalog overrides in **Admin → Tenants → Roles** or **`PATCH /api/admin/platform/route-catalog/{tenantId}`**.
2. **Reset toward catalog defaults** — adjust overrides or restore **`tenant_roles`** via **`PUT /api/admin/tenants/{tenantId}/roles`**.
3. **Audit** — `admin_audit_events` for **`tenant_roles.update`**, **`tenant_ux.route_catalog.patch`**.

## References

- [tenant-ux-plan.md](../design-system/tenant-ux-plan.md)
- [current-state-features.md](../design-system/current-state-features.md) § Tenant UX
- `src/modules/platform/tenant-ux-proxy-policy-path.ts`
