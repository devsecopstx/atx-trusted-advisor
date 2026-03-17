# AGENTS Runbook

## Scope

Operational runbook for engineers/agents working in `xfinance` core admin app.

## Standard Local Flow

1. `cp .env.example .env`
2. `docker compose up -d`
3. `npm install`
4. `npm run seed:admin`
5. `npm run dev`

## Validation Gates

- Lint: `npm run lint`
- Types: `npm run typecheck`
- Tests: `npm run test`
- Build: `npm run build`
- CI gate: `npm run ci:gate`

## Critical Env Keys

- `MONGODB_URI_B64`
- `XAI_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`

## Quick Health Checks

- API health: `GET /api/health`
- Auth callback path configured in X app: `/api/auth/x/callback`
- Personas API: `GET /api/personas`
- xChat ask API: `POST /api/xchat/ask`

## Guardrails

- Keep secrets only in `.env`; never commit real tokens.
- Prefer updating existing docs over creating duplicates.
- For persona/xchat/admin-audit changes, run at least build + typecheck before PR.
