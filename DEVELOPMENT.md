# xFinance Core App Development

## Scope

This app is the admin-only core backend for xFinance operations:

- user access request management
- task scheduling metadata
- user broker/portfolio/account defaults
- notification defaults

## Tech Stack

- Next.js App Router (`src/app/api/*`) for backend routes
- MongoDB database: `xfinancedb`
- TypeScript + Zod validation

## Required Environment Keys

Use `.env` only (do not use `.env.local` for this app).

- `MONGODB_URI_B64` (Base64-encoded MongoDB URI)
  - legacy alias also supported: `MONGODB_URI_B4`
- `XAI_API_KEY`
- `X_OAUTH_CLIENT_ID` (raw client id from X app, not base64-encoded)
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET` (recommended for session signing)
- `X_OAUTH_CALLBACK_URL` (optional; defaults to current request origin + `/api/auth/x/callback`)
- `ADMIN_SEED_EMAIL` (optional, default `atxbogart@gmail.com`)
- `ADMIN_X_USERNAMES` (optional allowlist, comma-separated)

## Local Setup

1. Install dependencies:
   - `npm install`
2. Start MongoDB:
   - `docker compose up -d`
3. Configure environment:
   - `cp .env.example .env`
4. Start dev server:
   - `npm run dev`
5. Seed core admin user + default tenant:
   - `npm run seed:admin`

## OAuth Host Consistency

OAuth flow cookies are host-scoped. Keep these values aligned to avoid `missing_oauth_cookie_context`:

- Browser host you use (`127.0.0.1`)
- `X_OAUTH_CALLBACK_URL` host (if explicitly set)
- X app redirect URI in developer settings

If they do not match exactly, state/verifier cookies can be missing on callback.

## Validation Commands

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Seed admin: `npm run seed:admin`
- Backfill legacy xchat identity fields: `npm run migrate:xchat-identity`

## API Endpoints

- `GET /api/health`
- `GET /login`
- `GET /admin` (auth required)
- `GET /api/auth/x/login`
- `GET /api/auth/x/callback`
- `POST /api/auth/link-email` (email-first fallback link flow)
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/admin/access-requests`
- `GET /api/admin/bootstrap-status`
- `POST /api/admin/access-requests`
- `GET /api/admin/tasks`
- `POST /api/admin/tasks`
- `POST /api/admin/tasks/:taskId/run`
- `POST /api/admin/scheduler/tick`
- `GET /api/admin/task-runs`
- `GET /api/admin/users/:userId/settings`
- `PUT /api/admin/users/:userId/settings`
- `GET /api/personas`
- `POST /api/personas`
- `GET /api/personas/:personaId`
- `PUT /api/personas/:personaId`
- `DELETE /api/personas/:personaId`
- `GET /api/rag/files`
- `POST /api/rag/files`
- `POST /api/xchat/ask`

## Multi-tenant Seed Verification

After running `npm run seed:admin`, verify:

1. `core_users` has `atxbogart@gmail.com` with role `global_admin`
2. `core_tenants` has `slug: xfinance-core` with `isDefault: true`
3. `core_tenant_memberships` has one default membership linking the admin user and default tenant

Re-running `npm run seed:admin` should remain idempotent (no duplicates).

## Example Payloads

### Create Access Request

`POST /api/admin/access-requests`

```json
{
  "userId": "usr_123",
  "requestedRole": "operator",
  "reason": "Needs broker reconciliation access"
}
```

### Create Access Request By Email (manual admin entry)

`POST /api/admin/access-requests`

```json
{
  "email": "analyst@xfinance.ai",
  "requestedRole": "operator",
  "reason": "Onboarding from admin console"
}
```

### Create Scheduled Task

`POST /api/admin/tasks`

```json
{
  "name": "Daily Broker Sync",
  "category": "sync-broker",
  "scheduleCron": "0 2 * * *",
  "enabled": true
}
```

### Upsert User Admin Settings

`PUT /api/admin/users/usr_123/settings`

```json
{
  "broker": {
    "provider": "alpaca",
    "accountRef": "alpaca-main",
    "enabled": true
  },
  "portfolio": {
    "riskProfile": "balanced",
    "baseCurrency": "USD",
    "rebalanceFrequencyDays": 14
  },
  "account": {
    "accountStatus": "active",
    "maxConcurrentSessions": 3,
    "timezone": "America/New_York"
  },
  "notificationDefaults": {
    "email": true,
    "push": true,
    "sms": false,
    "digestHourUTC": 13
  }
}
```
