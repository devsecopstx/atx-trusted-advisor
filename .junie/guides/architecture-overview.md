# Architecture overview

Domains:
- Next.js (App Router) — user-facing app, admin console, BFF helpers.
- Spring Boot backend — scheduler poller, portfolio provisioning, OAuth identity.
- MongoDB — primary datastore; Redis optional.
- Cloud Run — deploy target (Next and backend services); Stripe webhooks.

Key flows:
- Scheduler (JVM):
  - Poller: `AdminSchedulerPoller.kt` calls `AdminScheduledTasksService.enqueueDueTasksForSystemPoll` with ShedLock.
  - Fan-out: system-wide tasks (no `tenantId`) advance once and enqueue one run per tenant.
  - API parity: Next still exposes `POST /api/admin/scheduler/tick` for manual/dev.
- Delivery channels & notify (Next):
  - Repo: `src/modules/core-admin/repository.ts` (admin channels, run summaries to Slack/email);
  - Notifier: `src/modules/core-admin/scheduled-task-slack-notify.ts`.
- Billing & workspace limits (Next):
  - Tenant defaults + plan overrides drive `/account/billing`; guest resolves default tenant via `resolveTenantIdHexForGlobalAdminConsole`.

References:
- Backend properties: `AtxfinanceProperties.kt`
- Mongo tenant filters: `PortfolioMongoFilter.kt`
- Docs: `atx-docs/guides/deploy-and-ops.md`, `atx-docs/design-system/*`
