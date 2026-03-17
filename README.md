# xFinance Core App

Admin-only operations platform for xFinance. This repo powers:

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

## Core Routes

- UI: `/admin`, `/admin/personas`, `/admin/xchat`, `/admin/audit`
- API: `/api/personas`, `/api/xchat/ask`, `/api/admin/*`, `/api/health`

## Docs

- Full setup/runbook: `DEVELOPMENT.md`
- Operator runbook: `AGENTS.md`
- Contribution workflow: `CONTRIBUTING.md`
