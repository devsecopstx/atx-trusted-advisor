# Deploy and Ops Guide

This is the deploy/ops entrypoint for staging and production workflows.

## Deep-dive docs

- `AGENTS.md` (post-deploy validation and operator checks)
- `atx-docs/sre-ops/gcp-secrets-export-diff.md` (prod diff/export vs local `.env.prod` — no raw secrets in logs)
- `atx-docs/sre-ops/secret-rotation.md` (key/secret lifecycle runbook)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth cutover/rollback considerations)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (BFF migration impact on deploy posture)
- `atx-docs/sre-ops/gcp-prod-two-service-model.md` (**prod** Next `xfinance-core-prod` + Spring `atxfinance-backend-prod`, GitHub vars, domain, retire duplicate services, **recommended Cloud Run CPU/memory/concurrency/min/max + `--cpu-boost`**)
- `.cursor/agents/sre.md` (manual deploy, Stripe/Google hotfixes, release notes on version bump)

## Promotion model

- **CI** runs on pushes to `main` and on pull requests (lint, typecheck, tests, docs links) — it does **not** deploy Cloud Run.
- **Staging** Cloud Run: manual **`workflow_dispatch`** via GitHub Actions **Deploy Cloud Run**, target **`staging`**, with required confirmation + environment protection as configured.
- **Production** Cloud Run: manual **`workflow_dispatch`** via **Deploy Cloud Run Production** (separate workflow).
- Health checks and rollback paths apply after every deploy; see **Rollback options** below.

**GCP CLI deploy (canonical if you skip GitHub):** from repo root, with `gcloud` auth and **`.env.stage`** / **`.env.prod`** (project, region, **`CLOUD_RUN_SERVICE_*`**, **`STAGING_BASE_URL`** / **`PROD_BASE_URL`**, **`ATXFINANCE_BACKEND_ORIGIN`** = Spring `https://…run.app`) — **`npm run ops:deploy:cloud-run:staging`** / **`npm run ops:deploy:cloud-run:production`** (`scripts/ops/deploy-cloud-run-from-env.sh`). Optional **`--with-ci-gate`** variants. See **`atx-docs/sre-ops/gcp-prod-two-service-model.md`** and `.cursor/rules/sre-gcp-deployment.md` § *Local deploy to Cloud Run*.

**Full stack (backend + Next) from CLI:** **`npm run ops:deploy:full:staging`** / **`npm run ops:deploy:full:production`** runs, in order: (1) **`deploy-atxfinance-backend-*.sh`** (Spring image → Cloud Run), (2) writes **`ATXFINANCE_BACKEND_ORIGIN`** in **`.env.stage`** / **`.env.prod`** to the backend’s current **`status.url`**, (3) **`deploy-cloud-run-from-env.sh`** for the Next service. Use when both services should ship from one checkout and the BFF origin must match the new backend URL. **Release-note discipline:** tag **Next** vs **Spring** vs **Full** vs **Secrets** per **`atx-docs/sre-ops/release-notes.md`** § *Deploy targets* so ops can track what rolled.

## Runtime secret model

Single source of truth for runtime app secrets is **GCP Secret Manager** in the project that matches your `.env.stage` / `.env.prod` **`GOOGLE_PROJECT_ID`** (or `GCP_PROJECT_ID`).

**Canonical secret ids** (names, required vs optional): `scripts/ops/gcp-runtime-secrets.inc.sh` — keep deploy workflows, `verify-gcp-runtime-secrets.sh`, and this guide aligned when adding a new mounted secret.

### Verify scripts vs local `.env` files

Commands like **`npm run ops:secrets:verify:staging`** / **`ops:secrets:verify:prod`** call **`gcloud secrets describe`** (and optionally read latest versions for non-empty checks). They **do not** load `.env.stage` or `.env.prod`.

