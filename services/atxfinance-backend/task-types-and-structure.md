# atxfinance-backend — Scheduled Task Types, Inputs, and Structure (Legacy Admin Scheduler)

Last updated: 2026-03-26

Scope: This document describes the legacy scheduler model used in `atxfinance-backend` (Kotlin/Spring Boot) for **tenant-level** administrative tasks. It summarizes task types, input schemas, Mongo collections, and execution lifecycle based on current code.

**Removed (2026-04):** Portfolio-nested scheduled task HTTP API and `AdminPortfolioScheduledTasksService` / controller — product uses **tenant-only** `/api/admin/tasks` (Next + `AdminScheduledTasksService`). Legacy Mongo rows may still have `portfolioId`; the JVM `listDueTasks` query excludes them.

Related code (selected):
- Service: `AdminScheduledTasksService`
- Controller: `AdminScheduledTasksController`
- Scheduling: `SchedulingConfig` (ShedLock + executor), `scheduling/AdminSchedulerPoller.kt`
- Properties: `AtxfinanceProperties` (collection names)

Collections (from `AtxfinanceProperties`):
- Task definitions: `admin_scheduled_tasks`
- Task run records: `admin_task_runs`


## 1) Task Categories (types)

Allowed categories ("type") today:
- `sync-broker` — Broker syncs and account state refreshes
- `rebalance` — Portfolio rebalance analysis/prep
- `compliance` — Compliance scans/policy checks
- `notifications` — Digest or ad-hoc notification producers
- `user-history` — Data/insights generation for user activity history (delegates to `UserHistoryAgentService`)

Notes:
- Portfolio-scoped tasks use the same categories but include a `portfolioId` field.
- Unknown categories are rejected at validation time.


## 2) Task Definition Schema (`admin_scheduled_tasks`)

Common fields (tenant-level and portfolio-scoped):
- `_id` (ObjectId) — Mongo id (server-assigned)
- `tenantId` (ObjectId, optional) — Tenant scope; added when session has a tenant id
- `portfolioId` (ObjectId, optional) — Legacy only; scheduler does not enqueue these tasks
- `name` (string, required, 1..200) — Human label
- `category` (string, required) — One of: `sync-broker`, `rebalance`, `compliance`, `notifications`, `user-history`
- `scheduleCron` (string, required) — Cron expression
  - Accepts standard 5-field (`min hour dom mon dow`) or 6-field with seconds. Internally normalized to Spring format (seconds prepended when 5-field provided).
  - Validation uses `org.springframework.scheduling.support.CronExpression`.
- `enabled` (boolean, default true)
- `lastRunAt` (ISO-8601 string or Date, optional) — Set when a run starts
- `nextRunAt` (ISO-8601 string or Date, optional) — Next planned run time
- `runTimeoutSeconds` (number, optional) — Reserved field exposed in serializer; not currently enforced in executor
- `maxRetries` (number, optional) — Reserved field exposed in serializer; not currently enforced in executor

Creation rules (tenant-level via `POST /api/admin/tasks`):
- Required: `name`, `category`, `scheduleCron`
- Optional: `enabled` (default true), `lastRunAt`, `nextRunAt`
- If `enabled=true` and `nextRunAt` not provided, it is computed from `scheduleCron` relative to "now" (UTC).

Portfolio-scoped creation (via service used by nested portfolio admin):
- Same validations as above, plus required `portfolioId` path param; service validates that the portfolio exists.
- If `nextRunAt` not provided, defaults to `now + 5 minutes` in portfolio-scoped service; in tenant-level creation it is computed from cron.

Patch rules (tenant-level via `PATCH /api/admin/tasks/{taskId}`):
- Allowed keys: `name`, `category`, `scheduleCron`, `enabled`, `nextRunAt`
- If `scheduleCron` changes and `nextRunAt` not provided in the same request, `nextRunAt` is recomputed from the new cron.
- Empty strings or invalid values are rejected with `400 Invalid request payload`.

Deletion (tenant-level):
- `DELETE /api/admin/tasks/{taskId}` — hard delete; only tenant-level tasks accepted by this controller.


## 3) Task Run Schema (`admin_task_runs`)

Fields:
- `_id` (ObjectId)
- `tenantId` (ObjectId, optional) — Propagated from task if present
- `taskId` (ObjectId) — Back-reference to task definition
- `taskName` (string) — Snapshot of task name at enqueue time
- `category` (string)
- `triggeredBy` (string) — `username` or `userId`; for scheduler-driven runs, prefixed `scheduler:`
- `status` (string) — `running` | `success` | `failed`
- `output` (string) — Short log line / outcome message (truncated at ~500 chars in failures)
- `startedAt` (Date)
- `completedAt` (Date, optional)
- `durationMs` (number, optional) — Set on completion

