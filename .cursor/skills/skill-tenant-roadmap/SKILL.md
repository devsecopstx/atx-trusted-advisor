---
name: skill-tenant-roadmap
description: Tenant UX, multi-tenant provisioning (PLAN 10–11), app_user tasks (705), tenant workspace automations (706). Summarizes shipped slices moved out of atx-docs/PLAN.md; PLAN 10 v1 bootstrap/policy is documented under § Shipped — Multi-tenant provisioning.
---

# Tenant roadmap context (skill)

Canonical **architecture / shipped surfaces:** [`atx-docs/design-system/current-state-features.md`](../../atx-docs/design-system/current-state-features.md) (Tenant UX table, workspace, billing). **Open backlog table:** [`atx-docs/PLAN.md`](../../atx-docs/PLAN.md).

This skill holds **short shipped summaries** that were trimmed from `PLAN.md` so the plan stays **open work only**.

---

## Shipped — Tenant UX (`tenant_ux`, PLAN **11** core)

- Route catalog + drift tests; admin **`GET/PATCH /api/admin/platform/route-catalog/{tenantId}`** (audit on PATCH); tenant role matrix APIs + admin UI.
- Runtime resolver + policy cache; page guards; workspace rail / headers; **`/access-denied`**; **`GET /api/app-user/me/role`**.
- Edge **V2** hook in **`src/proxy.ts`** when **`TENANT_UX_ENFORCEMENT_V2`** (policy fetch; fail-open log **`tenant_ux_policy_fetch_error`**; optional **`TENANT_UX_POLICY_FAIL_CLOSED`**).
- Policy path module (includes **`/xcoach`**); xChat tenant block in prompts/welcome; **`--xf-tenant-primary` / `--xf-tenant-secondary`** via branding provider + brand kit.

**PLAN 11 — dev closed:** V2 feature set shipped; **ops-only** remainder is env soak (**48–72h**) + GCP metrics/alerts on stderr JSON lines (`tenant-ux-enforcement.md`). **Shipped:** Redis bust on roles/catalog **`PATCH`** + manual policy-cache POST; dynamic **`manifest.ts`**; admin observability API + hub panel; fail-closed drill cookie API; expanded **`resolvePolicyPathForRequest`**. **Redis policy keys** `tenant-ux:policy:v2:*` ship with **`REDIS_URL`** (dev/prod). Runbooks: `atx-docs/sre-ops/tenant-ux-enforcement.md`, `atx-docs/sre-ops/redis-cache-next.md` § Tenant UX policy.

---

## Shipped — White-label branding (display-only)

- **`tenantPreferences`:** accent, logo URL, tagline, `xchat_brandname`, `xf_ui_theme`, xStrategyBuilder display name key, etc. Admin **Tenant register → Edit**; CSS tenant tokens — see **Tenant UX** in `current-state-features.md`.
- **Not** a different compliance posture per tenant unless legal approves explicit copy.

**Backlog:** matrix **preview pane** in admin (branding tokens).

---

## Shipped — App_user tasks (PLAN **705** v1)

- **`/account/tasks`** limited create; **`/workspace/tasks`** as primary job surface; hardcoded templates (Daily Monitor / Weekly Summary).
- Advisor-default persona with gated override + graceful advisor fallback.
- **`GET /api/tasks/{taskId}/runs`** history; per-tenant cap **`workspaceLimits.userTasksMax`** (default 5).

**Next:** wire **`strategy`** / **`scan`** / **`report`** to OptionsStrategyEngine / strategy jobs; richer edit UX; optional Spring poller parity.

---

## Shipped — Tenant workspace automations (PLAN **706** v1)

- **`/workspace/tasks`**, **`/api/tenant-tasks/*`**, **`ownerKind: tenant_user`** on **`admin_scheduled_tasks`**.

**Next:** NL scheduling via Grok; JVM **`TASK_QUEUE_CONCURRENCY_PER_TENANT`** fairness; extra safe categories; **`workspaceLimits.planOverrides`** for **`maxTenantUserTasks`**. Detail: [`.cursor/skills/skill-tenant-tasks/SKILL.md`](../skill-tenant-tasks/SKILL.md), `atx-docs/design-system/scheduled-task/user-tasks.md`.

---

## Shipped — Multi-tenant provisioning + bootstrap (PLAN **10** v1)

- **`ensureTenantBootstrapForUser`** — idempotent portfolio/watchlist provisioning from **`core_users.roles`** + **`bootstrap_policy`** on **`core_tenant_memberships`** / tenant prefs; runs on **first successful login** (OAuth, Google, email-password) and on **access-request approve** only when **`tenantPreferences.bootstrap_on_approve`** is **true** (default **lazy**).
- **Structured policy** — YAML **`tenant.bootstrapPolicy`** / Mongo **`tenantPreferences.bootstrap_policy`**: per-role **`defaultPortfolio`** / **`defaultWatchlist`** for **`viewer`**, **`operator`**, **`advisor`**; optional **`overrides`** (**`role`**, **`symbols`**, booleans). Legacy boolean **`bootstrap_default_portfolio_watchlist`** still maps via **`effectiveTenantBootstrapPolicy`**.
- **Watchlist seeds** — **`tenantPreferences.watchlist_seed_symbols`**; policy override **`symbols`**; else **`src/data/default-watchlist-desk-symbols.json`** when watchlist auto-create is on for that role.
- **Source of truth** — **Next** persists prefs via **`seed:tenant`** / **`tenant-spec-apply`** / admin tenant routes; module **`src/modules/platform/tenant-bootstrap-policy.ts`** + **`src/modules/core-admin/tenant-user-bootstrap.ts`**.
- **Branding v1** — logo remains **URL-only** on **`xf_tenant_logo_url`** (see `tenant-logo-url` validation); no tenant file upload in this slice.
- **Tests:** **`tenant-bootstrap-policy`** unit; **`access-request-item-crud-route`** (approve + **`bootstrap_on_approve`**); **`tenant-spec-schema`** (YAML mirror).

**PLAN 10 — shipped in-repo slice:** Admin bootstrap **audit + replay** APIs + workspace panel; Spring **`provisionForUser`** reads tenant **`bootstrap_policy`** / **`watchlist_seed_symbols`** (Next parity); create-tenant **YAML preview**. Remaining optional items stay in `PLAN.md` row **10** (spec export, CSV).

---

## PLAN **10** — Multi-tenant provisioning + per-tenant branding (historical note)

The v1 slice above supersedes the pre-implementation question list. Remaining work is **follow-ups** in **`PLAN.md`** row **10** only.

---

## When to update

- After changing tenant provisioning, **`bootstrap_policy`**, **`bootstrap_on_approve`**, or tenant-create APIs — sync **`atx-docs/guides/auth-and-access.md`**, **`tenant-specs/README.md`**, `PLAN.md` row **10**, **`current-state-features.md`**, and **`scripts/lib/tenant-spec-schema.mjs`** + **`src/lib/tenant-spec-v1-parse.ts`** if YAML validation diverges.
