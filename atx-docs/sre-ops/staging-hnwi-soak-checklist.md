# Staging soak — HNWI-style traffic (portfolio, watchlist, admin tasks)

Manual checklist for **2–3 test accounts** on **staging** after BFF / portfolio / strategy changes. Goal: no **lost writes**, **double-applied** mutations, or **missing audit** rows under concurrent-ish use.

## Preconditions

- Staging URLs and deploy revision from `npm run status:deploy` (or GitHub **Deploy Cloud Run** run).
- **`ATXFINANCE_BACKEND_ORIGIN`** on the Next revision points at the **Spring** Cloud Run URL (not the Next public URL); startup gate in `src/instrumentation.ts` should pass.
- Three **approved** app users (e.g. advisor/operator) on the same tenant or split tenants per your scenario — label them **HNWI-A**, **HNWI-B**, **HNWI-C** (or use two + one admin).

## 1. Portfolio edits (app user)

Per account, on `/portfolio` (or desk flows you ship):

1. **Create or rename** a non-default portfolio; confirm **GET** `/api/portfolios/current` / list reflects it after hard refresh.
2. **Add or patch** a custodian account (cash balance change); confirm **workspace snapshot** / xChat preload if you use it.
3. **Add or PATCH** a **position** (symbol + qty); confirm row appears for **HNWI-A** while **HNWI-B** does not see it (tenant + user isolation).
4. Optional: **DELETE** a position; confirm 404 on repeat delete and no orphan UI state.

**Race spot-check:** With two browsers (A + B), both open the **same** portfolio: A adds a position while B refreshes — B should eventually see consistent data (no partial merge without refresh). Not a formal consensus test; look for obvious staleness or 500s.

## 2. Watchlist (app user)

On `/watchlist`:

1. **PATCH** add a row (symbol + optional desk fields); verify CSV export / re-import round-trip if you use it.
2. Two accounts: **HNWI-A** changes watchlist A; **HNWI-B** must not see A’s rows on a different portfolio scope.
3. Rapid **add + remove** same symbol — no duplicate keys or 500 from backend.

## 3. Admin scheduled tasks (global_admin)

**Note:** `shouldProxyAdminScheduledTasksToBackend` is **false** today — `/api/admin/tasks*` mutations stay **Next + Mongo**. Soak still validates **Mongo** consistency and **audit** for tenant-level tasks.

1. **Admin → Tasks** (or `/admin/tasks`): open a **tenant-level** scheduled task (no `portfolioId` on row).
2. **PATCH** schedule / enabled / name; confirm next run text updates.
3. **POST** manual **Run** (`/api/admin/tasks/{taskId}/run`); confirm success payload and **task run** row or log in admin UI if exposed.
4. Optional: **DELETE** a disposable test task in a scratch tenant only.

## 4. Strategy jobs (Premium+ / entitlements)

Accounts with **hardcore strategy jobs** entitlement:

1. **POST** `/api/strategy-jobs` — job created (or JVM error surfaced clearly).
2. **POST** `/api/strategy-jobs/{jobId}/turns` — turn accepted.
3. Confirm **GET** job + artifact paths match expectations (see integration tests `strategy-jobs-route.test.ts`, `strategy-job-turns-route.test.ts`).

## 5. Audit and admin audit trail

1. After admin mutations (tenant roles, task patch, etc.), open **Admin → Audit** (or your audit list API) and confirm **new rows** for the actions you took — actor, tenant, entity type, timestamp monotonicity.
2. For **app-user** portfolio writes through **Spring**, confirm any **Spring-side audit** (if enabled) or **Next** audit parity per your deployment notes — if only Next logs today, note gaps rather than assuming parity.

## 6. What “pass” looks like

- No unexpected **401/403** for entitled users; no silent **200** with empty data when BFF should be on.
- No **duplicate** positions or watchlist lines from single user actions.
- **Audit**: every admin task PATCH/DELETE/run you performed has a traceable row or documented exception.

## Automation

- **CI:** `atx-mongo/*` ESLint rules + `npm run ci:gate`.
- **Hermetic:** `tests/integration/*bff-proxy*.test.ts`, `strategy-recommendations-generate-bff-proxy.test.ts`, strategy job route tests — they do **not** replace this soak; they guard **proxy wiring** and auth gates.
