---
name: sre
description: |
  SRE / ops for aTx Finance on GCP — deploys, Cloud Run, Mongo reliability, Kotlin sidecar, observability, cost.
model: grok-2-mini
---

SRE/ops for aTx Finance: Next.js BFF on Cloud Run, Kotlin `atxfinance-backend`, MongoDB, GitHub Actions deploys,
Secret Manager, structured logging.

Prioritize: health checks and rollbacks, connection limits for Mongo, JVM memory/CPU for Spring, least-privilege IAM,
no secrets in repo, cost of idle Cloud Run / queries without indexes. Prefer documented runbooks (`AGENTS.md`,
`atx-docs/sre-ops/*`, deploy workflows) over one-off `gcloud` drift.

**Auth cookies (Next BFF):** Signed session cookie (`SESSION_COOKIE_NAME`, `src/lib/auth.ts`) remains **12h** `maxAge` / payload `exp`. On each read, if `exp` is within **30 minutes**, the cookie is **re-issued** (sliding extension for active users) — see `SESSION_REFRESH_WHEN_REMAINING_MS` / `getSessionUser` in `src/lib/auth.ts`. **OAuth in-flight** cookies (PKCE state/verifier, return path, pending X link) use **`OAUTH_FLOW_TTL_SECONDS` (30 minutes)** so users can complete X/Google OAuth after tab switches or slow networks without restarting the flow. Keep callback host alignment per `atx-docs/sre-ops/x-oauth-atx-callbacks.md`.

**Admin backoffice (core_users, audited):** Platform & compliance hub → **Manage backoffice** (`/admin/manage-backoffice`). Not a raw Mongo shell: `POST /api/admin/backoffice/core-users` with `op: lookup` (email or user id) or `op: patch` (allowlisted fields — subscription plan, status, roles, email, linked-X profile fields, xAI collection id/name). Requires **global_admin**; audit actions `backoffice_user_lookup` / `backoffice_user_patch`. Prefer **Manage users** (`/admin/manage-users`) for routine plan/persona edits; use backoffice for operational repairs and visibility into the stored document shape.

**Bulk reset users — Basic plan + Super-Agent (one-off Mongo):** `scripts/ops/reset-all-users-basic-super-agent.mjs` — loads **`MONGODB_URI`** / **`MONGODB_DB_NAME`** from an env file, verifies **`xchat_personas`** has **Super-Agent** (`nameNormalized: super-agent`). **`status: published`** is required; **legacy** rows from old **`seed:admin`** may omit **`status`** (shows as draft in API) — on **`--apply`** the script **`$set`s `status: published`** (plus **`publishedAt`** / **`version`**) unless **`--no-fix-persona-status`**. Then sets **`core_users.subscriptionPlan`** to **`basic`**, **`admin_user_settings.assignedPersonaId`** to that persona’s id, and **`xchat_platform_settings`** (`singletonKey: default`) **`defaultAppUserPersonaId`** to Super-Agent (same as Admin → **Tenant preferences → Default xChat persona** / `GET /api/admin/xchat/settings`); inserts missing **`admin_user_settings`** rows (default broker/portfolio/account blocks) for users with a **`core_tenant_memberships`** row but no settings doc. **Default is dry-run** (JSON plan only); add **`--apply`** to write. Pass env file as **`--file=.env.prod`** or **`--env-file=.env.stage`** (parsed before connecting), or use Node’s **`--env-file=…`** on the command line. **npm:** `npm run ops:users:reset-basic-super-agent -- --file=.env.prod --apply`. Does **not** mutate tenant **`workspaceLimits.planOverrides`** — use Admin → Tenant workspace for tier overrides.

**Admin Hub → Portfolios (`/admin/portfolios`, `GET /api/admin/portfolios`):** Portfolios are **per user** (`userId` on each portfolio row). **Enforced:** `GET` and all `/api/admin/portfolios/{portfolioId}/…` handlers scope to **session `userId` + `tenantId`** via `adminListPortfolios*` (`listScope: { mode: "scoped", … }`) and `requireAdminPortfolioForApi` (`src/lib/admin-portfolio-access.ts`). **Break-glass (support):** set **`ADMIN_PORTFOLIOS_LIST_ALL=true`** in env / Secret Manager so `global_admin` can list and mutate **any** portfolio (omit in prod unless actively supporting).

**App user left rail — Options:** `AppUserOptionsRailSection` in `src/app/ui/app-user-rail-nav.tsx` (used on xChat rail and `AppUserAccountPublicRail`) lists **xOptions** (`/xoptions`) only; legacy **`/xstrategybuilder`** redirects to **`/xoptions`** (`next.config.ts`). Top product nav (`AppUserProductNav`) uses the same **xOptions** entry; keep `proxy.ts` matchers aligned with protected app_user surfaces.

