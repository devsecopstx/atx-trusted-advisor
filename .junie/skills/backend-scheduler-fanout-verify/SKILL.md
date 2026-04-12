# Backend Scheduler Fan-out — Verify

Purpose: Verify JVM-side poller claims due tasks and fans out system-wide tasks to per-tenant runs.

Preconditions:
- Java 17+, local Mongo available (embedded Mongo used by tests).

Steps:
1. Run targeted tests (from repo root):
   - `./services/atxfinance-backend/gradlew -p services/atxfinance-backend test --tests '*AdminSchedulerSystem*'`
2. Review output: ensure both tests pass:
   - `AdminSchedulerSystemPollIntegrationTest`
   - `AdminSchedulerSystemWideFanOutIntegrationTest`

Success:
- Tests green; logs show `system-scheduler` trigger; fan-out created N runs = tenant count; `nextRunAt` advanced once.

Troubleshooting:
- If unresolved references occur, ensure the `companion object` is inside the service class and imports are intact.
- If no runs created, check Mongo URI test property and embedded Mongo port binding.
