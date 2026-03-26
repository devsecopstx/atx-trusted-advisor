# atxFinance Core App Development

This document is now a lightweight index. The detailed runbooks were split into focused guides under `atx-docs/guides` so contributors can find operational details faster and update smaller docs safely.

## Scope

Core backend and UI for atxFinance admin operations and signed-in app users:

- access requests and role-based onboarding
- xChat, portfolio, watchlist, recommendations, and strategy surfaces
- persona governance and xAI integrations
- local/dev/staging/prod operator workflows

## Documentation tree

Engineering docs live under `atx-docs/` (there is no top-level `docs/` folder).

- Docs index: `atx-docs/README.md`
- New guides index: `atx-docs/guides/README.md`

## Tech Stack

- Next.js App Router + TypeScript (UI + API routes under `src/app`)
- MongoDB (primary application database)
- Kotlin/Spring backend worker (`services/atxfinance-backend`)
- xAI APIs for xChat/personas/RAG workflows

## Platform roles vs tenant membership (session)

Moved to:

- `atx-docs/guides/auth-and-access.md`

Quick reference:

- **Platform roles**: `global_admin`, `advisor`, `operator`, `viewer`
- **Tenant membership**: `tenantRole` values like `tenant_admin` and `member`
- `app_user` in docs is a product-surface term, not a literal Mongo role string

## Required Environment Keys

Moved to:

- `atx-docs/guides/local-development.md`
- `atx-docs/guides/deploy-and-ops.md`

## Local Setup (Backend → Frontend)

Moved to:

- `atx-docs/guides/local-development.md`

## Cursor Cloud Agent Setup (Atlas Mode)

Moved to:

- `atx-docs/guides/deploy-and-ops.md`

## OAuth Host Consistency

Moved to:

- `atx-docs/guides/auth-and-access.md`

## Validation Commands

Detailed validation and CI gate guidance moved to:

- `atx-docs/guides/local-development.md`

Core commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run ci:gate`

## SRE Runbook: Local Health, Tests, and CI Gate

Moved to:

- `atx-docs/guides/local-development.md`

## API Endpoints

Full endpoint inventory moved to:

- `atx-docs/guides/api-endpoints.md`

<a id="api-docs-validation"></a>

### API docs validation (pre/post deploy)

Keep these checks green whenever API routes or contracts change:

1. `GET /api/openapi` returns HTTP 200 with expected route inventory.
2. `GET /admin/api-docs` loads Swagger UI in an authenticated admin session.
3. `tests/integration/openapi-current-state-coverage.test.ts` passes.
4. `tests/integration/openapi-document-build.test.ts` passes.

## Access Request State Machine

Moved to:

- `atx-docs/guides/auth-and-access.md`

## Persona Governance

Moved to:

- `atx-docs/guides/xchat-personas.md`

## Plan Limits and Cost Controls

Moved to:

- `atx-docs/guides/xchat-personas.md`

## xPersona Collection Endpoint Notes

Moved to:

- `atx-docs/guides/xchat-personas.md`

## Multi-tenant Seed Verification

Moved to:

- `atx-docs/guides/xchat-personas.md`

## Batch Knowledge Base Workaround

Moved to:

- `atx-docs/guides/xchat-personas.md`

<a id="app_user-http-500"></a>

### App_user HTTP 500

Troubleshooting moved to:

- `atx-docs/guides/auth-and-access.md`

## Deploy/Rollback Operations

Moved to:

- `atx-docs/guides/deploy-and-ops.md`

## Design and Branding

Branding and design references remain under:

- `atx-docs/branding/`
- `atx-docs/design-system/`
- `atx-docs/xchat/xfinance-branding-review.md`
