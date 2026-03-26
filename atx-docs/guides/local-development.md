# Local Development Guide

This is the local-dev entrypoint. For deep implementation details, use the linked source docs below.

## Deep-dive docs

- `AGENTS.md` (operator flow + local bootstrap commands)
- `atx-docs/sre-ops/atxfinance-backend-http-api.md` (backend HTTP contract + health endpoints)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (BFF migration and proxy-surface context)

## Required environment keys

Use `.env` (not `.env.local`) for this app.

Required:

- `MONGODB_URI` (optional for local Docker Mongo fallback)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `ADMIN_SEED_EMAIL`

Common optional keys:

- `MONGO_ROOT_USERNAME` (default `admin`)
- `MONGO_ROOT_PASSWORD` (empty by default)
- `MONGODB_DB_NAME` (default `atxfinance`)
- `ATXFINANCE_BACKEND_ORIGIN` (enables BFF proxy routing)
- `ALLOW_ANY_X_USER_LOGIN`
- `ENABLE_XCHAT_DEBUG`

## Local run order

1. Start MongoDB.
2. Start backend (`atxfinance-backend`).
3. Start Next.js core app.

## Quick start

1. `npm install`
2. `cp .env.example .env`
3. `npm run dev:stack` (ordered startup: compose services first, then frontend)
4. Health checks:
   - `http://localhost:8080/actuator/health`
   - `http://localhost:3000/api/health`

## Common local commands

- `npm run dev:frontend` - Next.js only
- `npm run dev:backend` - Compose backend + Mongo logs
- `npm run dev:spring` - host JVM backend bootRun
- `npm run dev:host` - host backend + Next chained
- `npm run mongo:up` - start only Mongo and wait healthy
- `npm run mongo:down` - stop Mongo
- `RESET_LOCAL_MONGO=1 npm run mongo:reset` - destructive local Mongo volume reset + seed flow
- `npm run local:bootstrap` - Mongo up + seed admin
- `npm run seed:admin` - idempotent admin/bootstrap seed

## BFF routing notes

When `ATXFINANCE_BACKEND_ORIGIN` is set, selected API routes are proxied to Spring (`src/lib/bff-proxy-routes.ts`).

- Use the same auth/session config between Next and Spring.
- Keep route parity tests and API docs updated for proxy-surface changes.

## Validation gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run ci:gate`

## Troubleshooting

- **Mongo auth errors:** ensure `MONGODB_URI` is unset if using local no-auth Mongo.
- **Wrong DB target:** align URI path with `MONGODB_DB_NAME`.
- **Port conflicts:** verify `27017`, `8080`, and `3000` are available.
- **OAuth callback mismatch:** keep browser host, callback env, and X app callback host consistent.

For OAuth-specific troubleshooting flow, use `atx-docs/guides/auth-and-access.md`.
