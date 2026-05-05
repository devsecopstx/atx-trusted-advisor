# Tenant workspace automations (`ownerKind: tenant_user`)

**Purpose:** Let **tenant operators** (and **`global_admin`** in product shell) define **tenant-scoped** scheduled jobs on the same Mongo + JVM poller stack as Admin → Tasks, without using **`/admin/tasks`**.

**Distinct from:**

- **`/account/tasks`** + **`user_tasks`** — per-user xChat prompt schedules (`/api/tasks/*`).
- **System-wide** **`admin_scheduled_tasks`** rows (no **`tenantId`**) — one definition, fan-out per **`core_tenants`** on Next.

---

## Data model

**Collection:** **`admin_scheduled_tasks`**

| Field | Value |
|--------|--------|
| **`tenantId`** | Required — tenant scope for execution. |
| **`ownerKind`** | **`tenant_user`** — marks rows owned by workspace automation APIs. |
| **`ownerUserId`** | **`core_users._id`** of creator (audit; **operators** may edit any tenant_user task in the tenant). |
| **`portfolioId`** | Omitted or null (scheduler ignores portfolio-bound legacy rows). |
| **`category`** | v1 allowlist: **`watchlist_price_scanner`**, **`options_scanner`**, **`notifications`**. |
| **`scheduleCron`** / **`scheduleRRule`** | Same semantics as admin tasks (eitherRRULE or cron validated on write). |

**Runs:** **`admin_task_runs`** — same as today; manual UI runs use **`triggeredBy`** = **`user-task:{taskId}`**.

---

## Limits

- **Hard cap:** enabled **`ownerKind: tenant_user`** rows per **`tenantId`** — **`MAX_TENANT_USER_TASKS`** (default **5**, clamped 1–50 when set).
- **Soft UI warning:** from **3** enabled tasks (banner on **`/workspace/tasks`**).

Future: raise cap via **`workspaceLimits.planOverrides`** (not wired in v1).

---

## API (Next-authoritative)

| Method | Path | Roles |
|--------|------|--------|
| **GET** | **`/api/tenant-tasks`** | advisor, operator, global_admin |
| **POST** | **`/api/tenant-tasks`** | operator, global_admin |
| **PATCH** | **`/api/tenant-tasks/{taskId}`** | operator, global_admin |
| **DELETE** | **`/api/tenant-tasks/{taskId}`** | operator, global_admin |
| **POST** | **`/api/tenant-tasks/{taskId}/run`** | operator, global_admin (**Run now**, **45s** cooldown per user/task) |
| **GET** | **`/api/tenant-tasks/{taskId}/runs`** | advisor, operator, global_admin |

**403 patterns:** viewer on all; advisor on mutating methods (`code: tenant_automations_mutations_forbidden`).

**409:** enabled count ≥ cap (`code: tenant_user_task_limit`).

---

## UI

- **`/workspace/tasks`** — list, cap banner, create form (name, type, cron), toggle, Run now, history drawer, delete. Also hosts app_user task parity (`/api/tasks`) with hardcoded templates (Daily Portfolio Monitor / Weekly Portfolio Summary).
- **Workspace rail:** **Portfolio desk → Automations** (visible when **`/workspace`** is allowed for the role).

## App_user job parity (`/api/tasks`)

- **Surfaces:** `/workspace/tasks` (primary/power-user) + `/account/tasks` (limited create + read feed).
- **Per-user cap:** `core_tenants.workspaceLimits.userTasksMax` (default 5; admin-editable in Workspace limits).
- **Persona behavior:** advisor default when omitted; app_user override only when `workspaceLimits.changePersonaEnabled=true`; invalid/archived saved persona falls back to advisor with in-app run notice and audit metadata.
- **In-app notifications:** run history feed via `GET /api/tasks/{taskId}/runs` (snippets + optional xChat deep link).

**Route catalog:** **`data/platform/app-user-route-catalog.json`** entry **`workspace_tasks`** — **`viewer`** excluded by default catalog visibility.

---

## Scheduler / execution

No separate collection or Spring service is required for v1: **`AdminSchedulerPoller`** already loads due tenant-level rows from **`admin_scheduled_tasks`**. Rows with **`tenantId`** delegate to Next **`POST /api/internal/scheduler/execute-task`** when configured (**`ATX_SCHEDULER_INTERNAL_SECRET`**).

**Follow-ups (not v1):** JVM-side **max concurrent runs per tenant** (**`TASK_QUEUE_CONCURRENCY_PER_TENANT`**), NL schedule parsing, webhook/custom dispatch.

---

## Code map

| Area | Location |
|------|-----------|
| Types | **`src/modules/core-admin/types.ts`** (`ownerKind`, `ownerUserId`) |
| Policy / cap | **`src/lib/tenant-user-scheduled-task-policy.ts`** |
| Repository | **`src/modules/core-admin/repository.ts`** (`listTenantUserScheduledTasks`, `insertTenantUserScheduledTask`, …) |
| Session gate | **`src/lib/require-tenant-automation-session.ts`** |
| Routes | **`src/app/api/tenant-tasks/**`** |
| Page | **`src/app/workspace/tasks/page.tsx`** |
| OpenAPI | **`src/lib/openapi/current-state.ts`** (`tenant-automations` tag) |

---

## Tests

- **`tests/integration/tenant-user-tasks-api.test.ts`** — gated handlers + limit + 404 paths (mocked repo).