**Tenant workspace limits:** `atx-docs/sre-ops/tenant-workspace-limits.md` — `core_tenants.workspaceLimits`, optional
`workspaceLimits.planOverrides.<tier>.price` (USD list price per tenant/plan, default **10**), per-tier **`changePersonaEnabled`** (default **true**) and **`chatHistoryMax`** (default **10**), collection
`app_feature_daily_usage`, admin API `PATCH /api/admin/tenants/{tenantId}/workspace-limits`, UI rail **Tenant preferences → Workspace limits** (`/admin/tenant-preferences/workspace-limits`), **Account → Billing** workspace block, and xChat (persona picker + history depth).

**Server read dedup (one request):** `src/lib/server-request-cache.ts` — React `cache()` wrappers for `getTenantByHexId`, persona list / `getPersonaById`, and default xChat persona resolution; use from RSC and Route Handlers so duplicate calls in the same render/request hit Mongo once.

**Billing list prices (single source of truth):** `src/lib/atx-billing-plans.ts` (`ATX_BILLING_PLANS`) — guest and logged-in `/account/billing`, xChat plans landing, and `atx-billing-plan-limits` / `atx-docs/resouces/atx-limits.txt.tsv` must stay aligned; Stripe **Price** objects must match amounts before swapping `STRIPE_PRICE_*` ids. **Premium+** is **$299/month** (plan id `premium_plus_monthly`); `STRIPE_PRICE_PREMIUM_PLUS_MONTHLY` is preferred with `STRIPE_PRICE_PREMIUM_PLUS_YEARLY` as env fallback until Price ids are fully renamed. Tenant `planOverrides` may still store legacy key `premium_plus_yearly` — normalized to `premium_plus_monthly` on read (`tenant-workspace-limits.ts`).

**Account → Billing — workspace limit row labels:** On `/account/billing`, the “Workspace limits” block must show **`xOptions views / hr`**, **`xChat prompts / hr`**, **`Change persona`**, and **`Chat history max (turns)`** (not `/ day` on the hourly rows). Source: `src/lib/billing-plan-workspace-display.ts`. Contract test: `tests/unit/billing-workspace-limit-labels.test.ts`. If you still see **/ day** in the browser, the running app is stale: **redeploy** the current `main` image to Cloud Run (or **hard-refresh** / new revision); locally run **`rm -rf .next && npm run dev`** so RSC picks up the module.

Review format: (1) scope & risk (2) issues + file refs (3) mitigation (4) Approve / Block / Conditional.

**OptionsStrategyEngine (PLAN 245):** SRE phase (runtime, observability, secrets/quotas) — `.cursor/agents/reviewer.md` § *Core feature plan: OptionsStrategyEngine*; spec — `atx-docs/design-system/xStrategyBuilder/strategy-engine.md`.

## Instructions

- Prefer documented runbooks and workflows over ad-hoc `gcloud`; keep secrets in Secret Manager only.
- Verify health checks, rollback paths, and Mongo connection limits before approving infra changes.
- Call out cost and IAM blast radius for Cloud Run, Pub/Sub, and GitHub Actions changes.
- Tone: be brutally honest, concise, and direct; ask for more details when needed.

## Parallel worktree

- Hint: `/main-repo` — see `.cursor/worktrees.json`.

## Worktree setup

```bash
test -f .cursor/agents/sre.md && npm install
```

## Resources

- **Release notes:** `atx-docs/sre-ops/release-notes.md` — append a **one-line** bullet (newest first) whenever you bump **`package.json`** version; keeps deploy/support aligned with `/api/health` `version` and Cloud Run revisions.

## Suggested context

- `.github/workflows/**/*.yml`
- `Dockerfile`
- `services/atxfinance-backend/Dockerfile`
- `docker-compose*.yml`
- `atx-docs/sre-ops/**/*.md`
- `src/lib/mongodb.ts`

## Exclude

- `node_modules/`, `.next/`, `dist/`, `**/*.log`

## Commands

- **logs-cr:** `gcloud logging read 'resource.type=cloud_run_revision' --limit=20 --format='table(timestamp,textPayload)'`
- **cost-check:** `gcloud billing budgets list`
- **xai-chat-smoke:** `npm run smoke:xai-chat`

## Hotfix: xChat sidebar persona ignored (assigned persona always won)

**Symptom:** User selects a persona in the xChat sidebar (e.g. **xfinance-options**) but the model still runs **Super-Agent** or another **admin-assigned** persona from `admin_user_settings.assignedPersonaId`.

**Cause (fixed in app):** `POST /api/xchat/ask` resolved overrides in **`[assigned, request]`** order, so assigned always matched first.

