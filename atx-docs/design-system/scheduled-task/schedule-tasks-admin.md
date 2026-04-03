# Admin scheduled tasks — xFinance (design + implementation map)

**Purpose:** Describe how **tenant-level** scheduled tasks work in the **core admin** app (`/admin/tasks`): UI, APIs, Mongo collections, and optional **Kotlin Spring** execution when the BFF is enabled. **Portfolio-scoped** scheduled task CRUD has been **removed**; only **global admin** tenant jobs remain. **TBD:** end-users may create **options-scanner** jobs from **xChat** prompts in a future slice.

**Not in scope:** Generic SQL/ORM schedulers or non-xFinance stacks. This doc tracks **this repo**.

---

## Who can use it

- **`global_admin` only** for `/admin/tasks` and `/api/admin/tasks*`, `/api/admin/task-runs`, `/api/admin/scheduler/tick`.
- Enforced in **`src/app/admin/tasks/page.tsx`** (redirect if not global admin) and **`requireAdminSession()`** on API routes.

---

## Admin UI surfaces

| Surface | Route / entry | Component |
|--------|----------------|-----------|
| **Tenant tasks** | **`/admin/tasks`** | **`src/app/admin/tasks/ui/tasks-console.tsx`** (`TasksConsole`) |

**UI behavior (tenant console):**

- Polls **`GET /api/admin/tasks`** and **`GET /api/admin/task-runs`** on an interval and on refresh.
- **Create task:** `name`, `category`, `scheduleCron` (cron string), POST **`/api/admin/tasks`** with `enabled: true`.
- **Edit row:** inline name, category, cron, enabled; per-row **Save** → **`PATCH /api/admin/tasks/{id}`** (or bulk **Save changes**).
- **Run now:** **`POST /api/admin/tasks/{id}/run`** → shows status and refreshes runs.
- **Delete:** **`DELETE /api/admin/tasks/{id}`**.
- Tenant-level jobs omit **`portfolioId`**. Legacy Mongo rows may still have **`portfolioId`**; the scheduler **does not** enqueue them (`listDueScheduledTasks` filters them out).

**Categories** (must match **`src/lib/scheduled-task-category-schema.ts`** and Kotlin allowlists where applicable):

`price_scanner` · `options_scanner` · `user_access_requests` · `sync-broker` · `rebalance` · `compliance` · `notifications` · `user-history` · `watchlist_price_scanner` · `daily_options_scanner` · `corporate_events_scanner` · `income_cash_flow_projector` · `options_expiration_roll_manager` · `risk_concentration_scanner` · `tax_loss_harvest_scanner`

**Next.js executors** (`src/modules/core-admin/task-runner.ts`): **`price_scanner`**, **`options_scanner`** / **`daily_options_scanner`**, **`user_access_requests`**, **`user-history`**, **`watchlist_price_scanner`**, Phase 3 scanners (**`corporate_events_scanner`**, **`income_cash_flow_projector`**, **`options_expiration_roll_manager`**, **`risk_concentration_scanner`**, **`tax_loss_harvest_scanner`**, **`rebalance`**), then stub switch for **`sync-broker`**, **`compliance`**, **`notifications`**. **Kotlin** `daily_options_scanner` tick runs **`OptionsStrategyEngine.scheduledTaskDryRunOutput`** (in-process demo + summary); **full chain/portfolio Yahoo + Mongo pass** still runs in Next for those categories. **`POST /api/admin/tasks/{id}/run`** / **`POST /api/admin/scheduler/tick`** use **`executeScheduledTask`** (Next or BFF-proxied JVM per deployment).

**Tenant task run summaries:** Optional **`deliveryChannelTarget`** on **`admin_scheduled_tasks`** points at **`admin_delivery_channels`**. Configure channels under **`/admin/delivery-channels`**: **`slack`** (incoming webhook), **`email`** (recipient `emailTo`; SMTP uses **`SMTP_*`** + **`DESK_EMAIL_FROM`** like portfolio desk mail), or **`in_app`** (no external send). After each run, **`notifyScheduledTaskSlackSummary`** (`scheduled-task-slack-notify.ts`) posts to Slack or sends email.

**Desk notifications (shipped):** When scanners create alerts, the app calls **`dispatchPortfolioDeskEvents`** for enabled **`portfolio_delivery_channels`** — Slack webhooks (`hooks.slack.com`) with retries; **email** when **`SMTP_*`** + **`DESK_EMAIL_FROM`** are set (`src/lib/desk-smtp.ts`); SMS/push still deferred. Optional env: **`DESK_NOTIFICATION_SLACK_RETRIES`**, **`DESK_NOTIFICATION_RETRY_BASE_MS`** (also used for SMTP retries).

---

## Data model (MongoDB)

Canonical collection names (Next repository + Kotlin backend):

| Collection | Role |
|------------|------|
| **`admin_scheduled_tasks`** | Task definitions: tenant-scoped; optional legacy **`portfolioId`** (ignored by scheduler; no UI to create portfolio-bound tasks). |
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

**Run now:** **`POST /api/admin/tasks/{taskId}/run`** — by `taskId` (BFF list in **`src/lib/bff-proxy-routes.ts`**).

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
| Repository | `src/modules/core-admin/repository.ts` |
| BFF proxy list | `src/lib/bff-proxy-routes.ts` |
| Backend HTTP catalog | `atx-docs/sre-ops/atxfinance-backend-http-api.md` |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-01 | Engineering | Phase 3 scanner categories + executor map; Mongo option-chain cache / circuit breaker; Kotlin `ALLOWED_CATEGORIES` parity — see **`scanners-phase3-plan.md`**. |
| 2026-04-02 | Engineering | **Portfolio** scheduled-task UI/API removed; tenant **`/admin/tasks`** only; scheduler ignores legacy `portfolioId` rows; TBD xChat options-scanner jobs. |
| 2026-03-25 | Engineering | Replaced generic SQL/FastAPI draft with **xFinance-aligned** map: Mongo **`admin_scheduled_tasks`** / **`admin_task_runs`**, **`/admin/tasks`** + **`TasksConsole`**, admin API table, BFF note, **PLAN.md** pointer. |
