# Contributing

## Branching

- Create a feature branch from `main`.
- Keep changes scoped to one logical objective per PR.

## Local Quality Gate

Before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Pull Request Expectations

- Explain **why** the change is needed.
- Include test/validation steps performed.
- Call out env/config impacts explicitly.
- Keep docs updated when APIs, setup, or workflows change.

## API routes and OpenAPI inventory

When you add or change handlers under `src/app/api/**/route.ts`:

1. Register the path and HTTP methods in `src/lib/openapi/current-state.ts` (`CURRENT_STATE_ROUTES`).
2. Add operation-level detail in `src/lib/openapi/current-state-overrides.ts` when the default generic operation is not enough.
3. Ensure `npm run test -- tests/integration/openapi-current-state-coverage.test.ts` and `tests/integration/openapi-document-build.test.ts` pass (both covered by `npm run ci:gate`).

See [DEVELOPMENT.md — API docs validation](DEVELOPMENT.md#api-docs-validation).

## Security and Secrets

- Never commit `.env` or raw credentials.
- Use `.env.example` for placeholder keys only.
