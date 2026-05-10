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
- Optional: `REDIS_URL` (`redis://` / `rediss://`) for Yahoo batch quote caching, **tenant UX policy** keys (`tenant-ux:policy:v2:*`), workspace snapshot cache, and `GET /api/health` redis checks — see `atx-docs/sre-ops/redis-cache-next.md`.
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

- `npm run seed:admin` (default full bootstrap; same as `npm run seed:admin:full`)
- `npm run seed:admin:db` (DB-only onboarding: skips post-seed xAI hello/RAG verify network checks by default)

What it does:

- upserts admin + tenant bootstrap; sets **`core_users.subscriptionPlan`** to **`basic`** for `ADMIN_SEED_EMAIL` (each run normalizes that row)
- inserts an approved bootstrap **`admin_access_requests`** row with **`requestedPlan: basic`** when none exists for that user + `global_admin`
- runs xPersona sync from `atx-docs/rag-collection/xpersonas` (legacy `atx-rag-collection/xpersonas` still supported) unless `SKIP_SEED_XPERSONAS=1`; default global-admin persona is **Advisor** (`nameNormalized` **`advisor`**, canonical spec `advisor/advisor.yaml` in that tree; legacy DBs may still have **`super-agent`**)
- does **not** upload finance-ref / example-prompts / segment files to xAI team collections or create team KB folders — disk trees are **Mongo-only** (xPersonas, options strategy). Populate xAI collections separately if your deployment needs `file_search` grounding.
- skips xAI seeded RAG collection verification after seed (nothing uploaded). Run `npm run verify:xai-seed-rag` only after team KB exists; override with `SKIP_XAI_POST_SEED_RAG_VERIFY=1` to skip that script when invoked manually.
- runs xAI hello verification unless `SKIP_XAI_POST_SEED_VERIFY=1`

`seed:admin:db` keeps Mongo onboarding behavior (admin user, approved access request, default account/watchlist, xPersona load, Advisor assignment) and forces:

- `SKIP_XAI_POST_SEED_RAG_VERIFY=1`
- `SKIP_XAI_POST_SEED_VERIFY=1`

## 4) Run persona / strategy disk sync explicitly (optional)

Use these when you need targeted re-sync without full bootstrap:

- xPersonas only: `npm run seed:xpersonas`
- options strategy preferences: `npm run seed:options-strategy-prefs`
- xAI team KB verification (after KB exists in xAI): `npm run verify:xai-seed-rag`

Team KB upload (if you maintain it): `scripts/lib/seed-xai-rag-ingest.mjs` (`runSeedXaiRagIngest`) can be called from a **custom** script — not from `seed:admin`. Source trees: `atx-docs/rag-collection/*` (legacy `atx-rag-collection/*` still resolved in that library).

## 5) Smoke checks

- Backend health: `http://localhost:8080/actuator/health`
- App health: `http://localhost:3000/api/health`

## 6) Shell theme preference (QA)

The product header, Hub top bar, and xChat guest header include a **moon** control with **Light** / **Dark** / **System**. xFinance stays **dark-only**: Light = softer charcoal surfaces, Dark = default deep black, System = maps `prefers-color-scheme` to soft vs deep.

- **Persistence:** `localStorage` key `xf-ui-theme` (`light` \| `dark` \| `system`).
- **DOM:** `html[data-xf-ui]` is `soft` or `deep`; boot script in `src/app/layout.tsx` runs before paint.
- **Code:** `src/lib/xf-ui-theme.ts`, `src/app/ui/public-theme-picker.tsx`, `.cursor/agents/branding.md`.

## 7) PWA install prompt (QA)

- Manifest: `public/manifest.webmanifest` with standalone display and PWA icons.
- Service worker: `public/sw.js` (registered by `src/app/ui/pwa-bootstrap-client.tsx` in root layout).
- Account rail manual trigger: **Account -> Install App** (`src/app/ui/pwa-install-account-prompt.tsx`).
- iOS fallback: manual **Add to Home Screen** steps appear in-app when native install prompt is unavailable.
- Local persistence keys:
  - `xf_pwa_install_dismissed_v1`
  - `xf_pwa_install_installed_v1`

## Deep links

- Bootstrap and operator runbook: [AGENTS.md](../../AGENTS.md)
- Seed script behavior: [scripts/seed-admin-user.mjs](../../scripts/seed-admin-user.mjs)
- RAG source tree rules: [atx-docs/rag-collection/README.md](../rag-collection/README.md)
- Auth/login troubleshooting: [auth-and-access.md](./auth-and-access.md)
