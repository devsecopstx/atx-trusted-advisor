---
name: skill-tenant-roadmap
description: Tenant UX, multi-tenant provisioning (PLAN 10–11), app_user tasks (705), tenant automations (706). Summarizes shipped slices moved out of atx-docs/PLAN.md and lists design locks + open questions for provisioning/branding/bootstrap.
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

**Still open (keep in `PLAN.md`):** V2 soak staging→prod, metrics/alerts, Redis policy cache, `/api/*` mapping audit, PWA manifest. Runbook: `atx-docs/sre-ops/tenant-ux-enforcement.md`.

---

## Shipped — White-label branding (display-only)

- **`tenantPreferences`:** accent, logo URL, tagline, `xchat_brandname`, `xf_ui_theme`, xStrategyBuilder display name key, etc. Admin **Tenant register → Edit**; CSS tenant tokens — see **Tenant UX** in `current-state-features.md`.
- **Not** a different compliance posture per tenant unless legal approves explicit copy.

**Backlog:** matrix **preview pane**, **dynamic PWA manifest** per tenant.

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

## PLAN **10** — Multi-tenant provisioning + per-tenant branding

**Goal:** provisioning workflow hardening and **role-aware** default portfolio/watchlist bootstrap beyond the single boolean **`tenantPreferences.bootstrap_default_portfolio_watchlist`**.

### Locked decisions (pre–Phase 2)

- **Tenant admins:** platform role **`operator`** (recommended) or **`advisor`**, plus **`tenant_admin`** on **`core_tenant_memberships`**. Avoid **`global_admin`** unless they need **`/admin`**.
- **Identity:** provision canonical **`core_users.email`**, **`xAccount`**, login-eligible **`roles`** so X OAuth resolves via **`getCoreUserByXOAuthIdentity`** without placeholder / **`email_link_required`** when X omits email. Coverage: **`tests/integration/x-oauth-provisioned-tenant-admin.test.ts`**.
- **Branding:** white-label **display names** only; internal product ids stay xChat / xStrategyBuilder.
- **Naming:** **`tenant.slug`** + **`tenant.name`** required in specs; branding keys **`xchat_brandname`**, **`xstrategybuilder_brandname`** (v1).
- **Provisioning surface:** **CLI + YAML** supported for v1 (**`npm run seed:tenant`** / **`tenant-specs/`**).
- **Google vs X (v1):** **`initialTenantAdmin.email` required**; **`xUserId` optional** (when set, X resolves by id). Google OAuth with **verified email matching** links **`googleAccount`** to the same **`core_users`** row. Do not require **`xUserId`** for Google-only admins.

### Open questions — implementation (answer before coding)

1. **Bootstrap matrix:** For each platform role (**`viewer`** / **`operator`** / **`advisor`**), should default portfolio+watchlist run **always**, **never**, or **tenant-default with per-role overrides**? Is **`bootstrap_default_portfolio_watchlist`** global-with-overrides or replaced by a structured policy object?
2. **Approval path parity:** Should access-request **approve** and **OAuth first-login** use the **same** role-aware policy, or can approve eagerly provision while login is lazy?
3. **Next vs Spring:** Any new bootstrap rules must **`provisionDefaultPortfolioForUser`** (Next) and **`DefaultPortfolioProvisionService`** (Spring) stay in sync — which service is source of truth for **new** fields, and is BFF in scope for the first slice?
4. **Watchlist seed:** Beyond empty watchlist, do tenants need **default symbols**, **desk columns**, or **import templates** on first bootstrap?
5. **UI vs CLI:** Is **Admin → create tenant** expected to replace YAML for **production** provisioning, or is hardened CLI + audit enough for Phase 2?
6. **Branding depth:** Are **logo upload + validation** (size/type) in scope, or URLs-only until a later phase?
7. **Failure semantics:** If bootstrap fails for one role/user, is partial success acceptable (current **best-effort** on approve), or should operators get a **replay** / visible **dead-letter** row?

---

## When to update

- After changing tenant provisioning, **`bootstrap_default_portfolio_watchlist`**, or tenant-create APIs — sync **`atx-docs/guides/auth-and-access.md`**, **`tenant-specs/README.md`**, `PLAN.md` row **10**, and **`current-state-features.md`** if behavior is user-visible.
