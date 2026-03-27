# Admin scheduled tasks — xFinance (design + implementation map)

**Purpose:** Describe how **tenant-level** and **portfolio-scoped** scheduled tasks work in the **core admin** app: UI, APIs, Mongo collections, and optional **Kotlin Spring** execution when the BFF is enabled.

**Not in scope:** Generic SQL/ORM schedulers or non-xFinance stacks. This doc tracks **this repo**.

---

## Who can use it

- **`global_admin` only** for `/admin/tasks` and `/api/admin/tasks*`, `/api/admin/task-runs`, `/api/admin/scheduler/tick`, and portfolio nested task routes.
- Enforced in **`src/app/admin/tasks/page.tsx`** (redirect if not global admin) and **`requireAdminSession()`** on API routes.

---

## Admin UI surfaces

| Surface | Route / entry | Component |
|--------|----------------|-----------|
| **Tenant tasks** | **`/admin/tasks`** | **`src/app/admin/tasks/ui/tasks-console.tsx`** (`TasksConsole`) |
| **Portfolio tasks** | **`/admin/portfolios/{id}/tasks`** | **`src/app/admin/portfolios/ui/admin-portfolio-tasks-console.tsx`** — CRUD uses **`/api/admin/portfolios/.../tasks`**; **Run** still posts to **`POST /api/admin/tasks/{taskId}/run`** (task id is global in Mongo). |

**UI behavior (tenant console):**

- Polls **`GET /api/admin/tasks`** and **`GET /api/admin/task-runs`** on an interval and on refresh.
- **Create task:** `name`, `category`, `scheduleCron` (cron string), POST **`/api/admin/tasks`** with `enabled: true`.
- **Edit row:** inline name, category, cron, enabled; per-row **Save** → **`PATCH /api/admin/tasks/{id}`** (or bulk **Save changes**).
- **Run now:** **`POST /api/admin/tasks/{id}/run`** → shows status and refreshes runs.
- **Delete:** **`DELETE /api/admin/tasks/{id}`**.
- Copy in UI: tenant-level jobs omit **`portfolioId`**; portfolio-scoped tasks are edited under each portfolio’s Tasks page.

**Categories** (must match **`src/lib/scheduled-task-category-schema.ts`** and Kotlin allowlists):

`sync-broker` · `rebalance` · `compliance` · `notifications` · `user-history` · `watchlist_price_scanner` · `daily_options_scanner`

**Next.js executors** (`src/modules/core-admin/task-runner.ts`): `user-history`, `watchlist_price_scanner`, `daily_options_scanner`. Other categories use the simulated short sleep + success string (and on Kotlin BFF, `watchlist_price_scanner` / `daily_options_scanner` log a noop message unless execution is routed to Next).

---

## Data model (MongoDB)

Canonical collection names (Next repository + Kotlin backend):

| Collection | Role |
|------------|------|
| **`admin_scheduled_tasks`** | Task definitions: tenant-scoped; optional **`portfolioId`** for portfolio-bound rows. |
| **`admin_task_runs`** | Run history: status, output, duration, **`triggeredBy`**, timestamps. |

**Next implementation:** **`src/modules/core-admin/repository.ts`** (`COLLECTIONS.scheduledTasks`, `COLLECTIONS.taskRuns`).

**JVM implementation:** same collection names by default — **`services/atxfinance-backend/.../AtxfinanceProperties.kt`**.

---

## HTTP API (admin)

All routes require a valid **global admin** session unless proxied (see BFF below).

| Method | Path | Notes |
|--------|------|--------|
| **GET** | `/api/admin/tasks` | List tenant-level tasks (`portfolioId` unset), scoped to session **`tenantId`**. |
| **POST** | `/api/admin/tasks` | Create tenant task; body includes `name`, `category`, `scheduleCron`, `enabled`, optional `lastRunAt` / `nextRunAt`. |
| **PATCH** | `/api/admin/tasks/{taskId}` | Partial update. |
| **DELETE** | `/api/admin/tasks/{taskId}` | Remove task. |
| **POST** | `/api/admin/tasks/{taskId}/run` | Run now; returns `{ data: { runId, status, output } }`. |
| **GET** | `/api/admin/task-runs` | Recent runs for tenant. |
| **POST** | `/api/admin/scheduler/tick` | Advance due tasks / simulation path (used when driving scheduler from HTTP). |

**Portfolio nested (same collections, `portfolioId` set):**

| Method | Path |
|--------|------|
| **GET** \| **POST** | `/api/admin/portfolios/{portfolioId}/tasks` |
| **PATCH** \| **DELETE** | `/api/admin/portfolios/{portfolioId}/tasks/{taskId}` |

**Run now:** **`POST /api/admin/tasks/{taskId}/run`** — used by both tenant and portfolio UIs (by `taskId`; BFF list in **`src/lib/bff-proxy-routes.ts`**).

**Authoritative route list + parity:** **`atx-docs/sre-ops/atxfinance-backend-http-api.md`** and **`src/lib/bff-proxy-routes.ts`**.

---

## BFF / Kotlin backend

When **`ATXFINANCE_BACKEND_ORIGIN`** is set, **`proxyRequestToBackend`** in the admin task routes can forward the request to the Spring service instead of using the in-process Mongo repository.

- **Implication:** Staging/production behavior should be validated against **both** paths if you toggle BFF.
- **Detail:** **`atx-docs/sre-ops/api-consolidation-spring-backend.md`**, **`atx-docs/sre-ops/bff-admin-backlog.md`**.

---

## Cron, `nextRunAt`, and roadmap

- The UI displays **`nextRunAt`** when present.
- **Product/engineering backlog** (real cron evaluation, non-simulated work, tick concurrency) is tracked in **`atx-docs/PLAN.md`** (Kotlin scheduler / admin tasks row). Treat that file as the **roadmap**; this doc describes **current** wiring.

---

## Design system notes (admin)

- Reuse existing **admin** patterns: **`panel`**, **`surface-card`**, **`xf-widget`**, **`crud-table`**, **`cta`**, **`status-badge`**, **`hero-card`** — see **`src/app/admin/tasks/page.tsx`** and **`tasks-console.tsx`**.
- **Dark mode only**; no new hardcoded marketing hex — prefer **`--xf-*`** tokens from **`atx-docs/design-system/atxfinance-brand-kit.css`** for any new styles.

---

## Related files (quick index)

| Area | Path |
|------|------|
| Tenant tasks API | `src/app/api/admin/tasks/route.ts`, `src/app/api/admin/tasks/[taskId]/route.ts`, `src/app/api/admin/tasks/[taskId]/run/route.ts` |
| Task runs API | `src/app/api/admin/task-runs/route.ts` |
| Portfolio tasks API | `src/app/api/admin/portfolios/[portfolioId]/tasks/` |
| Repository | `src/modules/core-admin/repository.ts` |
| Portfolio tasks UI | `src/app/admin/portfolios/ui/admin-portfolio-tasks-console.tsx` |
| BFF proxy list | `src/lib/bff-proxy-routes.ts` |
| Backend HTTP catalog | `atx-docs/sre-ops/atxfinance-backend-http-api.md` |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-25 | Engineering | Replaced generic SQL/FastAPI draft with **xFinance-aligned** map: Mongo **`admin_scheduled_tasks`** / **`admin_task_runs`**, **`/admin/tasks`** + **`TasksConsole`**, admin API table, BFF note, **PLAN.md** pointer. |
