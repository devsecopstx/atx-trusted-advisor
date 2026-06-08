# Deploy and Ops Guide

This is the deploy/ops entrypoint for staging and production workflows.

## Deep-dive docs

- `AGENTS.md` (post-deploy validation and operator checks)
- `atx-docs/sre-ops/gcp-secrets-export-diff.md` (prod diff/export vs local `.env.prod` — no raw secrets in logs)
- `atx-docs/sre-ops/secret-rotation.md` (key/secret lifecycle runbook)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth cutover/rollback considerations)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (BFF migration impact on deploy posture)
- `atx-docs/sre-ops/gcp-prod-two-service-model.md` (**prod** Next `fintech-advisor-prod` + Spring `atxfinance-backend-prod`, GCP project `fintech-advisor-prod`, domain mapping, **recommended Cloud Run CPU/memory/concurrency/min/max + `--cpu-boost`**)
- `atx-docs/sre-ops/k8s-deploy.md` (**future GKE scale-out** — Kustomize stubs in `deploy/k8s/`, not wired to CI today)
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

Commands like **`npm run ops:secrets:verify:staging`** / **`ops:secrets:verify:prod`** call **`gcloud secrets describe`** (and optionally read latest versions for non-empty checks). They **do not** use local `.env` files for **Secret Manager** checks — having `GOOGLE_CLIENT_ID` only in `.env.stage` does **not** satisfy verify until that secret exists in GCP.

With **`--require-backend-origin`** (default on staging/prod verify npm scripts), the script **does** auto-load **`ATXFINANCE_BACKEND_ORIGIN`** from **`.env.stage`** / **`.env.prod`** at repo root when unset in the shell, then falls back to **`gcloud run services describe`** on the Spring service (`atxfinance-backend-staging` / `atxfinance-backend-prod`).

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

**Desk SMTP / which service needs secrets:** Portfolio desk **`email`** channels and price-alert email paths use **`src/lib/desk-smtp.ts`** on **Next** (`SMTP_*`, **`DESK_EMAIL_FROM`**). **Admin `/api/admin/delivery-channels*`** (including **`POST …/{id}/test`**) is **BFF-proxied to Spring** when `shouldProxyAdminDeliveryChannelsToBackend()` is true (same gate as other admin BFF routes) — mount desk-SMTP + optional **`DESK_DELIVERY_CHANNEL_TEST_*`** on the **Spring** Cloud Run service for that traffic; keep Next SMTP secrets for portfolio/alert paths that still execute on Next. When the gate is off (local `next dev` + loopback origin), **Send test** and tenant channel CRUD stay on Next and use Next’s desk-smtp. The JVM implements **`AdminDeliveryChannelsService`** + **`DeskSmtpSender`** for proxied requests.

**Delivery-channel email test (env-only):** Optional **`DESK_DELIVERY_CHANNEL_TEST_TO`** (valid email) makes admin **Send test** for **email** channels send to that address instead of the channel’s stored `emailTo`. Optional **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`** overrides the test subject (max 200 chars). Configure these on the service that handles the request: **Spring** when the admin BFF gate proxies delivery-channels; **Next** on the local / gate-off path. Scheduled/task delivery still uses each channel row as stored.

### Production checklist — access approval & transactional email (Next)

Use this before announcing onboarding or approving first external users.

| Step | Action |
|------|--------|
| **`PUBLIC_APP_BASE_URL`** | Set on **Next** Cloud Run to the **browser** HTTPS origin (no trailing slash), e.g. `https://fintech-advisor.ai`. **`deploy-cloud-run-from-env.sh`** forwards **`PUBLIC_APP_BASE_URL`** from **`.env.prod`** (defaults to **`PROD_BASE_URL`** when unset). GitHub **Deploy Cloud Run** sets **`PUBLIC_APP_BASE_URL`** from the workflow base URL. |
| **Desk SMTP** | **`SMTP_HOST`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`DESK_EMAIL_FROM`** (+ optional **`SMTP_PORT`**) must reach **`getDeskSmtpConfig()`** on Next (`src/lib/desk-smtp.ts`). Either sync **Secret Manager** (`ops:secrets:sync-desk-smtp:prod`) **or** pass literals via **`deploy-cloud-run-from-env.sh`** when all four are in **`.env.prod`**. Do **not** leave Cloud Run with **secret-backed** SMTP keys and then deploy **literal** values for the same names — remove GSM bindings first (the script removes SMTP secret refs when switching to env-file literals). |
| **Runtime (app ≥3.8.10)** | **`resolvePublicAppOrigin`** rejects **`0.0.0.0`**, **`[::]`**, and loopback so server-side request URLs cannot appear in invite/reset bodies. Optional **`ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY`** sends only the “sign in at `/login`” approval mail (OAuth / forgot-password path). If **Spring** sends credential invites, set **`PUBLIC_APP_BASE_URL`** on the JVM service too (**`CredentialInviteService`** rejects invalid bases). |
| **Smoke** | **`GET /api/health`** → **`version`** matches shipped semver; optional Admin → **Delivery channels** → **Send test** for the SMTP path. |

