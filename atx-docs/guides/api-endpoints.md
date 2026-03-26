# API Endpoints Guide

Current route inventory grouped by domain. Source of truth remains `src/app/api/**` and `/api/openapi`.

## Deep-dive docs

- `src/lib/openapi/current-state.ts` (generated inventory source)
- `atx-docs/sre-ops/atxfinance-backend-http-api.md` (Spring backend API contract)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (Next -> Spring route migration status)

## Health and auth

- `GET /api/health`
- `GET /api/openapi`
- `GET /api/auth/x/login`
- `GET /api/auth/x/callback`
- `POST /api/auth/link-email`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Access requests and feedback

- `POST /api/access-requests`
- `POST /api/user-feedback`

## Admin access requests

- `GET /api/admin/access-requests`
- `POST /api/admin/access-requests`
- `GET /api/admin/access-requests/:requestId`
- `PATCH /api/admin/access-requests/:requestId`
- `PUT /api/admin/access-requests/:requestId`
- `DELETE /api/admin/access-requests/:requestId`

## Admin users

- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/users/approved`
- `GET /api/admin/users/:userId`
- `PUT /api/admin/users/:userId`
- `DELETE /api/admin/users/:userId`
- `PATCH /api/admin/users/:userId/email`
- `PATCH /api/admin/users/:userId/plan`
- `PATCH /api/admin/users/:userId/role`
- `GET /api/admin/users/:userId/settings`
- `PUT /api/admin/users/:userId/settings`

## Admin tasks and scheduler

- `GET /api/admin/tasks`
- `POST /api/admin/tasks`
- `POST /api/admin/tasks/:taskId/run`
- `POST /api/admin/scheduler/tick`
- `GET /api/admin/task-runs`

## Admin audit/bootstrap

- `GET /api/admin/audit`
- `GET /api/admin/bootstrap-status`

## Personas and collections

- `GET /api/personas`
- `POST /api/personas`
- `GET /api/personas/collections`
- `GET /api/personas/collections/:collectionId`
- `POST /api/personas/collections`
- `GET /api/personas/:personaId`
- `PUT /api/personas/:personaId`
- `DELETE /api/personas/:personaId`
- `POST /api/personas/:personaId/collection/create`
- `POST /api/personas/:personaId/collection/link-files`
- `POST /api/personas/:personaId/verify-collection`
- `POST /api/personas/:personaId/publish`
- `POST /api/personas/:personaId/archive`
- `POST /api/personas/:personaId/rollback`
- `GET /api/personas/:personaId/versions`

## Portfolio, positions, watchlist

- `GET /api/portfolios/default`
- `GET /api/portfolios/:portfolioId/accounts`
- `PATCH /api/portfolios/:portfolioId/accounts/:accountId`
- `GET /api/portfolios/:portfolioId/watchlist`
- `PATCH /api/portfolios/:portfolioId/watchlist`
- `GET /api/positions?portfolioId=&accountId=`
- `POST /api/positions`
- `DELETE /api/positions/:positionId?portfolioId=&accountId=`

Admin portfolio routes include:

- `PATCH /api/admin/portfolios/:portfolioId`
- `GET|PATCH /api/admin/portfolios/:portfolioId/watchlist`
- `POST /api/admin/import/broker`

## xStrategyBuilder / strategy options

- `GET /api/strategy-options/expirations`
- `GET /api/strategy-options`

## xChat

- `POST /api/xchat/ask`
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

## API docs validation checklist

1. `GET /api/openapi` returns 200.
2. `GET /admin/api-docs` loads in admin session.
3. `tests/integration/openapi-current-state-coverage.test.ts` passes.
4. `tests/integration/openapi-document-build.test.ts` passes.

For xChat-specific API semantics (persona resolution, batch behavior), see `atx-docs/guides/xchat-personas.md`.
