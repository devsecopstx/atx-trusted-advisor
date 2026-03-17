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
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

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

## Project Cursor Skills (Safe Set)

- Project-local skills are stored in `.cursor/skills/`. See `.cursor/skills/README.md` for the full index.
- Ops/review skills: `xfinance-docs-ops`, `xfinance-xchat-validation-checklist`, `xfinance-runbook-navigator`, `xfinance-design-ops`, `xdesign-review`.
- Strategy skills: 10 `xfinance-strategy-*` skills (options strategy references).
- All skills are non-destructive — they must not deploy, rotate keys, or mutate production/staging secrets.
- Runtime xChat custom-tool execution is intentionally deferred; see `docs/xchat/xfinance-tool-stub.md`.

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
| `ALLOW_ANY_X_USER_LOGIN` | Optional feature flag (`true` enables authenticated X-user login to `/xchat`; default is disabled) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for access request notifications (optional) |

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
  tenantRole: 'tenant_admin',
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

**Completed:**
- Phase 1: Token hygiene — badge variants, marketing-hero hex→tokens, chart bar tokens, admin hub hero alignment.
- Phase 2: Chart tokens (`--xf-chart-*`), xStrategyBuilder coming-soon card, `value-gain`/`value-loss` CSS utilities.

**Phase 3 — xchat for non-admin users (next branding feature):**
- Build a user-facing `/chat` or `/xchat` route — authenticated, non-admin. Uses the shared brand kit (dark-first, `--xf-*` tokens, Inter font, logo lockup).
- Two user states to brand:
  - **Approved users** — full xchat access, persona selection, chat UI with `--xf-surface-700` cards and `--xf-gain-green` accents for AI responses.
  - **Not-approved users** — gated landing with "Access pending" state, clear messaging, and a CTA that triggers a Slack notification to admin for approval.
- Admin receives Slack notification on new access requests (webhook integration). Approve/deny from `/admin/access-requests`.
- Reuse existing access-request API (`POST /api/admin/access-requests`) for the request flow.
- Brand the chat UI consistently: message bubbles, persona badges, typing indicators, error states — all using `--xf-*` tokens.

**Phase 4 — xFeature plans, limits, and fees:**
- Introduce plan tiers: free (limited prompts/day), paid/premium (higher limits, priority, advanced personas).
- Brand surfaces needed: plan selection card, usage meter/bar, upgrade CTA, limit-reached gate.
- Token candidates: `--xf-plan-free`, `--xf-plan-premium`, `--xf-plan-accent` for tier-specific color treatments.
- Backend: per-user plan field (already exists in user settings `plan`), rate limiting per plan, fee/billing integration (Stripe or xMoney when available).
- Admin surface: plan assignment in `/admin/user-settings`, usage dashboard, plan override controls.

**Phase 5 — xfinance tool surface branding (deferred until tool ships):**
- When `xfinance` custom tool ships (see `docs/xchat/xfinance-tool-stub.md`), add a tool-result card component with branded output formatting using `--xf-surface-700` + `--xf-chart-*` tokens.
- Extend xChat console with tool invocation visual treatment (distinct from plain chat responses).
- Use `value-gain`/`value-loss` utilities for numeric outputs from portfolio/watchlist operations.

**Phase 6 — xMoney (deferred until available):**
- Payment rails and transfer actions brand surface. When xMoney launches, add brand tokens (`--xf-xmoney-*`), a logo lockup variant, and a dedicated admin section or card treatment. Reference `design-system/xfinance-brand-kit.md` for ecosystem naming: `xFinance` (platform), `Grok` (AI assistant), `xMoney` (payments).

**Standing design rules:**
- Personas vs Collections separation — `/admin/personas` shows persona configs only (prompts, tools, collectionId links). Collections management stays in RAG Uploads or a dedicated `/admin/collections` page.
- All admin sub-pages delegate auth + session panel to the shared admin layout (`src/app/admin/layout.tsx`). Do not add duplicate `AdminSessionPanel` imports.
- No hardcoded hex in app CSS — use `--xf-*` tokens from `design-system/xfinance-brand-kit.css`.
