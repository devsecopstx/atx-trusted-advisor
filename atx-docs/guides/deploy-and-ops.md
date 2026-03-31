# Deploy and Ops Guide

This is the deploy/ops entrypoint for staging and production workflows.

## Deep-dive docs

- `AGENTS.md` (post-deploy validation and operator checks)
- `atx-docs/sre-ops/gcp-secrets-export-diff.md` (prod diff/export vs local `.env.prod` — no raw secrets in logs)
- `atx-docs/sre-ops/secret-rotation.md` (key/secret lifecycle runbook)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth cutover/rollback considerations)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (BFF migration impact on deploy posture)
- `.cursor/agents/sre.md` (manual deploy, Stripe/Google hotfixes, release notes on version bump)

## Promotion model

- **CI** runs on pushes to `main` and on pull requests (lint, typecheck, tests, docs links) — it does **not** deploy Cloud Run.
- **Staging** Cloud Run: manual **`workflow_dispatch`** via GitHub Actions **Deploy Cloud Run**, target **`staging`**, with required confirmation + environment protection as configured.
- **Production** Cloud Run: manual **`workflow_dispatch`** via **Deploy Cloud Run Production** (separate workflow).
- Health checks and rollback paths apply after every deploy; see **Rollback options** below.

**Local bypass (no GitHub Actions):** from repo root, with `gcloud` auth and `.env.stage` / `.env.prod` containing project, region, service name, and public base URL — `bash scripts/ops/deploy-cloud-run-from-env.sh --staging` (or `npm run ops:deploy:cloud-run:staging`). See `.cursor/rules/sre-gcp-deployment.md` § *Local deploy to Cloud Run*.

## Runtime secret model

Single source of truth for runtime app secrets is **GCP Secret Manager** in the project that matches your `.env.stage` / `.env.prod` **`GOOGLE_PROJECT_ID`** (or `GCP_PROJECT_ID`).

**Canonical secret ids** (names, required vs optional): `scripts/ops/gcp-runtime-secrets.inc.sh` — keep deploy workflows, `verify-gcp-runtime-secrets.sh`, and this guide aligned when adding a new mounted secret.

### Verify scripts vs local `.env` files

Commands like **`npm run ops:secrets:verify:staging`** / **`ops:secrets:verify:prod`** call **`gcloud secrets describe`** (and optionally read latest versions for non-empty checks). They **do not** load `.env.stage` or `.env.prod`.

If verify reports **`missing: GOOGLE_CLIENT_ID`** (or similar) but the variable is set locally, the value still has to exist **in Secret Manager** for that project. Push with the **`ops:secrets:sync-*`** npm scripts below (from a machine with `gcloud` auth to the target project), then re-run verify. See **`.cursor/agents/sre.md`** § *Google OAuth* and *Hotfix: missing GOOGLE_CLIENT_ID*.

**Compare local file to GCP (fingerprints only):** `npm run ops:secrets:diff:prod` and `npm run ops:secrets:diff:prod:optional` — see `atx-docs/sre-ops/gcp-secrets-export-diff.md` (`--include-optional` also compares optional keys such as **`STRIPE_SECRET_KEY`** and **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** when those secrets exist in GCP).

To push **`REDIS_URL`** from a local file (e.g. `.env.stage` / `.env.prod` with `REDIS_URL` + `GOOGLE_PROJECT_ID` or `GCP_PROJECT_ID`):

```bash
npm run ops:secrets:sync-redis:staging
npm run ops:secrets:sync-redis:prod
# or: bash scripts/ops/sync-redis-url-secret.sh path/to.env
```

To push **Stripe publishable** keys into the same project’s Secret Manager (from `.env.stage` / `.env.prod`):

```bash
npm run ops:secrets:sync-stripe-publishable:staging
npm run ops:secrets:sync-stripe-publishable:prod
# or: bash scripts/ops/sync-stripe-publishable-secrets-from-env.sh .env.prod
```