Cross-reference: **`atx-docs/guides/auth-and-access.md`**, **`src/lib/public-app-origin.ts`**, **`src/lib/send-email-credential-messages.ts`**.

**Every production deploy (≤1 minute):** `curl -sS "https://<your-domain>/api/health"` → **`status":"ok"`** and **`version`** matches root **`package.json`** on that revision. If you changed **Next** Cloud Run env vars, confirm **`PUBLIC_APP_BASE_URL`** and desk SMTP (**§ Production checklist** above) — mixing GSM secret bindings with literal **`SMTP_*`** for the same keys still fails until secret refs are removed (see **`deploy-cloud-run-from-env.sh`**).

**Staging** treats both Google secrets as required: `npm run ops:secrets:verify:staging` passes **`--with-google-oauth`**, and the **Deploy Cloud Run** workflow’s preflight for **`target=staging`** checks that both secrets exist. Production verify (`ops:secrets:verify:prod`) does **not** require them; production deploy still binds them when **both** exist in the project.

**Optional (prod until Sign-in with Google is enabled):**

- **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** — compared with `ops:secrets:diff:prod:optional`; not in default prod verify.

**Optional (portfolio desk email):**

- **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`DESK_EMAIL_FROM`** — list in `scripts/ops/gcp-runtime-secrets.inc.sh` (`GCP_RUNTIME_SECRETS_DESK_SMTP`). Default verify does **not** require them; use `--with-desk-smtp` or the `*:with-desk-smtp` npm scripts when you expect desk email in that project.

Required runtime secrets (core list — always expected in Secret Manager for deploy preflight and `ops:secrets:verify:*`):

