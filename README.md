# atxFinance Core App

Admin-only operations platform for atxFinance. This repo powers:

- access request governance
- persona and collection management
- xChat operational workflows
- audit visibility for admin actions
- portfolio/account bootstrap defaults

## Quick Start

1. Copy env template: `cp .env.example .env`
2. Install deps: `npm install`
3. Start MongoDB: `docker compose up -d`
4. Seed admin defaults: `npm run seed:admin`
5. Start app: `npm run dev`

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Validation (full gate)

- `npm run ci:gate` (runs lint + typecheck + test)

## Core Routes

- UI: `/login`, `/xchat`, `/admin`, `/admin/access-requests`, `/admin/personas`, `/admin/portfolios`, `/admin/tasks`, `/admin/xchat`, `/admin/rag-files`, `/admin/user-settings`, `/admin/audit`, `/admin/api-docs`, `/personas`
- API: `/api/health`, `/api/openapi` (OpenAPI 3.1 current-state JSON), `/api/personas`, `/api/access-requests`, `/api/xchat/ask`, `/api/xchat/batch`, `/api/admin/*`, `/api/portfolios/*`, `/api/positions`

## Docs

- Full setup/runbook: `DEVELOPMENT.md`
- Operator runbook: `AGENTS.md`
- Contribution workflow: `CONTRIBUTING.md`
- **API inventory & Swagger:** `GET /api/openapi` (public JSON spec); admin Swagger UI at `/admin/api-docs` (signed-in admin). Validation steps: [DEVELOPMENT.md — API docs validation](DEVELOPMENT.md#api-docs-validation).
