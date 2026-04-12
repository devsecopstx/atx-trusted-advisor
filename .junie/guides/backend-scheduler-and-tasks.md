# Backend scheduler and tasks (JVM)

Scope:
- System poller: `AdminSchedulerPoller.kt`
- Service: `AdminScheduledTasksService.kt`
- Controller: `AdminScheduledTasksController.kt`
- Properties: `AtxfinanceProperties.scheduler`
- Tests: `AdminSchedulerSystemPollIntegrationTest.kt`, `AdminSchedulerSystemWideFanOutIntegrationTest.kt`

Key behaviors:
- Polling: `@Scheduled(fixedRateString = app.atxfinance.scheduler.poll-interval-ms)`; ShedLock gate ensures one replica processes at a time.
- Per-task lock: each due task claims a Mongo/ShedLock lock before enqueue.
- Fan-out: system-wide tasks (no `tenantId`) advance schedule once; then enqueue one `admin_task_runs` per tenant.
- Categories: user-history executes JVM handler; other categories simulate/no-op and may route to Next.js task-runner in comments.

Adding a new task category:
1) Extend `ALLOWED_CATEGORIES` in companion object.
2) Add handler clause in `simulateTaskExecution` or wire a real service.
3) Ensure/create Next counterparts when required.

Manual tick (dev):
- Next: `POST /api/admin/scheduler/tick` — session-scoped, mirrors tenant read semantics.

Troubleshooting:
- If compilation fails, verify braces around the service `companion object` and constants in scope.
- If duplicate runs appear, validate per-task lock acquisition and ShedLock configuration.
