# Fix CI Gate

Purpose: Run the full CI gate (`lint` + `typecheck` + `docs:links` + tests) and address common failures with minimal, targeted diffs.

Preconditions:
- Node and npm installed; repo bootstrapped (`npm ci`).

Steps:
1. Install deps:
   - `npm ci`
2. Run the gate:
   - `npm run ci:gate`
3. If ESLint unused vars on optional params:
   - Reference the param without changing behavior: `void _options;` or prefix `_param`.
4. If TS arg shape mismatches on repository calls:
   - Align function signatures to accept optional `{ tenantId?: string }` objects where callers already pass them.
5. If Mongo cursor mock lacks `limit()` in tests:
   - Prefer `find().sort().toArray()` then pick first element, or use `findOne` with an explicit `sort`.
6. Re-run:
   - `npm run ci:gate`

Success criteria:
- Exit code 0; no TypeScript, lint, or test failures; markdown links pass.

Rollback:
- If a change would affect runtime behavior, open a PR with a note and revert local changes pending review.
