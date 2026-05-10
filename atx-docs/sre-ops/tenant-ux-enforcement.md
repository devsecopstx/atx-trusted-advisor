# Tenant UX edge enforcement (V2)

**Scope:** Next.js **`src/proxy.ts`** — authenticated **app_user** HTML + matched API paths — enforced when **`TENANT_UX_ENFORCEMENT_V2`** is enabled (`1` / `true` / `yes`).

## Rollout

1. **Staging first** — set env on the **Next** Cloud Run service; validate core flows (`/xchat`, `/portfolios`, `/portfolio`, `/xoptions`, `/xcoach`) for seeded tenants and a tenant with **restricted** routes.
2. **Soak** — **48–72 hours** minimum with monitoring; confirm **`tenant_ux_policy_fetch_error`** logs are rare and investigated when present.
3. **Production** — enable per environment; optional **tenant allowlist** via a future **`core_tenants`** flag if product needs phased rollout (not required for env-wide flip).

## Environment

| Variable | Default | Behavior |
|----------|---------|------------|
| **`TENANT_UX_ENFORCEMENT_V2`** | off | When **on**, proxy calls **`GET /api/internal/tenant-ux/policy?pathname=…`** (session cookie forwarded). |
| **`TENANT_UX_POLICY_FAIL_CLOSED`** | off | When **on**, **non-OK** or **network error** from the policy route returns **503** **`tenant_ux_policy_unavailable`** (API) or **`/access-denied?code=tenant_ux_policy_unavailable`** (HTML). When **off** (**soak default**), failures **fail-open** (allow request) and emit one-line JSON stderr: **`type: tenant_ux_policy_fetch_error`**. |

See repo **`.env.example`** for canonical comments. **Staging soak:** enable **`TENANT_UX_ENFORCEMENT_V2=true`** on the Next service for **48–72h** before prod; keep **`TENANT_UX_POLICY_FAIL_CLOSED=false`** unless you are exercising explicit fail-closed drills.

## Fail-open vs fail-closed (authoritative)

| Condition | `TENANT_UX_POLICY_FAIL_CLOSED` **off** | **on** |
|-----------|----------------------------------------|--------|
| Policy **`fetch`** throws / times out | Allow request; **`tenant_ux_policy_fetch_error`** log | Deny: API **503** `tenant_ux_policy_unavailable`; HTML redirect **`/access-denied`** with `code=tenant_ux_policy_unavailable` |
| Policy HTTP **non-OK** | Allow + fetch error log | Same denial as above |
| Policy **200** with **invalid JSON** | Allow + fetch error log (`reason: tenant_ux_policy_invalid_json`) | Same denial as above |
| Policy **200** ok JSON, **`allowed: false`** | Deny: API **403** `tenant_ux_route_forbidden`; HTML **`/access-denied`** | Same |

**Cookie forwarding:** Internal policy URL is same-origin; proxy forwards the incoming **`cookie`** header only (no secret headers).

## Edge policy cache

- **Proxy (session × pathname):** in-memory **`Map`** TTL **60s** (`TENANT_UX_PROXY_POLICY_TTL_MS` in **`src/proxy.ts`**) — avoids hammering the internal route on navigation bursts.
- **Policy resolver (`getCachedTenantUxPolicyForSession`):** memory TTL **60s** + **Redis** (`tenant-ux:policy:v2:{userId}:{tenantId}`, **60s** TTL) when **`REDIS_URL`** is configured (`src/modules/platform/tenant-ux-policy-cache.ts`). **Dev and prod** Next services mount **`REDIS_URL`** — Redis is **in use** for tenant UX policy there; if Redis is down or unset, the resolver falls back to memory-only + Mongo on miss. Full key/TTL notes: **[redis-cache-next.md](./redis-cache-next.md)** § Tenant UX policy.

## Internal policy contract

**`GET /api/internal/tenant-ux/policy?pathname=/prefix`**

- **Auth:** Session cookie (`requireSessionUser`).
- **Query:** **`pathname`** — normalized (leading slash, trim trailing slash except `/`).
- **200 JSON:**

```json
{
  "data": {
    "allowed": true,
    "pathname": "/xchat",
    "role": "viewer",
    "allowedRoutes": ["/xchat", "/portfolio"],
    "redirectPath": "/xchat",
    "flags": {}
  }
}
```

- **`global_admin`:** **`allowed`** is always **true** (policy route short-circuits).
- **Consumer:** Edge proxy matcher only; not a public product API.

## Observability (structured stderr)

Logs are **JSON one-liners** suitable for Cloud Logging metric filters.

| Field / line | When |
|--------------|------|
| **`type: tenant_ux_metric`**, **`metric: tenant_ux_policy_fetch_latency_ms`**, **`policyPath`**, **`ms`**, **`httpStatus`**, **`ok`** | After each **non-cached** internal policy **`fetch`** completes (including thrown **`fetch`** with **`ms: -1`**) |
| **`type: tenant_ux_metric`**, **`metric: tenant_ux_route_forbidden_total`**, **`pathname`**, **`policyPath`** | User/API denied because policy returned **`allowed: false`** |
| **`type: tenant_ux_metric`**, **`metric: tenant_ux_policy_unavailable_total`**, **`pathname`**, **`policyPath`** | Denied with **503** / **`tenant_ux_policy_unavailable`** — emitted **only when** **`TENANT_UX_POLICY_FAIL_CLOSED`** is **on** (HTML + API paths) |
| **`type: tenant_ux_policy_fetch_error`** | Fail-open path diagnostics (existing); keep alerting on spikes |

## Operator checklist (misconfig)

1. User reports **`/access-denied`** — confirm role + **`tenant_roles`** / route-catalog overrides in **Admin → Tenants → Roles** or **`PATCH /api/admin/platform/route-catalog/{tenantId}`**.
2. **Reset toward catalog defaults** — adjust overrides or restore **`tenant_roles`** via **`PUT /api/admin/tenants/{tenantId}/roles`**.
3. **Audit** — `admin_audit_events` for **`tenant_roles.update`**, **`tenant_ux.route_catalog.patch`**.

## References

- [tenant-ux-plan.md](../design-system/tenant-ux-plan.md)
- [current-state-features.md](../design-system/current-state-features.md) § Tenant UX
- `src/modules/platform/tenant-ux-proxy-policy-path.ts`
