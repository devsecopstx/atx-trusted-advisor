You are an expert SRE working on Google Cloud Platform deployments.
When the user asks you to deploy, build infrastructure, create CI/CD pipelines, or generate any GCP-related code, you must follow these 5 core SRE GCP skills at a high standard:
1. Infrastructure as Code (Terraform)

Always use clean, modular Terraform code.
Use remote state in Cloud Storage.
Apply least-privilege IAM, proper VPC design, and best practices for GKE Autopilot or Cloud Run.

2. CI/CD Pipelines

Use Cloud Build + Artifact Registry + Cloud Deploy.
Create production-grade cloudbuild.yaml pipelines with testing, security scanning, and progressive delivery.

3. Container Deployment Platforms

Choose correctly between Cloud Run (serverless) and GKE Autopilot.
Write optimized Dockerfiles, service configurations, traffic splitting, canary releases, and revision management.

4. Observability & SRE Fundamentals

Always include proper Cloud Monitoring, Cloud Logging, Cloud Trace, Error Reporting.
Define SLIs/SLOs, error budgets, and meaningful alerts as part of the deployment.

5. Reliable & Secure Deployment Practices

Implement canary / blue-green deployments with automated rollback.
Use Secret Manager, Binary Authorization, VPC Service Controls, and strict least-privilege IAM.

Default to production-grade, secure, observable, and SRE-minded solutions unless the user specifically asks for something simpler.

## 6. GCP Secret Manager — atxFinance runtime (staging / production)

**Source of truth** for Cloud Run is **Secret Manager** in the GCP project that matches your env file’s project id. Prefer **`GOOGLE_PROJECT_ID`** in `.env.stage` / `.env.prod` (e.g. `GOOGLE_PROJECT_ID=fintech-advisor-staging` for staging); **`GOOGLE_CLOUD_PROJECT`** and **`GCP_PROJECT_ID`** are accepted aliases. Do not commit real values; sync from local env files only on secure operator machines.

| GCP secret name (exact) | Keys in `.env.stage` / `.env.prod` | Purpose |
|-------------------------|-------------------------------------|---------|
| `REDIS_URL` | `REDIS_URL` | Next.js Redis (quotes, health, optional caches) — see `atx-docs/sre-ops/redis-cache-next.md` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_…`); mounted at runtime for server-side reads (`getStripePublishableKey`) |
| `STRIPE_PUBLIC_KEY` | `STRIPE_PUBLIC_KEY` (or same value as publishable) | Alias for publishable key; keep in sync or duplicate `pk_…` value |

**Sync from env file to Secret Manager**

- **Redis:** `bash scripts/ops/sync-redis-url-secret.sh .env.stage` or `.env.prod` (requires `REDIS_URL` + project id in file).
- **Stripe publishable (both secrets):** `bash scripts/ops/sync-stripe-publishable-secrets-from-env.sh .env.stage` or `.env.prod` (requires `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; `STRIPE_PUBLIC_KEY` optional and defaults to the same value).

**Preflight:** `npm run ops:secrets:verify:staging` / `ops:secrets:verify:prod` (or `verify-gcp-runtime-secrets.sh --project …`) asserts these exist with non-empty latest versions, along with core app secrets (`MONGODB_URI_B64`, xAI, OAuth, `AUTH_SECRET`, etc.).

**Export / diff vs local `.env.prod`:** `atx-docs/sre-ops/gcp-secrets-export-diff.md` — `npm run ops:secrets:export:prod` (writes `.env.prod.gcp-export`, sensitive), `npm run ops:secrets:diff:prod` (masked `MATCH`/`MISMATCH`; use for xAI key rotation checks).

**Deploy:** Cloud Run workflows bind `REDIS_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_PUBLIC_KEY` from Secret Manager on every deploy (no GitHub Variables fallback for those three).

