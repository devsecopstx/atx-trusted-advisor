# Tenant UX edge enforcement (V2)

**Scope:** Next.js **`src/proxy.ts`** — authenticated **app_user** HTML + matched API paths — tenant UX **V2 is on by default** (unset / empty env). Disable with **`TENANT_UX_ENFORCEMENT_V2`** = `0` / `false` / `no` / `off`.

## Rollout

1. **Staging first** — set env on the **Next** Cloud Run service; validate core flows (`/xchat`, `/portfolios`, `/portfolio`, `/xoptions`, `/xcoach`) for seeded tenants and a tenant with **restricted** routes.
2. **Soak** — **48–72 hours** minimum with monitoring; confirm **`tenant_ux_policy_fetch_error`** logs are rare and investigated when present.
3. **Production** — enable per environment; optional **tenant allowlist** via a future **`core_tenants`** flag if product needs phased rollout (not required for env-wide flip).

## Environment

| Variable | Default | Behavior |
|----------|---------|------------|
| **`TENANT_UX_ENFORCEMENT_V2`** | **on** (omit env) | Proxy calls **`GET /api/internal/tenant-ux/policy?pathname=…`** (session cookie forwarded). Set to **`0` / `false` / `no` / `off`** to disable V2. |
| **`TENANT_UX_POLICY_FAIL_CLOSED`** | off | When **on**, **non-OK** or **network error** from the policy route returns **503** **`tenant_ux_policy_unavailable`** (API) or **`/access-denied?code=tenant_ux_policy_unavailable`** (HTML). When **off** (**default**), failures **fail-open** (allow request) and emit one-line JSON stderr: **`type: tenant_ux_policy_fetch_error`**. |

See repo **`.env.example`** for canonical comments. **Rollout:** soak staging/prod with **V2 default on**; watch **`tenant_ux_route_forbidden`** / **`tenant_ux_policy_fetch_error`**; keep **`TENANT_UX_POLICY_FAIL_CLOSED=false`** unless drilling fail-closed.

## E2E verification (local or staging)

1. **Signed-in app user** (`viewer` / `operator` / `advisor`): open **`/xchat`**, **`/portfolios`**, **`/watchlist`**, **`/xoptions`** — should load (no unexpected **`/access-denied`**).
2. **`global_admin`**: same routes + **`/admin`** — admin shell loads; policy short-circuits **allowed** for admins.
3. **Restricted route (negative):** in **Admin → Tenants → Roles**, remove **`/watchlist`** (or similar) from a test user’s role **`allowedRoutes`**, bust policy cache if needed — visiting **`/watchlist`** should redirect to **`/access-denied`** (HTML) or APIs return **403** **`tenant_ux_route_forbidden`**.
4. **Internal policy:** with a valid session cookie, `GET /api/internal/tenant-ux/policy?pathname=/xchat` → **200** JSON **`data.allowed`** consistent with that user’s matrix.
5. **Opt-out:** set **`TENANT_UX_ENFORCEMENT_V2=false`**, restart Next — policy fetch should be skipped (no **`tenant_ux_metric`** lines for policy latency from proxy); restore unset/true for production behavior.

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
- **Explicit invalidation:** **`PUT /api/admin/tenants/{tenantId}/roles`**, **`PATCH …/roles/{role}`**, and **`PATCH /api/admin/platform/route-catalog/{tenantId}`** call **`bustTenantUxPolicyCacheForTenant`** (pattern-delete **`tenant-ux:policy:v2:*:{tenantId}`** in Redis + in-memory sweep) and emit **`admin_audit_events`** **`tenant_ux.policy_cache_bust`**. Operators may also **`POST /api/admin/tenants/{tenantId}/policy-cache`** from **Admin → Tenants → Roles** (“Bust policy cache”).

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

**Mongo (admin visibility):** Internal **`GET /api/internal/tenant-ux/policy`** appends **`tenant_ux_observability_events`** (`tenant_ux_metric` / `tenant_ux_policy_fetch_error`). **`global_admin`**: **`GET /api/admin/platform/tenant-ux/observability`** — recent rows, aggregate counters, optional **`replayTenantId`** (last 24h read-only replay). Hub: **Tenant UX observability** panel on **`/admin`**.

**Fail-closed drill:** **`GET`/`POST /api/admin/platform/tenant-ux/fail-closed-drill`** sets httpOnly **`xf_tenant_ux_fail_closed`** for session-scoped fail-closed simulation (additive to env **`TENANT_UX_POLICY_FAIL_CLOSED`**).

## Operator checklist (misconfig)

1. User reports **`/access-denied`** — confirm role + **`tenant_roles`** / route-catalog overrides in **Admin → Tenants → Roles** or **`PATCH /api/admin/platform/route-catalog/{tenantId}`**.
2. **Reset toward catalog defaults** — adjust overrides or restore **`tenant_roles`** via **`PUT /api/admin/tenants/{tenantId}/roles`**.
3. **Audit** — `admin_audit_events` for **`tenant_roles.update`**, **`tenant_ux.route_catalog.patch`**.

## References

- [tenant-ux-plan.md](../design-system/tenant-ux-plan.md)
- [current-state-features.md](../design-system/current-state-features.md) § Tenant UX
- `src/modules/platform/tenant-ux-proxy-policy-path.ts`
