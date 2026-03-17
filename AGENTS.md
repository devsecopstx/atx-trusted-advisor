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

## Cursor Cloud specific instructions

- Environment recipe is tracked in `.cursor/environment.json`.
- Install/update step in cloud: `npm ci`.
- Long-running service in cloud: `npm run dev` terminal.
- Required cloud secrets (configure in Cursor dashboard, not in git):
  - `MONGODB_URI_B64`
  - `XAI_API_KEY`
  - `XAI_MANAGEMENT_API_KEY`
  - `X_OAUTH_CLIENT_ID`
  - `X_OAUTH_CLIENT_SECRET`
- Minimal cloud smoke check after boot:
  - `npm run typecheck`
  - `npm run build`

### Docker prerequisite

Docker must be installed and running before `docker compose up -d`. In the cloud VM this requires `sudo dockerd` (started in the background) plus `sudo` for all docker/compose commands, or adding the user to the `docker` group. The fuse-overlayfs storage driver and iptables-legacy are needed for nested-container environments.

### Session cookie for testing authenticated endpoints

There is no dev auth bypass. To call protected endpoints (`/api/admin/*`, `/api/personas`, `/api/xchat/ask`, etc.) without OAuth, craft a signed session cookie using the `AUTH_SECRET` from `.env`:

```bash
node --env-file=.env -e "
const crypto = require('crypto');
const secret = process.env.AUTH_SECRET || process.env.X_OAUTH_CLIENT_SECRET;
const payload = JSON.stringify({
  userId: '<userId from seed output>',
  email: 'atxbogart@gmail.com',
  roles: ['global_admin'],
  tenantId: '<tenantId from seed output>',
  tenantRole: 'owner',
  xUserId: 'dev_test',
  username: 'dev_test',
  exp: Date.now() + 12*60*60*1000
});
const enc = Buffer.from(payload,'utf8').toString('base64url');
const sig = crypto.createHmac('sha256',secret).update(enc).digest('base64url');
console.log(enc+'.'+sig);
"
```

Then pass it as: `curl -b "xf_core_session=<cookie>" http://localhost:3000/api/...`

### Service startup order

1. `sudo dockerd &` (if Docker daemon not running)
2. `sudo docker compose up -d` (MongoDB on port 27017)
3. `npm run seed:admin` (idempotent; safe to re-run)
4. `npm run dev` (Next.js dev server on port 3000)

### Notes

- `MONGODB_URI_B64` in `.env.example` decodes to `mongodb://localhost:27017`; no auth needed for local MongoDB.
- Tests (`npm run test`) are all unit/integration tests with mocked dependencies — they do not require MongoDB or the dev server to be running.
- The xAI management key-create smoke test is opt-in via `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true` and requires real API keys.
- See `DEVELOPMENT.md` for the full Cloud Agent Atlas Mode setup and OAuth host-consistency notes.