If verify reports **`missing: GOOGLE_CLIENT_ID`** (or similar) but the variable is set locally, the value still has to exist **in Secret Manager** for that project. Push with the **`ops:secrets:sync-*`** npm scripts below (from a machine with `gcloud` auth to the target project), then re-run verify. See **`.cursor/agents/sre.md`** § *Google OAuth* and *Hotfix: missing GOOGLE_CLIENT_ID*.

**Compare local file to GCP (fingerprints only):** `npm run ops:secrets:diff:prod` and `npm run ops:secrets:diff:prod:optional` — see `atx-docs/sre-ops/gcp-secrets-export-diff.md` (`--include-optional` also compares **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** when those secrets exist in GCP).

To push **`REDIS_URL`** from a local file (e.g. `.env.stage` / `.env.prod` with `REDIS_URL` + `GOOGLE_PROJECT_ID` or `GCP_PROJECT_ID`):

```bash
npm run ops:secrets:sync-redis:staging
npm run ops:secrets:sync-redis:prod
# or: bash scripts/ops/sync-redis-url-secret.sh path/to.env
```

To push **Stripe** keys into the same project’s Secret Manager (from `.env.stage` / `.env.prod`): **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**, **`STRIPE_PUBLIC_KEY`**, and (when set in the file) **`STRIPE_SECRET_KEY`** (`sk_…` — never commit).

```bash
npm run ops:secrets:sync-stripe-publishable:staging
npm run ops:secrets:sync-stripe-publishable:prod
# or: bash scripts/ops/sync-stripe-publishable-secrets-from-env.sh .env.prod
```

To push **Stripe webhook signing secret** (`STRIPE_WEBHOOK_SECRET`):

```bash
npm run ops:secrets:sync-stripe-webhook:staging
npm run ops:secrets:sync-stripe-webhook:prod
# or: bash scripts/ops/sync-stripe-webhook-secret-from-env.sh .env.prod
```

To push **Sign in with Google** OAuth client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`):

```bash
npm run ops:secrets:sync-google-oauth:staging
npm run ops:secrets:sync-google-oauth:prod
# or: bash scripts/ops/sync-google-oauth-secrets-from-env.sh .env.prod
```

To push **portfolio desk SMTP** credentials (ZenBusiness / hosted mailbox or any SMTP provider — separate from Stripe billing email):

- Secret Manager names: `SMTP_HOST`, `SMTP_PORT` (e.g. `587`), `SMTP_USER`, `SMTP_PASS`, `DESK_EMAIL_FROM` (verified `From:` address, often same as `SMTP_USER`).
- Per-recipient addresses live in admin **portfolio delivery channels** (`kind: email`), not in env.

```bash
npm run ops:secrets:sync-desk-smtp:staging
npm run ops:secrets:sync-desk-smtp:prod
# or: bash scripts/ops/sync-desk-smtp-secrets-from-env.sh .env.prod
```

After all five secrets exist, **Deploy Cloud Run** binds them automatically (same pattern as optional Google OAuth). Optional GitHub **variable** `SMTP_SECURE=true` when using SMTPS (e.g. port 465). Verify optionally: `npm run ops:secrets:verify:staging:with-desk-smtp` / `ops:secrets:verify:prod:with-desk-smtp` (adds `--with-desk-smtp` to the verify script). Compare local vs GCP: `npm run ops:secrets:diff:prod:desk-smtp`.

**Desk SMTP / which service needs secrets:** Portfolio desk **`email`** channels, price-alert email paths, and admin **`POST /api/admin/delivery-channels/{id}/test`** all use **`src/lib/desk-smtp.ts`** on the **Next.js** Cloud Run service (`SMTP_*`, **`DESK_EMAIL_FROM`**). Tenant **`/api/admin/delivery-channels*`** is **not** BFF-proxied to Spring (`shouldProxyAdminDeliveryChannelsToBackend` is always false — release **3.0.25**); mount desk-SMTP secrets on **Next** for `/admin/delivery-channels` **Send test** and portfolio notifications. The JVM still implements **`AdminDeliveryChannelsService`** + **`DeskSmtpSender`** for contract parity / direct backend callers, but the product UI does not hit that path via Next today.

**Delivery-channel email test (env-only):** Optional **`DESK_DELIVERY_CHANNEL_TEST_TO`** (valid email) makes admin **Send test** for **email** channels send to that address instead of the channel’s stored `emailTo`. Optional **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`** overrides the test subject (max 200 chars). These are read by **Next** only for the standard UI route. Scheduled/task delivery still uses each channel row as stored.

