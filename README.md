# atxFinance Core App

Admin console **and** signed-in **app_user** product surfaces for atxFinance. This repo powers:

- access request governance
- persona and collection management
- xChat / xStrategyBuilder / portfolio / watchlist / recommendations for approved app_user accounts (viewer+ platform roles)
- xChat operational workflows (default **published** personas: **Super-Agent** for `global_admin`, **xFinance** for other signed-in roles)
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

- UI: `/` (marketing; signed-in non-admins redirect to `/xchat`), `/login`, `/xchat`, `/xstrategybuilder`, `/xstrategybuilder/strategy-options` (option chain UI), `/portfolio` (default portfolio; legacy `/xfinance` redirects), `/watchlist` (default portfolio watchlist; CSV import/export), `/personas` (directory), `/admin/*` ( **`global_admin` only** — `/admin` hub and topbar include **xChat** → `/xchat`; e.g. `/admin/access-requests`, `/admin/personas`, `/admin/portfolios`, `/admin/tasks`, `/admin/batch`, `/admin/rag-files` (xAI collection inventory), `/admin/xchat-tool-usage` (tool call telemetry), `/admin/user-settings`, `/admin/audit`, `/admin/api-docs`; layout redirects non-admin routes to `/xchat`)
- API: `/api/health`, `/api/openapi` (OpenAPI 3.1 current-state JSON), `/api/personas`, `/api/access-requests`, `/api/feedback` (signed-in app feedback → optional Slack), `/api/strategy-options`, `/api/strategy-options/expirations`, `/api/xchat/ask`, `/api/xchat/batch`, `/api/admin/*` (includes `POST /api/admin/import/broker` for holdings CSV), `/api/portfolios/*`, `/api/positions`

Platform roles vs session: see [DEVELOPMENT.md — Platform roles vs tenant membership](DEVELOPMENT.md#platform-roles-vs-tenant-membership-session).

## Docs

- Full setup/runbook: `DEVELOPMENT.md`
- Operator runbook: `AGENTS.md`
- Contribution workflow: `CONTRIBUTING.md`
- Backlog / open gaps (TODO, design TBD): `docs/PLAN.md`
- **API inventory & Swagger:** `GET /api/openapi` (public JSON spec); admin Swagger UI at `/admin/api-docs` (signed-in admin). Validation steps: [DEVELOPMENT.md — API docs validation](DEVELOPMENT.md#api-docs-validation).
