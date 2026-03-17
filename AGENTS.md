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

### Database: Atlas mode (no local Docker)

Cloud agents connect to MongoDB Atlas — **do NOT run `docker compose up -d`**.
The `MONGODB_URI_B64` secret is injected as an environment variable by the Cursor Cloud
runtime. The update script writes `.env` from these injected secrets automatically.

### .env generation

The `.env` file is generated at startup from Cursor secrets. Required secrets
(configured in Cursor Cloud > Secrets):

| Secret name | Purpose |
|---|---|
| `MONGODB_URI_B64` | Base64-encoded Atlas connection string |
| `XAI_API_KEY` | xAI API key for chat completions |
| `XAI_MANAGEMENT_API_KEY` | xAI management key for collection ops |
| `X_OAUTH_CLIENT_ID` | X OAuth client ID (raw, not base64) |
| `X_OAUTH_CLIENT_SECRET` | X OAuth client secret |
| `AUTH_SECRET` | Session signing secret (min 16 chars) |

### Starting the app

```bash
npm run dev          # Next.js dev server on :3000
npm run seed:admin   # Idempotent — safe to re-run
```

Verify: `curl http://localhost:3000/api/health` should return `{"status":"ok","service":"xfinance-core-app","db":"xfinancedb"}`.

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

### Validation gates

See `package.json` scripts — same as documented in README:
`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run ci:gate`.

### Agent roles

Three cloud agent configurations are supported:

1. **PR Reviewer** — runs `npm run ci:gate` (lint + typecheck + test), reviews diff for type-safety and code-style compliance.
2. **Feature Branding** — works on UI/design-system changes under `src/app/`, `design-system/`, and brand-related assets.
3. **Feature Core MVP** — works on API routes (`src/app/api/`), domain logic (`src/lib/`), and data layer changes.

All three share the same update script and secret requirements above.

### Gotchas

- The env schema (`src/lib/env.ts`) requires `XAI_API_KEY`, `XAI_MANAGEMENT_API_KEY`, `X_OAUTH_CLIENT_ID`, and `X_OAUTH_CLIENT_SECRET` to be non-empty strings. The app will not start without them even if you only need non-AI endpoints.
- `AUTH_SECRET` must be at least 16 characters or Zod validation fails silently at `.optional()` parse.
- The seed script uses `--env-file=.env` (Node 20+ flag), so `.env` must exist before running `npm run seed:admin`.
- Auth-protected endpoints (`/api/personas`, `/api/admin/*`, `/admin/*`) return `{"error":"Unauthorized"}` without a valid session cookie. The health endpoint is unauthenticated.
- Tests (`npm run test`) are all unit/integration tests with mocked dependencies — they do not require MongoDB or the dev server to be running.
- The xAI management key-create smoke test is opt-in via `RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE=true` and requires real API keys.
- `*.code-workspace` files are gitignored — they are local IDE config and not used by cloud agents.
- See `DEVELOPMENT.md` for the full Cloud Agent Atlas Mode setup and OAuth host-consistency notes.

### Branding TODOs

- **xMoney** — payment rails and transfer actions brand surface. Not yet available. When xMoney launches, add brand tokens (`--xf-xmoney-*`), a logo lockup variant, and a dedicated admin section or card treatment. Reference `design-system/xfinance-brand-kit.md` for the ecosystem naming convention: `xFinance` (platform), `Grok` (AI assistant), `xMoney` (payments). Keep the existing neutral monochrome palette and extend with xMoney-specific accent if the brand kit is updated.
- **Personas vs Collections separation** — `/admin/personas` should only show persona configs (prompts, tools, collectionId links). Collections management UI should stay in RAG Uploads or a dedicated `/admin/collections` page. Do not re-introduce a standalone collections card in the personas view.
