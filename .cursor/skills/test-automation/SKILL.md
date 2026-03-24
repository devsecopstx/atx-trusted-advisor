---
id: test-automation
name: test-automation
description: Add or improve automated tests around changed behavior with emphasis on regression and edge-case coverage.
---

# Test Automation

## Goal

Increase confidence in changed code by adding focused automated tests with
meaningful assertions.

## Use This Skill When

- New logic is merged without sufficient tests
- Bug fixes need regression protection
- Edge cases are not covered

## Workflow

1. Identify risk-bearing code paths changed recently.
2. Add tests for happy path, edge path, and failure path.
3. Prefer deterministic fixtures and minimal mocking.
4. Run affected test suite and iterate until green.

## atxFinance conventions (this repo)

- **Runner:** Vitest — `npm run test` (includes `tests/unit/**` and
  `tests/integration/**`).
- **Gate:** Prefer **`npm run ci:gate`** before merge (lint + typecheck + test);
  add **`npm run build`** when App Router or build-time code changes.
- **Integration tests** mock I/O (Mongo, xAI fetch) — see patterns under
  `tests/integration/*xchat*`, `*persona*`, `openapi-*.test.ts`.
- **OpenAPI / route inventory:** If `src/app/api/**` contracts change, update
  **`tests/integration/openapi-*.test.ts`** and **`DEVELOPMENT.md`**
  *api-docs-validation* (see **`generate-docs`**).

### xChat / batch surfaces

- **Ask route** (`POST /api/xchat/ask`): integration tests for auth, rate limits,
  RAG/tool paths; keep aligned with `docs/atx-xchat/*.md`.
- **Batch** (`POST /api/xchat/batch`, polling, `batch-service`): mock
  `submitBatchJob` / xAI batch client where routes are tested; add **unit**
  tests for pure helpers (e.g. `src/modules/xchat/batch-prompt-context.ts`).
- **Async batch jobs:** server-side flow is **submit → poll**
  (`pollBatchJob` / dashboard); tests should assert **correlation** of
  `custom_id` → stored item, not assume synchronous completion in one HTTP
  round-trip. Upstream:
  [xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api).

## Output

- Tests added/updated
- Coverage rationale
- Residual testing gaps (optional: track non-blocking items in **`docs/PLAN.md`**)
