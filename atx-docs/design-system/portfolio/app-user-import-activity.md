# App-user broker holdings import (`/import-activity`)

**Shipped:** PLAN **710** (app ≥2.10.14).

- **UI:** [`src/app/import-activity/page.tsx`](../../../src/app/import-activity/page.tsx) + [`import-activity-client.tsx`](../../../src/app/import-activity/import-activity-client.tsx); entry CTA from [`/portfolios`](../../../src/app/portfolios/page.tsx) (**Import activities**).
- **API:** [`POST /api/import/broker`](../../../src/app/api/import/broker/route.ts) — `requireApprovedAppUserSession`; body mirrors admin import (`portfolioId`, `broker`, `exportType: holdings`, `csv`, `mappings`, optional `fidelityHoldingsDefaultAccountRef`, `dryRun`).
- **Execution:** Mongo **`app_broker_import_jobs`** (CSV ≤ **1 MiB** chars) + ephemeral **`admin_scheduled_tasks`** (`category: sync-broker`, `appBrokerImportJobId`, `portfolioId`, `nextRunAt` now). Next **`executeScheduledTask`** → [`runScheduledAppBrokerImportTask`](../../../src/modules/portfolio-import/app-broker-import-job.ts); task document removed after run; **`admin_task_runs`** kept.
- **Admin parity:** Holdings pipeline shared with [`broker-holdings-import.ts`](../../../src/modules/portfolio-import/broker-holdings-import.ts); admin-only route remains **`POST /api/admin/import/broker`**.