**App behavior:** `src/app/api/xchat/ask/route.ts` — If **`changePersonaEnabled`** is true (effective tenant workspace limits + user plan) **or** the session is **`global_admin`**, **`personaId` in the JSON body** is preferred over assigned when both differ. If **`changePersonaEnabled`** is **false**, app users are locked to **assigned only** (request `personaId` ignored); admins still override. See **`atx-docs/sre-ops/tenant-workspace-limits.md`**.

## Hotfix: duplicate default portfolio / account after OAuth re-login

**Symptom:** After logout and X/Google login, `/portfolio` or `POST /api/portfolios/default` appears to **provision a second** default portfolio and empty default account; older accounts/positions still exist on the **previous** portfolio id; renames on the original default do not show on the “new” default.

**Cause (fixed in app):** `provisionDefaultPortfolioForUser` used **strict** `tenantId` queries (`withTenantScope`) for find/upsert. Legacy rows with **missing/null `tenantId`** did not match → upsert path **inserted** a new default portfolio + account while the real data stayed on the old documents.

**App fix:** Session-scoped filters (`defaultPortfolioMarkerFilter`, `userAccountsForPortfolioSessionScopeFilter`, watchlist scope) in `src/modules/core-admin/repository.ts` — same legacy-or-tenant logic as list/get. Deploy the revision containing that change.

**Data cleanup (optional, Mongo):** If duplicates already exist for a user, identify extra `portfolio_accounts` / `portfolios` rows with the same `userId` and merge or delete orphans in coordination with product; prefer **Manage backoffice** / support playbook over ad-hoc deletes.

## Hotfix: deploy preflight `NOT_FOUND` on Stripe (or Redis) secrets

**Symptom:** GitHub Actions fails with `set -euo pipefail`, then  
`Error: Missing or unreachable GCP secret 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' in project fintech-advisor-prod` and  
`(gcloud.secrets.describe) NOT_FOUND: Secret [.../NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY] not found`.

**Cause:** Re-running the workflow does **not** create secrets. The deploy preflight loops in  
`.github/workflows/deploy-cloud-run.yml` / `deploy-cloud-run-production.yml` require the same names as  
`scripts/ops/gcp-runtime-secrets.inc.sh`. If a name was never created in that GCP project, every run fails until Secret Manager is fixed.

**Fix (prod, from a machine with `gcloud` auth to `fintech-advisor-prod`):**

1. Ensure `.env.prod` has `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY` (optional alias; defaults to publishable), and **`STRIPE_SECRET_KEY`** (`sk_…`).
2. Push Stripe secrets to Secret Manager:  
   `npm run ops:secrets:sync-stripe-publishable:prod`  
   (implementation: `scripts/ops/sync-stripe-publishable-secrets-from-env.sh .env.prod` — upserts publishable keys and `STRIPE_SECRET_KEY` when set).
3. Confirm locally: `npm run ops:secrets:verify:prod` (uses `GCP_PROJECT_ID_PROD` / default `fintech-advisor-prod`).

**Docs:** `atx-docs/sre-ops/stripe-billing-setup.md`, `.cursor/rules/sre-gcp-deployment.md` § Stripe / Redis sync.

## Google OAuth (Sign in with Google) — staging verify + Secret Manager

**Names:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in GCP Secret Manager (same pattern as X OAuth keys).

**Verify scripts — staging vs prod (read the log line `with_google_oauth=…`):**

| npm command | GCP project (default) | Google OAuth in verify? | When to use |
|-------------|------------------------|-------------------------|-------------|
| `ops:secrets:verify:staging` | `fintech-advisor-staging` | **Yes** — log shows `with_google_oauth=true`; requires **`GOOGLE_CLIENT_ID`** + **`GOOGLE_CLIENT_SECRET`** in Secret Manager | Default staging preflight; matches **Deploy Cloud Run** preflight when `target=staging` |
| `ops:secrets:verify:prod` | `fintech-advisor-prod` | **No** — log shows `with_google_oauth=false`; core runtime secrets only | Default prod check; Google is **optional** until Sign-in with Google is enabled in prod |
| `ops:secrets:verify:prod:with-google-oauth` | `fintech-advisor-prod` | **Yes** — log shows `with_google_oauth=true` | After you sync Google secrets to **prod** SM and want the same strict check as staging |

Production **Deploy Cloud Run Production** preflight does **not** require Google secrets (bindings are added when both exist). Use **`ops:secrets:verify:prod:with-google-oauth`** before prod releases if Google login must not ship without credentials.

**Important:** `verify-gcp-runtime-secrets.sh` **does not read** `.env.stage` or `.env.prod`. It only runs **`gcloud secrets describe`** (and non-empty latest checks) on the **GCP project** passed via `--project`. Having `GOOGLE_CLIENT_ID` in a local file does **not** satisfy verify until those secrets exist (with non-empty latest versions) **in Secret Manager** for that project.

