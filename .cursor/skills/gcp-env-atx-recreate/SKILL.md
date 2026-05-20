---
name: gcp-env-atx-recreate
description: Standalone gcloud recipe to recreate atx apex GCP (staging.atx / atx) Cloud Run for the xfinance monorepo — no GitHub Actions required. Pair with sre-gcp-foundation for LB/DNS strategy.
---

# GCP environment recreate — atx apex

Recreate **xfinance** GCP staging and production from scratch with hostname apex **`atx`** (replacing older `core`-style hosts). Manual `gcloud` only; wire GitHub variables later if you use Actions deploy.

**Canonical copy:** `.cursor/skills/gcp-env-atx-recreate/SKILL.md` (tracked).  
**Related:** [DEVELOPMENT.md](../../../DEVELOPMENT.md) (OAuth URLs, rollout checklist), [sre-gcp-foundation](../sre-gcp-foundation/SKILL.md), [atx-docs/sre-ops/junie-guidelines-atxfinance-backend.md](../../../atx-docs/sre-ops/junie-guidelines-atxfinance-backend.md) for backend worker (separate Cloud Run service).

## Path and repo conventions

| What | Path (from repo root) |
|------|------------------------|
| **Monorepo root** | Directory that contains `package.json`, `next.config.ts`, `docker-compose.yml`, and (optional) root `Dockerfile` for the Next.js Cloud Run image |
| **Deploy `--source .` for core app** | Run `gcloud run deploy` with `cwd` = monorepo root so Buildpacks / build context see the Next app |
| **Kotlin worker** | `services/atxfinance-backend/` — separate deploy artifact; not covered by the buildpack `--source .` block below unless you change image build |

Example — always resolve root before deploy:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
```

**Hostnames (defaults in this doc):**

- Staging: `https://staging.fintech-advisor.ai`
- Production: `https://fintech-advisor.ai`

---

## 1. Prerequisites

- `gcloud` CLI installed and authenticated
- Domain `fintech-advisor.ai` in your DNS provider (Route53 or other)
- MongoDB Atlas connection strings (staging + prod clusters recommended)
- X OAuth app credentials
- xAI API keys

---

## 2. Project IDs and region

```bash
DOMAIN="fintech-advisor.ai"
APEX="atx"
STAGING_PROJECT="fintech-advisor-staging"
PROD_PROJECT="fintech-advisor-prod"
REGION="us-central1"
SERVICE_STAGING="atxfinance-core-staging"
SERVICE_PROD="atxfinance-core-prod"
```

---

## 3. Create or select GCP projects

```bash
# Create projects (or skip if they exist)
gcloud projects create "$STAGING_PROJECT" --name "atxfinance-staging" --set-as-default
gcloud projects create "$PROD_PROJECT" --name "atxfinance-prod"

# Enable billing (manual in Console if needed)
# Link billing: https://console.cloud.google.com/billing
```

---

## 4. Enable APIs (both projects)

```bash
APIS="run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com"

for PROJ in "$STAGING_PROJECT" "$PROD_PROJECT"; do
  gcloud services enable $APIS --project "$PROJ"
done
```

---

## 5. Secret Manager — create secrets

Create these secrets in **both** projects (Console or CLI).

```bash
SECRET_NAMES="MONGODB_URI_B64 XAI_API_KEY XAI_MANAGEMENT_API_KEY X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET AUTH_SECRET"

for PROJ in "$STAGING_PROJECT" "$PROD_PROJECT"; do
  for SECRET in $SECRET_NAMES; do
    gcloud secrets create "$SECRET" --project "$PROJ" --replication-policy="automatic" 2>/dev/null || true
  done
done
```

Add **versions** with real values (never commit secrets). `MONGODB_URI_B64` is **base64-encoded** UTF-8 of the full Mongo URI (same as core app env — see `DEVELOPMENT.md` / `src/lib/env.ts`).

**Example (Linux, GNU base64):**

```bash
printf '%s' 'mongodb+srv://user:pass@cluster/...' | base64 -w0 | gcloud secrets versions add MONGODB_URI_B64 --data-file=- --project "$STAGING_PROJECT"
```

**macOS:** use `base64` without `-w0`, or pipe through `tr -d '\n'`.

---

## 6. Cloud Run — deploy staging (Buildpack, core Next app)

Uses `gcloud run deploy --source .` from **monorepo root** — Cloud Build detects Node.js and uses buildpacks (no Dockerfile required for that path).

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

STAGING_URL="https://staging.${APEX}.${DOMAIN}"

