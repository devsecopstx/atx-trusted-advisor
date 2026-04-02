# Price Scanner Job

**Service id**: `price-scanner` (`PRICE_SCANNER_SERVICE_ID` in code)  
**Type**: Scheduled background job (triggered by `admin_scheduled_tasks` with `category: price_scanner`)

## Implementation (Next.js)

| Piece | Location |
|--------|----------|
| **Job entrypoint** | `executePriceScannerJob` — `src/modules/scanner/price-scanner-job.ts` |
| **Scheduled task routing** | `runScheduledCategory` → `price_scanner` → `executePriceScannerJob({ tenantId })` — `src/modules/core-admin/task-runner.ts` |
| **Admin schedule / cron** | `/admin/tasks` — `admin_scheduled_tasks`; manual run: `POST /api/admin/tasks/{taskId}/run` |
| **Compat wrapper** | `runPriceScanner(task)` — `src/modules/scanner/price-scanner.ts` (delegates to `executePriceScannerJob`) |

The scheduled-task pipeline does **not** call a separate HTTP microservice: the **service job** is the exported `executePriceScannerJob` function above (tenant-scoped scanner + Yahoo batch quotes + Mongo updates).

## Purpose

The price-scanner is a lightweight, tenant-scoped job that keeps **watchlist rows** aligned with latest prices for symbols drawn from **portfolio holdings** and **watchlists** for the tenant. It runs when the admin enables a `price_scanner` scheduled task (or on manual run).

## Scope

- Scans **all portfolios** (and related accounts/positions/watchlists) belonging to the current **tenant** (`tenantId` on the task).
- Collects unique symbols from positions + watchlist entries, fetches quotes via **Yahoo Finance** (`getYahooBatchQuotes`), updates watchlist symbol rows (`lastPrice`, `lastUpdatedAt`).
- Updates **`tenant_market_calendar`** snapshot via `updateTenantMarketCalendarSnapshot` for desk visibility.
- Skips heavy work when `resolveUsMarketDayContext` reports **non-business day** or **outside regular market window** (success with `skipped` in output — see task run logs / Slack summary).

## Output & logging

- Per-run text summary is the **`output`** string on `admin_task_runs` (e.g. `items_updated`, `items_scanned`, `duration_s`).
- Optional **Slack** summary when the task has an `admin_delivery_channels` Slack target (see scheduled-task Slack notify).
- Core scanner audit: `logCoreScannerRunAudit` in `executeScheduledTask` (`task-runner.ts`).

## Roadmap (doc vs code)

The following items in the original design are **not** all implemented in `price-scanner-job.ts` yet; treat as product/infra backlog:

- `price_scan_history` table, Prometheus metrics, circuit breaker, multi-provider fallback, per-portfolio transactions, dead-letter queue, intraday >2% push rules.

**Status**: Core path implemented — `executePriceScannerJob` + scheduled task wiring as above.
