# GCP Environment Recreate — atx Apex

Recreate atxfinance GCP staging and production from scratch with apex `atx` (replacing `core`).

**New hostnames:**
- Staging: `https://staging.atx.fintech-advisor.ai`
- Production: `https://atx.fintech-advisor.ai`

**Not GitHub-dependent** — manual gcloud setup. Wire GitHub vars/secrets later if needed.

---

## 1. Prerequisites

- `gcloud` CLI installed and authenticated
- Domain `fintech-advisor.ai` in your DNS provider (Route53 or other)
- MongoDB Atlas connection strings (staging + prod clusters recommended)
- X OAuth app credentials
- xAI API keys

---

## 2. Project IDs and Region

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

## 3. Create/Select GCP Projects

```bash
# Create projects (or skip if they exist)
gcloud projects create "$STAGING_PROJECT" --name "atxfinance-staging" --set-as-default
gcloud projects create "$PROD_PROJECT" --name "atxfinance-prod"

# Enable billing (manual in Console if needed)
# Link billing: https://console.cloud.google.com/billing
```

---

## 4. Enable APIs (Both Projects)

```bash
APIS="run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com"

for PROJ in "$STAGING_PROJECT" "$PROD_PROJECT"; do
  gcloud services enable $APIS --project "$PROJ"
done
```

---

## 5. Secret Manager — Create Secrets

Create these secrets in **both** projects. Use `echo -n "value" | gcloud secrets create ...` or Console.

```bash
SECRET_NAMES="MONGODB_URI_B64 XAI_API_KEY XAI_MANAGEMENT_API_KEY X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET AUTH_SECRET"

for PROJ in "$STAGING_PROJECT" "$PROD_PROJECT"; do
  for SECRET in $SECRET_NAMES; do
    gcloud secrets create "$SECRET" --project "$PROJ" --replication-policy="automatic" 2>/dev/null || true
  done
done
```

Add secret versions with your values (do not commit):

```bash
# Example (replace with real values)
gcloud secrets versions add MONGODB_URI_B64 --data-file=- --project "$STAGING_PROJECT" <<< "$(echo -n 'your-base64-mongo-uri' | base64 -w0)"
# Repeat for each secret in each project
```

---

## 6. Cloud Run — Deploy Staging (Buildpack)

Uses `--source .` — Cloud Build detects Node.js and builds with buildpacks. No Dockerfile required.

```bash
cd /path/to/atxfinance
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

## 7. Cloud Run — Deploy Production (Buildpack)

```bash
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

## 8. Domain Mapping (Cloud Run Custom Domains)

Map custom domains to Cloud Run services:

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

**Note:** Domain mapping may require a single project with both services, or a global HTTPS LB. If your setup uses a shared LB, use that instead.

---

## 9. DNS Records

Add records pointing to your LB or Cloud Run mapping targets:

| Type | Name | Target |
|------|------|--------|
| CNAME or A | `staging.atx.fintech-advisor.ai` | From `gcloud run domain-mappings describe` output |
| CNAME or A | `atx.fintech-advisor.ai` | From `gcloud run domain-mappings describe` output |

If using Cloud Run direct mapping (no LB), the output of `gcloud run domain-mappings describe` shows the exact target (e.g. `ghs.googlehosted.com` or similar for Cloud Run).

---

## 10. X OAuth Callback URLs

Add these to your X app developer settings:

- `https://staging.atx.fintech-advisor.ai/api/auth/x/callback`
- `https://atx.fintech-advisor.ai/api/auth/x/callback`

---

## 11. Health Check

```bash
curl -s "https://staging.atx.fintech-advisor.ai/api/health"
curl -s "https://atx.fintech-advisor.ai/api/health"
```

Expected: `{"status":"ok","service":"atxfinance-core-app","db":"atxfinancedb"}`

---

## 12. Optional — GitHub Variables (If Wiring CI Later)

```bash
GH_REPO="devsecopstx/xfinance"

gh variable set GCP_PROJECT_ID_STAGING --repo "$GH_REPO" --body "$STAGING_PROJECT"
gh variable set GCP_PROJECT_ID_PROD --repo "$GH_REPO" --body "$PROD_PROJECT"
gh variable set CLOUD_RUN_REGION --repo "$GH_REPO" --body "$REGION"
gh variable set CLOUD_RUN_SERVICE_STAGING --repo "$GH_REPO" --body "$SERVICE_STAGING"
gh variable set CLOUD_RUN_SERVICE_PROD --repo "$GH_REPO" --body "$SERVICE_PROD"
gh variable set STAGING_BASE_URL --repo "$GH_REPO" --body "https://staging.atx.fintech-advisor.ai"
gh variable set PROD_BASE_URL --repo "$GH_REPO" --body "https://atx.fintech-advisor.ai"
```

---

## Rollback / Teardown

To tear down and start over:

```bash
# Delete Cloud Run services
gcloud run services delete "$SERVICE_STAGING" --region "$REGION" --project "$STAGING_PROJECT" --quiet
gcloud run services delete "$SERVICE_PROD" --region "$REGION" --project "$PROD_PROJECT" --quiet

# Delete projects (nuclear)
# gcloud projects delete "$STAGING_PROJECT"
# gcloud projects delete "$PROD_PROJECT"
```
