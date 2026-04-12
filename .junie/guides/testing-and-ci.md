# Testing and CI

Quick commands:
- Unit + integration tests: `npm run test`
- Integration-only: `npm run test:integration`
- Live integration (ephemeral services): `npm run test:integration:live`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Full gate: `npm run ci:gate`
- Backend tests: `npm run build:backend` (runs Gradle tests)

Common patterns:
- Prefer minimal TypeScript diffs to satisfy types (e.g., add optional params and reference them via `void _opt`).
- Avoid cursor chain pitfalls in tests: prefer `find().sort().toArray()[0]` over `.limit(1)` to keep mock compatibility, or use `findOne` with `sort`.

Troubleshooting:
- If `limit is not a function` on a Mongo cursor in tests, switch to `toArray()` then pick `rows[0]` or use `findOne` with an explicit `sort`.
- If failing expectations target repo calls (e.g., missing `{ tenantId }`), pass the expected shape but keep server behavior stable.

References:
- `tests/integration/admin-delivery-channels-routes.test.ts`
- `tests/integration/portfolio-provisioning-repository.test.ts`
- Backend fan-out tests under `services/atxfinance-backend/src/test/kotlin/**`