- `MONGODB_URI_B64` (mapped to env `MONGODB_URI`)
- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY`
- `XAI_FINANCE_COLLECTION_ID` — canonical shared Finance KB id for xChat RAG (`collection_*`; sync from `.env.stage` / `.env.prod` via **`ops:secrets:sync-xai-finance-collection:*`**)
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `SLACK_WEBHOOK_URL`
- `ADMIN_SEED_EMAIL`
- `REDIS_URL` — Next.js Redis; see `atx-docs/sre-ops/redis-cache-next.md`
- Optional cache TTLs (cache plane when `REDIS_URL_CACHE` / `REDIS_URL` is set): `REDIS_OUTLOOK_CONTEXT_TTL_SECONDS` (xChat desk outlook context, default **120**), `REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS`, `REDIS_RAG_LEXICAL_CACHE_TTL_SECONDS` — see `.env.example` and `atx-docs/sre-ops/redis-cache-next.md`
- **xChat vision paste (optional hardening):** `XAI_VISION_MODEL` (image-turn model override), `VISION_MAX_DIMENSION` (default **1920**; longest edge after server resize), `VISION_VIRUS_SCAN_ENABLED` (`true` enables **ClamAV** `clamscan` on processed bytes — requires ClamAV on the image or sidecar), `VISION_CLAMSCAN_BIN` (override binary, default `clamscan`). See **`atx-docs/xchat/xchat-vision-paste.md`**.
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

- `ATXFINANCE_BACKEND_ORIGIN` — **required** for both `staging` and `production` GitHub/CLI deploy preflight (backend HTTPS origin; no `:8080` on public hostnames; must not equal the Next public `BASE_URL`). **Runtime:** on Cloud Run, when `NODE_ENV=production` and `ATX_DEPLOY_TARGET` is `stage` or `deploy`, Next **fails startup** if this var is unset (`src/instrumentation.ts` → `assertHostedCloudRunRequiresAtxfinanceBackendOrigin`). **Break-glass:** `ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1` on the revision only. See **[`spring-read-plane-and-mongo-exit.md`](../sre-ops/spring-read-plane-and-mongo-exit.md)**.

## Deploy preflight

Recommended checks before merge/deploy:

1. `npm run ci:gate`
2. `NODE_ENV=production npm run build` (matches CI / release gate; plain `npm run build` is fine for a quick compile check)
3. `npm run ops:secrets:verify:staging` (includes Google OAuth for staging)
4. `npm run ops:secrets:verify:prod`
5. After portfolio/BFF releases: optional **multi-account staging soak** (portfolio, watchlist, admin tasks, audit) — **[`staging-hnwi-soak-checklist.md`](../sre-ops/staging-hnwi-soak-checklist.md)**.

`ops:secrets:verify:staging` / `ops:secrets:verify:prod` use **`--require-backend-origin`**: resolve `ATXFINANCE_BACKEND_ORIGIN` from the shell, repo **`.env.stage`** / **`.env.prod`**, or the live Spring Cloud Run URL via `gcloud`, then validate HTTPS format. **`ops:secrets:verify:prod`** also passes **`--with-scheduler-delegate`** (both `ATX_SCHEDULER_*` GSM secrets + internal secret length ≥24).

### npm scripts quick reference (ops)

| Script | Purpose |
|--------|--------|
| `ops:secrets:verify:staging` | GCP Secret Manager preflight for **staging** project (includes **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**) |
| `ops:secrets:verify:prod` | GCP preflight for **production** — core secrets + **`--with-scheduler-delegate`** + backend origin resolve; log shows `with_google_oauth=false` |
| `ops:secrets:verify:prod:with-google-oauth` | Same as prod + requires Google secrets in SM (use when Sign-in with Google is enabled in prod) |
| `ops:secrets:sync-scheduler-delegate:staging` / `:prod` | `ATX_SCHEDULER_INTERNAL_SECRET` + `ATX_SCHEDULER_NEXT_BASE_URL` → SM (from `.env.stage` / `.env.prod`) |
| `ops:secrets:sync-google-oauth:staging` / `:prod` | Create/update Google OAuth secrets from `.env.stage` / `.env.prod` |
| `ops:secrets:sync-stripe-publishable:*` | Stripe publishable keys → SM |
| `ops:secrets:sync-stripe-webhook:*` | `STRIPE_WEBHOOK_SECRET` → SM |
| `ops:secrets:sync-redis:*` | `REDIS_URL` → SM |
| `ops:secrets:sync-mongodb:*` | `MONGODB_URI` → `MONGODB_URI_B64` secret |
| `ops:secrets:sync-xai-finance-collection:staging` / `:prod` | `XAI_FINANCE_COLLECTION_ID` → SM |
| `ops:migrate:xchat-personas-finance-collection` | Dry-run / `--execute` Mongo patch for legacy persona collection links |
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

## Cloud Run — “container failed to start and listen on PORT=8080”

Deploy creates a new revision, then Cloud Run waits for the process to **bind to `PORT`** (default **8080**) within the startup period. If deploy fails with this error:

1. **Read revision logs** (replace revision name from the error):  
   `gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.revision_name=REVISION' --project=YOUR_PROJECT --limit=80 --format='table(timestamp,textPayload)'`
2. **Logs like “STARTUP TCP probe failed” + “Container called exit(0)” ~1s apart:** The process often **had not opened port 8080 yet** (Next.js cold start), Cloud Run **stopped** the revision, and **exit(0)** is typically **SIGTERM**, not a clean voluntary shutdown. Fix: **`--cpu-boost`** (startup extra CPU), **`--memory=1Gi`** for Next, and explicit **`--port=8080`** — **`deploy-cloud-run-from-env.sh`** and the **Deploy Cloud Run** workflows now pass these by default.
3. **Other causes:** **OOM**, **`getEnv()` / Zod** throwing because a **mounted secret is missing or empty** (compare Secret Manager + `--set-secrets` bindings to `scripts/ops/gcp-runtime-secrets.inc.sh`).
4. **App-side guard:** `src/instrumentation.ts` runs Redis startup logging **without blocking** `register()`, so Redis connectivity does not delay binding to `PORT`.

**Already deployed without these flags?** One-shot:

`gcloud run services update SERVICE_NAME --region=REGION --project=PROJECT --cpu-boost --memory=1Gi --port=8080 --quiet`

Then redeploy a new revision or traffic-pinned rollback.

See also **`atx-docs/sre-ops/gcp-prod-two-service-model.md`** (recommended CPU/memory/concurrency and **`--cpu-boost`**).
