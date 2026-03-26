# Local Development Guide (Tight)

Short bootstrap for a new local instance.

## 1) Required local env only

Create `.env` from `.env.example` and set only what local startup needs:

- `ADMIN_SEED_EMAIL`
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

Notes:

- Leave `MONGODB_URI` unset for local Docker Mongo fallback.
- Optional local auth settings for Mongo: `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGODB_DB_NAME`.

## 2) Start services (order)

### Recommended one-command flow

1. `npm install`
2. `cp .env.example .env`
3. `npm run dev:stack`

This starts Mongo + backend first, then frontend.

### Split-terminal flow

1. `npm run mongo:up`
2. `npm run dev:spring` (or `npm run dev:backend`)
3. `npm run dev:frontend`

## 3) Run admin seed

For each new instance, run:

- `npm run seed:admin`

What it does:

- upserts admin + tenant bootstrap
- runs xPersona sync from `atx-rag-collection/xpersonas` unless `SKIP_SEED_XPERSONAS=1`
- uploads RAG sources to xAI (when keys are present) unless `SKIP_SEED_XAI_RAG_INGEST=1`
- runs xAI hello verification unless `SKIP_XAI_POST_SEED_VERIFY=1`

## 4) Run persona and RAG sync explicitly (optional)

Use these when you need targeted re-sync without full bootstrap:

- xPersonas only: `npm run seed:xpersonas`
- options strategy preferences: `npm run seed:options-strategy-prefs`

RAG upload path used by `seed:admin`:

- `atx-rag-collection/*` via `scripts/lib/seed-xai-rag-ingest.mjs`

## 5) Smoke checks

- Backend health: `http://localhost:8080/actuator/health`
- App health: `http://localhost:3000/api/health`

## Deep links

- Bootstrap and operator runbook: [AGENTS.md](../../AGENTS.md)
- Seed script behavior: [scripts/seed-admin-user.mjs](../../scripts/seed-admin-user.mjs)
- RAG source tree rules: [atx-rag-collection/README.md](../../atx-rag-collection/README.md)
- Auth/login troubleshooting: [auth-and-access.md](./auth-and-access.md)