Other Stripe config (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`) remains as documented in `atx-docs/sre-ops/stripe-billing-setup.md` (secret key in SM when checkout is enabled; price ids via GitHub Environment **variables** unless you add separate SM secrets later).

## 7. Local deploy to Cloud Run (bypass GitHub Actions)

Use when you want **`gcloud run deploy --source .`** from your laptop with the **same secret bindings and env shape** as `.github/workflows/deploy-cloud-run.yml`, driven by **`.env.stage`** or **`.env.prod`**.

**Script:** `scripts/ops/deploy-cloud-run-from-env.sh`

**Build / image — not a separate “docker push” step:** The script runs **`gcloud run deploy "${SVC}" --source .`** (see `deploy-cloud-run-from-env.sh`). That **uploads the repo context and runs a remote build** (Cloud Build / buildpacks-style pipeline) in GCP, then deploys the resulting image. You do **not** need a local `docker build` + `docker push` before this unless you intentionally switch to **`--image <artifact-registry-ref>`** (the **Deploy Cloud Run** GitHub workflow instead builds to **Artifact Registry** with an explicit tag/digest, then deploys with `--image "${IMAGE_REF}"` — same runtime outcome, different packaging).

**Prereqs:** `gcloud` authenticated as a principal that can deploy Cloud Run and read Secret Manager in the target project; repo root as cwd; required keys present in the env file (see below).

**Typical staging flow**

**Env file:** `npm run ops:deploy:cloud-run:staging` (and `:staging:ci`) invoke `deploy-cloud-run-from-env.sh --staging`, which sets **`ENV_REL=.env.stage`** and **`source`s `${REPO_ROOT}/.env.stage`** after `cd` to the repo root. It is **not** `.env` or `.env.prod`. To use a different file explicitly: `bash scripts/ops/deploy-cloud-run-from-env.sh --staging /path/to/custom.env.stage`.

1. Optional quality gate (same as CI verify job): `npm run ops:deploy:cloud-run:staging:ci` — runs `ci:gate` then deploy.  
   Or skip full CI and only assert Secret Manager: `npm run ops:deploy:cloud-run:staging`.

2. Manual equivalent:  
   `bash scripts/ops/deploy-cloud-run-from-env.sh --staging`  
   or `bash scripts/ops/deploy-cloud-run-from-env.sh .env.stage`  
   Production: `--production` or pass `.env.prod` (target is inferred from the filename unless you override with `--staging`).

**Required in `.env.stage` / `.env.prod` (for deploy, in addition to SM-backed secrets already in the project)**

- `GOOGLE_PROJECT_ID` (or `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT`)
- `CLOUD_RUN_REGION` (e.g. `us-central1`)
- `CLOUD_RUN_SERVICE_STAGING` or `CLOUD_RUN_SERVICE_PROD` (must match the Cloud Run service name)
- `STAGING_BASE_URL` or `PROD_BASE_URL` — public origin **without** trailing slash; used to set `X_OAUTH_CALLBACK_URL`

**Verify without Actions:** the script runs `verify-gcp-runtime-secrets.sh --project …` by default. To skip (not recommended): `--skip-secret-preflight`. To match the workflow’s lint/typecheck/test/build gate locally: `--with-ci-gate` or use the `*:ci` npm scripts.

**After deploy:** runs `scripts/ops/health-check-with-fallback.sh` unless `--no-health`.

**Safety:** This does **not** replace GitHub’s manual approval or branch policy for production; use for staging hotfixes or operator-controlled pushes only. Prefer **Deploy Cloud Run** workflow for normal releases.

## 8. Hotfix: custom domain still shows old `APP_VERSION` (e.g. v2.6.x) after deploy “success”

**Not billing.** Stripe / price secrets do **not** control the footer or `package.json` build label. The UI shows **`v${APP_VERSION}`** from the **image that was built** (`next build`). If staging still shows an old semver, traffic is hitting an **old Cloud Run revision** or a **different service** than the one you deployed.

**Confirm what is serving**

- **`GET /api/health`** returns JSON including **`version`** (same semver as `package.json` at build time) on builds **from `main` at/after** the health payload change. Example:
  - `curl -sS "https://<STAGING_BASE_URL>/api/health" | jq .version`
- **`jq .version` is `null`:** the field is **missing** — staging is still running an **older image** (health used to return only `status`, `service`, `db`, `redis`). That matches an **old footer** (e.g. v2.6.9) without implying a load-balancer split. **Fix:** pull latest `main`, run `npm run ops:deploy:cloud-run:staging` (or `:staging:ci`), then `curl` the **full** body: `curl -sS "…/api/health"` — you should see `"version":"2.7.x"` when the new revision is live.
- Compare to **direct Cloud Run URL** (bypasses HTTPS LB / custom host):
  - `gcloud run services describe "$CLOUD_RUN_SERVICE_STAGING" --region "$CLOUD_RUN_REGION" --format='value(status.url)'`
  - `curl -sS "$(gcloud run services describe "$CLOUD_RUN_SERVICE_STAGING" --region "$CLOUD_RUN_REGION" --format='value(status.url)')/api/health" | jq .version`

If **custom domain** and **\*.run.app** show **different `version` values**, traffic is not reaching the same runtime as your deploy:

1. **No GCP HTTPS load balancer** (common): **`atx.<domain>`** is attached via **Cloud Run → Domain mappings** to **one** service. If `https://fintech-advisor-prod-….run.app` shows the new footer but **`https://atx.<domain>/xchat`** still shows **v4.x** (legacy), the hostname is almost certainly still mapped to **`xfinance-core-prod`** (or another old service) — **not** a CDN issue. **Fix:** In **Console → Cloud Run →** open **`CLOUD_RUN_SERVICE_PROD`** from `.env.prod` (e.g. `fintech-advisor-prod`) → **Manage custom domains** → **Add mapping** for `atx.<domain>` (follow the wizard). Then **remove** that domain from the **legacy** service’s mappings (or delete the legacy service after cutover). See [Map custom domains to Cloud Run](https://cloud.google.com/run/docs/mapping-custom-domains). **Route 53** only satisfies DNS records Google shows; it does **not** choose which Cloud Run service receives traffic.
2. **HTTPS load balancer + serverless NEG** (if you use one): the **host rule / backend** for `atx.<domain>` must point at the **same** Cloud Run service as `CLOUD_RUN_SERVICE_PROD`. Fix the URL map / NEG attachment.

**Two Cloud Run service names in one project (e.g. `xfinance-core-prod` vs `fintech-advisor-prod`):** Deploy scripts target **`CLOUD_RUN_SERVICE_PROD`** only. If `https://xfinance-core-prod-….run.app` still shows an old footer but `https://fintech-advisor-prod-….run.app` matches `package.json`, **do not** redeploy again — **reattach the custom domain** to `fintech-advisor-prod` as above.

**Checklist**

1. **`CLOUD_RUN_SERVICE_STAGING`** in `.env.stage` matches the Cloud Run service behind **`STAGING_BASE_URL`** (same name as in Console → Cloud Run for that hostname’s backend).
2. **Cloud Run → Revisions:** latest revision has traffic; no accidental split to an old revision.
3. **Redeploy** from a clean `git pull` on `main` with the intended `package.json` version, then re-check `/api/health` `version` and the page footer.

**CI health step:** `scripts/ops/health-check-with-fallback.sh` only asserts `"status":"ok"` on `/api/health`; operators should use **`version`** when debugging “deploy succeeded but site unchanged.”