gcloud run deploy "$SERVICE_STAGING" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,X_OAUTH_CALLBACK_URL=${STAGING_URL}/api/auth/x/callback" \
  --set-secrets "MONGODB_URI_B64=MONGODB_URI_B64:latest,XAI_API_KEY=XAI_API_KEY:latest,XAI_MANAGEMENT_API_KEY=XAI_MANAGEMENT_API_KEY:latest,X_OAUTH_CLIENT_ID=X_OAUTH_CLIENT_ID:latest,X_OAUTH_CLIENT_SECRET=X_OAUTH_CLIENT_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest" \
  --project "$STAGING_PROJECT" \
  --quiet
```

---

## 7. Cloud Run — deploy production (Buildpack)

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

PROD_URL="https://${APEX}.${DOMAIN}"

gcloud run deploy "$SERVICE_PROD" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,X_OAUTH_CALLBACK_URL=${PROD_URL}/api/auth/x/callback" \
  --set-secrets "MONGODB_URI_B64=MONGODB_URI_B64:latest,XAI_API_KEY=XAI_API_KEY:latest,XAI_MANAGEMENT_API_KEY=XAI_MANAGEMENT_API_KEY:latest,X_OAUTH_CLIENT_ID=X_OAUTH_CLIENT_ID:latest,X_OAUTH_CLIENT_SECRET=X_OAUTH_CLIENT_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest" \
  --project "$PROD_PROJECT" \
  --quiet
```

---

## 8. Domain mapping (Cloud Run custom domains)

```bash
# Staging
gcloud run domain-mappings create \
  --service "$SERVICE_STAGING" \
  --domain "staging.${APEX}.${DOMAIN}" \
  --region "$REGION" \
  --project "$STAGING_PROJECT"

# Production
gcloud run domain-mappings create \
  --service "$SERVICE_PROD" \
  --domain "${APEX}.${DOMAIN}" \
  --region "$REGION" \
  --project "$PROD_PROJECT"
```

**Note:** If you use a **global HTTPS load balancer** instead of direct Cloud Run mapping, follow [sre-gcp-foundation](../sre-gcp-foundation/SKILL.md) and skip or adapt this section.

---

## 9. DNS records

| Type | Name | Target |
|------|------|--------|
| CNAME or A | `staging.fintech-advisor.ai` | From `gcloud run domain-mappings describe` (or LB IP) |
| CNAME or A | `fintech-advisor.ai` | From `gcloud run domain-mappings describe` (or LB IP) |

---

## 10. X OAuth callback URLs

Add to the X developer app:

- `https://staging.fintech-advisor.ai/api/auth/x/callback`
- `https://fintech-advisor.ai/api/auth/x/callback`

---

## 11. Health check

```bash
curl -s "https://staging.fintech-advisor.ai/api/health"
curl -s "https://fintech-advisor.ai/api/health"
```

Expected: `{"status":"ok","service":"xfinance-core-app",...}` (fields may vary slightly).

---

## 12. Optional — GitHub variables (CI deploy later)

Set repository and replace `OWNER/REPO`:

```bash
GH_REPO="OWNER/REPO"

gh variable set GCP_PROJECT_ID_STAGING --repo "$GH_REPO" --body "$STAGING_PROJECT"
gh variable set GCP_PROJECT_ID_PROD --repo "$GH_REPO" --body "$PROD_PROJECT"
gh variable set CLOUD_RUN_REGION --repo "$GH_REPO" --body "$REGION"
gh variable set CLOUD_RUN_SERVICE_STAGING --repo "$GH_REPO" --body "$SERVICE_STAGING"
gh variable set CLOUD_RUN_SERVICE_PROD --repo "$GH_REPO" --body "$SERVICE_PROD"
gh variable set STAGING_BASE_URL --repo "$GH_REPO" --body "https://staging.fintech-advisor.ai"
gh variable set PROD_BASE_URL --repo "$GH_REPO" --body "https://fintech-advisor.ai"
```

Align with [DEVELOPMENT.md](../../../DEVELOPMENT.md) → *Deploy/Rollback Operations* and `npm run status:deploy` / `AGENTS.md` for current workflow names.

---

## Rollback / teardown

```bash
gcloud run services delete "$SERVICE_STAGING" --region "$REGION" --project "$STAGING_PROJECT" --quiet
gcloud run services delete "$SERVICE_PROD" --region "$REGION" --project "$PROD_PROJECT" --quiet

# Nuclear: delete entire projects (irreversible)
# gcloud projects delete "$STAGING_PROJECT"
# gcloud projects delete "$PROD_PROJECT"
```