List runs (admin): `GET /api/admin/task-runs?limit=50`


## 4) Execution & Lifecycle

Trigger modes:
- Manual run: `POST /api/admin/tasks/{taskId}/run` — Enqueues an execution immediately.
- Scheduler tick: `POST /api/admin/scheduler/tick` — Scans due tasks (`enabled=true` and `nextRunAt <= now`) and enqueues each with distributed lock safety.

Enqueue flow (both manual and scheduled):
1. Create a `admin_task_runs` document with `status=running`, capture `tenantId`, `taskName`, `category`, `triggeredBy`, `startedAt`.
2. Call `advanceScheduleAfterStart(task, startedAt)` to set `lastRunAt=startedAt` and compute a new `nextRunAt` using the task cron (UTC). If no valid cron, fallback to `+1 day` from start.
3. Dispatch asynchronous work on the `scheduler-` executor thread pool.
   - Category `user-history` delegates to `UserHistoryAgentService.run(tenantIdHex?)`.
   - Other categories currently simulate work and set a category-appropriate message; in real impl, plug specific handlers per category.
4. On completion: update the run with `status`, `output`, `completedAt`, and `durationMs`.
5. On error: set `status=failed` with truncated exception message.

Distributed locking (ShedLock):
- Each scheduled "due" task acquisition uses lock name `admin_task_{taskIdHex}` to prevent multi-node duplicate enqueues.
- Lock configuration: `lockAtMostFor=5m`, `lockAtLeastFor=5s` equivalent via `LockConfiguration(…5m, …5s)`.
- ShedLock uses Mongo (see `SchedulingConfig.lockProvider`).

Threading:
- Executor bean `schedulerTaskExecutor` (prefix `scheduler-`, core/max 4 threads) runs task bodies off the HTTP thread.

Time zone:
- Cron evaluation is done against UTC (`ZoneId.of("UTC")`).


## 5) HTTP Admin Endpoints (Tenant-level)

- `GET /api/admin/tasks?limit=50` — List tenant-level tasks (no `portfolioId`)
- `POST /api/admin/tasks` — Create tenant-level task (see schema above)
- `PATCH /api/admin/tasks/{taskId}` — Update selected fields
- `DELETE /api/admin/tasks/{taskId}` — Delete
- `POST /api/admin/tasks/{taskId}/run` — Manual run (enqueue)
- `GET /api/admin/task-runs?limit=50` — List recent runs
- `POST /api/admin/scheduler/tick` — Scan `nextRunAt` and enqueue due tasks (uses ShedLock per-task)

Auth:
- All endpoints require a valid session cookie and global admin privileges.


## 6) Example Payloads

Create tenant-level task:
```json
{
  "name": "Nightly broker sync",
  "category": "sync-broker",
  "scheduleCron": "0 2 * * *",  
  "enabled": true
}
```

Patch a task:
```json
{
  "scheduleCron": "0 */6 * * *",
  "enabled": false
}
```

A `admin_task_runs` record (example shape returned by list):
```json
{
  "_id": "65feab12c9c2e7b1f0a5d001",
  "tenantId": "65feaa11c9c2e7b1f0a5d000",
  "taskId": "65feab12c9c2e7b1f0a5cffc",
  "taskName": "Nightly broker sync",
  "category": "sync-broker",
  "triggeredBy": "scheduler:admin@example.com",
  "status": "success",
  "startedAt": "2026-03-26T02:00:00Z",
  "completedAt": "2026-03-26T02:00:05Z",
  "durationMs": 5032,
  "output": "Broker sync completed for task \"Nightly broker sync\"."
}
```


## 7) Implementation Notes & Gaps

- Retry policy and `maxRetries`/`runTimeoutSeconds` are not enforced yet; fields are serialized for future use.
- Pub/Sub consumer is not wired here; all execution is in-process on the scheduler thread pool.
- For high scale, planned model is to enqueue to Pub/Sub and track runs asynchronously; current code simulates execution.
- Cron granularity: second-level supported when provided; default prepend `0` seconds on 5-field crons.


## 8) Discoverability

- Admin UI surfaces exist in the Next.js app (`/src/app/admin/...`) which align to these endpoints and collections.
- API references: see `atx-docs/sre-ops/atxfinance-backend-http-api.md` (Admin tasks section) and `atx-docs/design-system/scheduled-task/schedule-tasks-admin.md` for UX/data notes.

---
References
- `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/admin/AdminScheduledTasksService.kt`
- `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/web/AdminScheduledTasksController.kt`
- `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/config/SchedulingConfig.kt`