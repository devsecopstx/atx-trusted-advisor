---
name: skill-tenant-tasks
description: Tenant workspace scheduled automations (`ownerKind: tenant_user`, `/workspace/tasks`, `/api/tenant-tasks/*`). Use when extending tenant-operator jobs, caps, categories, or JVM fairness on top of `admin_scheduled_tasks`.
---

# Tenant workspace automations (skill)

## Scope

- **Shipped v1:** Mongo **`admin_scheduled_tasks`** + **`ownerKind: tenant_user`**; Next APIs **`/api/tenant-tasks/*`**; UI **`/workspace/tasks`**; rail link under Portfolio desk.
- **User-task parity (v1.1):** `/workspace/tasks` also hosts app_user job management (`/api/tasks/*`) with hardcoded templates, advisor-default persona execution, and run-history notifications (`GET /api/tasks/{taskId}/runs`).
- **Execution:** Same Spring poll + Next **`executeScheduledTask`** delegate as other tenant **`admin_scheduled_tasks`** rows (no duplicate poller).

## Rules

1. **Isolation:** All queries **`tenantId`** + session; only mutate rows with **`ownerKind: tenant_user`** via tenant-task APIs (do not expose admin seed tasks).
2. **Roles:** **`canMutateTenantUserAutomations`** = **`global_admin`** \| **`operator`**; **`canAccessTenantUserAutomations`** adds **`advisor`** (read-only); **`viewer`** blocked.
3. **Limits:** Tenant automation rows use **`getMaxTenantUserScheduledTasks()`** from **`MAX_TENANT_USER_TASKS`** (soft warning **3**). App_user jobs use per-tenant **`workspaceLimits.userTasksMax`** (default **5**).
4. **Categories:** Extend **`TENANT_USER_SCHEDULED_TASK_CATEGORIES`** only when **`task-runner.ts`** safely executes the category tenant-scoped — keep Kotlin **`ALLOWED_CATEGORIES`** in sync if BFF creates rows.
5. **Docs / OpenAPI:** New routes → **`CURRENT_STATE_ROUTES`** (both `tenant-automations` and `user-tasks` when touched); update **`atx-docs/design-system/scheduled-task/user-tasks.md`**, **`current-state-features.md`**, and **`PLAN.md`** when behavior changes.

## References

- **`atx-docs/design-system/scheduled-task/user-tasks.md`**
- **`atx-docs/design-system/scheduled-task/schedule-tasks-admin.md`** (admin parity)
- **`src/modules/core-admin/task-runner.ts`** (category handlers)