To push **Sign in with Google** OAuth client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`):

```bash
npm run ops:secrets:sync-google-oauth:staging
npm run ops:secrets:sync-google-oauth:prod
# or: bash scripts/ops/sync-google-oauth-secrets-from-env.sh .env.prod
```

**Staging** treats both Google secrets as required: `npm run ops:secrets:verify:staging` passes **`--with-google-oauth`**, and the **Deploy Cloud Run** workflow’s preflight for **`target=staging`** checks that both secrets exist. Production verify (`ops:secrets:verify:prod`) does **not** require them; production deploy still binds them when **both** exist in the project (same pattern as optional **`STRIPE_SECRET_KEY`** for Stripe Checkout).

**Optional (when feature enabled):**

- **`STRIPE_SECRET_KEY`** — Stripe Checkout server secret; deploy workflows bind it if the secret exists in the GCP project. Not required for `ops:secrets:verify:*`.

Required runtime secrets (core list — always expected in Secret Manager for deploy preflight):

- `MONGODB_URI_B64` (mapped to env `MONGODB_URI`)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `SLACK_WEBHOOK_URL`
- `ADMIN_SEED_EMAIL`
- `REDIS_URL` — Next.js Redis; see `atx-docs/sre-ops/redis-cache-next.md`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe `pk_…` (mounted at runtime)
- `STRIPE_PUBLIC_KEY` — alias for the same publishable key (often duplicate value)

**Staging additionally (Sign in with Google):**

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

GitHub environment secrets should remain OIDC-only:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

## Deploy preflight

Recommended checks before merge/deploy:

1. `npm run ci:gate`
2. `NODE_ENV=production npm run build` (matches CI / release gate; plain `npm run build` is fine for a quick compile check)
3. `npm run ops:secrets:verify:staging` (includes Google OAuth for staging)
4. `npm run ops:secrets:verify:prod`

### npm scripts quick reference (ops)

| Script | Purpose |
|--------|--------|
| `ops:secrets:verify:staging` | GCP Secret Manager preflight for **staging** project (includes **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**) |
| `ops:secrets:verify:prod` | GCP preflight for **production** — core secrets only; log shows `with_google_oauth=false` |
| `ops:secrets:verify:prod:with-google-oauth` | Same as prod + requires Google secrets in SM (use when Sign-in with Google is enabled in prod) |
| `ops:secrets:sync-google-oauth:staging` / `:prod` | Create/update Google OAuth secrets from `.env.stage` / `.env.prod` |
| `ops:secrets:sync-stripe-publishable:*` | Stripe publishable keys → SM |
| `ops:secrets:sync-redis:*` | `REDIS_URL` → SM |
| `ops:secrets:sync-mongodb:*` | `MONGODB_URI` → `MONGODB_URI_B64` secret |
| `ops:deploy:cloud-run:staging` | Local deploy from `.env.stage` (`deploy-cloud-run-from-env.sh`) |
| `ops:deploy:cloud-run:production` | Local deploy from `.env.prod` |
| `status:deploy` | Latest Actions / URLs summary (`print-deploy-status.sh`) |

## Rollback options

- Preferred: `Rollback Cloud Run` workflow with target + revision
- Fallback: `gcloud run services update-traffic` to known good revision

Always re-run health checks after traffic shift.

## OAuth production checklist

Before production callback/login changes:

- **X (Twitter):** callback URL matches **`{PROD_BASE_URL}/api/auth/x/callback`** (see `atx-docs/sre-ops/x-oauth-atx-callbacks.md`).
- **Google Sign-In:** in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client, add authorized **redirect URI** **`{PROD_BASE_URL}/api/auth/google/callback`** (and the same for staging host when testing staging). Runtime uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Secret Manager (`src/app/api/auth/google/*/route.ts`).
- verify OAuth-related secrets exist in Secret Manager for the target project and Cloud Run mounts the expected secret refs (`--set-secrets` in workflows / `deploy-cloud-run-from-env.sh`).

## Cloud agent / Atlas mode

For cloud agents:

- do not start local Docker Mongo
- use Atlas `MONGODB_URI` in environment
- run `npm ci`, then validation gates

## Operator status shortcuts

- `npm run status:deploy` for latest stage/prod summary
- `gh run list --workflow "CI" --limit 1`
- `gh run list --workflow "Deploy Cloud Run" --limit 1`
- `gh run list --workflow "Deploy Cloud Run Production" --limit 1`

For incident triage that starts as auth failures or app_user-only errors, use `atx-docs/guides/auth-and-access.md`.