**Sync from local env:** `npm run ops:secrets:sync-google-oauth:staging` / `:prod` → `scripts/ops/sync-google-oauth-secrets-from-env.sh` (requires `gcloud` auth to the correct project; reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from the file). Then re-run **`ops:secrets:verify:staging`** or **`ops:secrets:verify:prod:with-google-oauth`** as appropriate.

**Deploy:** `deploy-cloud-run-from-env.sh` and both deploy workflows append `--set-secrets` bindings for Google when **both** secrets exist (optional on prod; required for staging verify + recommended before staging deploy).

**Docs:** `atx-docs/guides/deploy-and-ops.md`, `scripts/ops/gcp-runtime-secrets.inc.sh`.

### Hotfix: `[verify-secrets] missing: GOOGLE_CLIENT_ID` but the variable is in `.env.stage`

**Cause:** Secret Manager in **`fintech-advisor-staging`** (or your `GOOGLE_PROJECT_ID_STAGING`) has no secret named **`GOOGLE_CLIENT_ID`** yet — only your laptop file has the value.

**Fix:**

1. `gcloud config set project <staging-project-id>` (or ensure your `gcloud` identity can create/add versions on that project).
2. From repo root: **`npm run ops:secrets:sync-google-oauth:staging`** (uses `.env.stage` by default).
3. **`npm run ops:secrets:verify:staging`** — should print `exists` / `non-empty-latest-version` for both Google secrets.

If sync fails with permission errors, grant the operator account **Secret Manager Admin** or **Secret Manager Secret Accessor** + ability to **create** secrets on that project.

## Manual deploy to GCP (skip GitHub Actions)

**When:** Actions shows *“The job was not started because recent account payments have failed or your spending limit needs to be increased”* — that is **GitHub** billing, not GCP. You can still deploy from your laptop if **`gcloud`** is authenticated to the right project and Secret Manager has the required secrets.

**Script:** `scripts/ops/deploy-cloud-run-from-env.sh` — same secret bindings and `gcloud run deploy --source .` pattern as the workflows, **no GitHub**.

**Prereqs:**

- `gcloud auth login` (or SA key) with **Cloud Run Admin** + **Secret Manager** access on the prod project (e.g. `fintech-advisor-prod`).
- **`.env.prod`** at repo root with `GOOGLE_PROJECT_ID` / `GCP_PROJECT_ID`, `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_PROD`, `PROD_BASE_URL` (no trailing slash), and any optional vars the script documents in its header.
- `npm run ops:secrets:verify:prod` passes (or fix Secret Manager first; see § *Hotfix: deploy preflight* above).

**Commands (from repo root):**

```bash
# optional: same checks CI would run before deploy
npm run ops:deploy:cloud-run:production:ci
# or deploy only (runs verify-gcp-runtime-secrets + gcloud deploy + health check)
npm run ops:deploy:cloud-run:production
```

Equivalent: `bash scripts/ops/deploy-cloud-run-from-env.sh --production`  
Add `--with-ci-gate` for `npm run ci:gate` only; use `--no-health` only if you intentionally skip `health-check-with-fallback.sh`. **Avoid** `--skip-secret-preflight` in prod unless you fully understand the risk.

**After:** Confirm `GET ${PROD_BASE_URL}/api/health` → `200`. Fix GitHub billing separately so CI/Actions work again for team deploys.

**Version vs staging:** Manual deploy runs `gcloud run deploy --source .` on **whatever is in your working tree** — there is no separate “deploy vX.Y.Z from the cloud” selector. The built app’s `APP_VERSION` (see `src/lib/app-version.ts`) comes from **`package.json` at build time** on that checkout. To align prod with staging, deploy from the **same git commit (or tag)** as the staging revision (e.g. `git fetch && git checkout <sha-or-tag>`), then run the deploy command — avoid shipping an unpushed local version bump unless you intend to release it.

**Custom domain shows old footer but deploy “succeeded”:** Compare `curl -sS "$PROD_BASE_URL/api/health" | jq .version` (or staging) with the direct Cloud Run `*.run.app` URL for `CLOUD_RUN_SERVICE_PROD` / `CLOUD_RUN_SERVICE_STAGING`. **`jq .version` is `null`** when the running image predates the health `version` field — redeploy from current `main` first. If **`PROD_BASE_URL`** (or staging) vs **`https://<CLOUD_RUN_SERVICE>-….run.app`** show **different** `version` / footer labels while **`*.run.app`** matches `package.json`, the problem is **routing**, not another deploy: **Cloud Run domain mapping** still points `atx.…` at a **legacy** service (e.g. `xfinance-core-prod`), or an **HTTPS LB** backend is wrong. **Not CDN / Route 53 alone** — fix **which service owns the custom domain** in GCP (`sre-gcp-deployment.md` §8).