**Staging** treats both Google secrets as required: `npm run ops:secrets:verify:staging` passes **`--with-google-oauth`**, and the **Deploy Cloud Run** workflow’s preflight for **`target=staging`** checks that both secrets exist. Production verify (`ops:secrets:verify:prod`) does **not** require them; production deploy still binds them when **both** exist in the project.

**Optional (prod until Sign-in with Google is enabled):**

- **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** — compared with `ops:secrets:diff:prod:optional`; not in default prod verify.

**Optional (portfolio desk email):**

- **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`DESK_EMAIL_FROM`** — list in `scripts/ops/gcp-runtime-secrets.inc.sh` (`GCP_RUNTIME_SECRETS_DESK_SMTP`). Default verify does **not** require them; use `--with-desk-smtp` or the `*:with-desk-smtp` npm scripts when you expect desk email in that project.

Required runtime secrets (core list — always expected in Secret Manager for deploy preflight and `ops:secrets:verify:*`):

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
- `STRIPE_SECRET_KEY` — Stripe `sk_…` (server-only; Checkout)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret for `/api/webhooks/stripe`

**Staging additionally (Sign in with Google):**

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

GitHub environment secrets should remain OIDC-only:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

**GitHub environment variables (non-secret):**

- `ATXFINANCE_BACKEND_ORIGIN` — required for both `staging` and `production` deploy preflight. Must be backend HTTPS origin (no `:8080` on public hostnames).

## Deploy preflight

Recommended checks before merge/deploy:

1. `npm run ci:gate`
2. `NODE_ENV=production npm run build` (matches CI / release gate; plain `npm run build` is fine for a quick compile check)
3. `npm run ops:secrets:verify:staging` (includes Google OAuth for staging)
4. `npm run ops:secrets:verify:prod`

`ops:secrets:verify:*` now also validates that `ATXFINANCE_BACKEND_ORIGIN` is present in your shell environment when using the staging/prod helper scripts.

### npm scripts quick reference (ops)

| Script | Purpose |
|--------|--------|
| `ops:secrets:verify:staging` | GCP Secret Manager preflight for **staging** project (includes **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**) |
| `ops:secrets:verify:prod` | GCP preflight for **production** — core secrets only; log shows `with_google_oauth=false` |
| `ops:secrets:verify:prod:with-google-oauth` | Same as prod + requires Google secrets in SM (use when Sign-in with Google is enabled in prod) |
| `ops:secrets:sync-google-oauth:staging` / `:prod` | Create/update Google OAuth secrets from `.env.stage` / `.env.prod` |
| `ops:secrets:sync-stripe-publishable:*` | Stripe publishable keys → SM |
| `ops:secrets:sync-stripe-webhook:*` | `STRIPE_WEBHOOK_SECRET` → SM |
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

## App-store metadata compliance

For App Store / Play listing text, keep safety wording aligned with in-app metadata and footer:

- **Required phrase:** `Educational conversations only. Not personalized investment advice.`
- Ensure this appears in listing description/subtitle fields where policy copy is captured.

## Operator status shortcuts

- `npm run status:deploy` for latest stage/prod summary
- `gh run list --workflow "CI" --limit 1`
- `gh run list --workflow "Deploy Cloud Run" --limit 1`
- `gh run list --workflow "Deploy Cloud Run Production" --limit 1`

For incident triage that starts as auth failures or app_user-only errors, use `atx-docs/guides/auth-and-access.md`.
