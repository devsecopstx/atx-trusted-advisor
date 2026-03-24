# atx Trusted Advisor — Core App

**Release:** v2.4.17

User-facing product: **atx Trusted Advisor** (whitelabel-ready chrome: Trusted Advisor lockup + subtle **whitelabel** subline in header/footer). This repository is the **atxFinance** Next.js core: admin console and signed-in **app_user** surfaces, **Powered by xAI / Grok** for institutional-grade options and portfolio workflows.

## Stress-free trading — top 5 product pillars

1. **Conversational desk (xChat)** — Default **FinExpert** persona (directory name **xFinance**), **Super-Agent** for global admins; optional RAG collections and tools so answers stay grounded instead of guesswork.
2. **Portfolio + watchlist in one workspace** — Default book, linked accounts, watchlist with CSV import/export and aligned **risk / outlook** context (book, accounts, and watchlist) so execution views match how you think about risk.
3. **xStrategyBuilder & option chains** — Strategy options UI, expirations, and structured chain data to reduce tab-hopping and manual reconstruction of setups.
4. **Access you control** — Approval-based onboarding, platform roles (**viewer** / **operator** / **advisor**), and admin governance for personas, portfolios, and ops—no anonymous wild-west trading surface.
5. **Compliance-minded chrome** — Legal stubs (imprint, terms, privacy, security, vulnerability reporting), in-app disclaimers, and versioned API inventory for operators who need a serious audit trail.

## Quick Start

1. Copy env template: `cp .env.example .env`
2. Install deps: `npm install`
3. Start MongoDB: `docker compose up -d`
4. Seed admin defaults: `npm run seed:admin`
5. Start app: `npm run dev`

**→ Full local setup, BFF, env matrix, and troubleshooting:** [Development guide (DEVELOPMENT.md)](DEVELOPMENT.md)

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Validation (full gate)

- `npm run ci:gate` (runs lint + typecheck + test)

## Core Routes

- UI: `/` (marketing; signed-in non-admins redirect to `/xchat`), `/login`, `/xchat`, `/xstrategybuilder`, `/xstrategybuilder/strategy-options` (option chain UI), `/portfolio` (default portfolio; legacy `/xfinance` redirects), `/watchlist` (default portfolio watchlist; CSV import/export), `/personas` (directory), `/legal/imprint`, `/legal/terms`, `/legal/privacy`, `/legal/security`, `/legal/vulnerability` (all five legal routes ship default release copy; counsel review recommended for entity/jurisdiction/compliance finalization before regulated use), `/admin/*` ( **`global_admin` only** — `/admin` hub and topbar include **xChat** → `/xchat`; e.g. `/admin/access-requests`, `/admin/personas`, `/admin/portfolios`, `/admin/tasks`, `/admin/batch`, `/admin/rag-files` (xAI collection inventory), `/admin/xchat-tool-usage` (tool call telemetry), `/admin/user-settings`, `/admin/audit`, `/admin/api-docs`; layout redirects non-admin routes to `/xchat`)
- API: `/api/health`, `/api/openapi` (OpenAPI 3.1 current-state JSON), `/api/personas`, `/api/access-requests`, `/api/user-feedback` (signed-in app feedback → optional Slack), `/api/strategy-options`, `/api/strategy-options/expirations`, `/api/xchat/ask`, `/api/xchat/batch`, `/api/admin/*` (includes `POST /api/admin/import/broker` for holdings CSV), `/api/portfolios/*`, `/api/positions`

Platform roles vs session: see [DEVELOPMENT.md — Platform roles vs tenant membership](DEVELOPMENT.md#platform-roles-vs-tenant-membership-session).

Branding reference for UI copy and whitelabel: [`atx-docs/atx-xchat/xfinance-branding-review.md`](atx-docs/atx-xchat/xfinance-branding-review.md) (§8 user chrome).

## Docs

- **Development guide (setup, stack, API validation):** [DEVELOPMENT.md](DEVELOPMENT.md)
- Operator runbook: [AGENTS.md](AGENTS.md)
- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Backlog / open gaps (TODO, design TBD): [`atx-docs/PLAN.md`](atx-docs/PLAN.md) · [documentation index](atx-docs/README.md)
- **API inventory & Swagger:** `GET /api/openapi` (public JSON spec); admin Swagger UI at `/admin/api-docs` (signed-in admin). Validation steps: [DEVELOPMENT.md — API docs validation](DEVELOPMENT.md#api-docs-validation).
