---
name: atxfinance-gcp-foundation
description: Define and bootstrap atxfinance GCP foundation for staging and production with DNS records, HTTPS load balancer host rules, Cloud Run mappings, secret strategy, and environment variable matrix. Use when setting up new GCP environments, custom domains, or pre-deploy infrastructure decisions.
---

# atxfinance GCP Foundation

## Goal

Create a deterministic GCP baseline for `atxfinance` with:

- staging + production hostnames
- HTTPS and DNS
- host-based routing
- Cloud Run service mapping
- environment variable and secret wiring

## Recommended Defaults

Use these defaults unless the user explicitly overrides:

- Production app URL: `https://atx.<domain>`
- Staging URL: `https://staging.atx.<domain>`
- One Cloud Run service per environment:
  - `atxfinance-core-staging`
  - `atxfinance-core-prod`
- Separate GCP projects per environment:
  - `atxfinance-staging`
  - `atxfinance-prod`
- Region: `us-central1`
- Single global external HTTPS load balancer with host rules per environment
- Secrets in Secret Manager, not plain env values in CI logs

## Required Inputs

Collect these first:

- `<domain>` and DNS provider
- Project IDs (staging/prod)
- Region (default `us-central1`)
- Artifact Registry location/repository
- Service account emails for deploy/runtime
- Whether prod uses `atx.<domain>` (recommended for backoffice) or apex
- OAuth app strategy (single app with 2 callbacks vs separate env apps)

## DNS Records

Create/verify records:

- `staging.atx.<domain>` -> LB static IP (A/AAAA)
- `atx.<domain>` -> LB static IP (A/AAAA)

If using apex for production:

- `<domain>` -> LB static IP (A/AAAA)

## HTTPS and Certificates

Use Google-managed certificate covering:

- `staging.atx.<domain>`
- `atx.<domain>` (and apex if selected)

Do not cut traffic until certificate state is `ACTIVE`.

## Load Balancer Host Rules

Create URL map host routing:

- Host `staging.atx.<domain>` -> backend `atxfinance-core-staging`
- Host `atx.<domain>` -> backend `atxfinance-core-prod`

Default backend can point to staging only during setup; move to explicit hosts for final state.

## Cloud Run Mapping

Map each backend service to one Cloud Run service:

- `atxfinance-core-staging` backend -> Cloud Run `atxfinance-core-staging`
- `atxfinance-core-prod` backend -> Cloud Run `atxfinance-core-prod`

Use serverless NEGs for Cloud Run attachment.

## Env Var Matrix (atxfinance)

For both envs, set required app keys:

| Key | Staging | Production | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | `production` | Cloud Run runtime mode |
| `MONGODB_URI_B64` | required | required | use separate DB/cluster per env |
| `XAI_API_KEY` | required | required | separate nonprod/prod keys |
| `XAI_MANAGEMENT_API_KEY` | required | required | required for KB/management operations |
| `X_OAUTH_CLIENT_ID` | required | required | separate app creds preferred |
| `X_OAUTH_CLIENT_SECRET` | required | required | separate app creds preferred |
| `AUTH_SECRET` | strongly required | strongly required | minimum 16 chars |
| `X_OAUTH_CALLBACK_URL` | `https://staging.atx.<domain>/api/auth/x/callback` | `https://atx.<domain>/api/auth/x/callback` | pin callbacks in production-like envs |
| `ADMIN_SEED_EMAIL` | optional | optional | default seed admin email |
| `ADMIN_X_USERNAMES` | optional | optional | comma-separated allowlist |

## OAuth and Cookie Safety

Must keep callback host exactly aligned with browser host:

- X app redirect URI
- `X_OAUTH_CALLBACK_URL`
- actual domain users hit

Mismatch can trigger auth cookie context failures.

## CI/CD Default Flow

Recommended:

1. Push to `main` -> staging deploy
2. Tag `v*` -> production deploy
3. CI gate before deploy: lint + typecheck + tests + build
4. Post-deploy checks:
   - `GET /api/health`
   - OAuth login redirect callback shape

## Verification Checklist

- [ ] DNS resolves to LB static IP
- [ ] managed cert is `ACTIVE`
- [ ] host rules route to correct backend per hostname
- [ ] Cloud Run revisions healthy in both envs
- [ ] `/api/health` is successful on both env URLs
- [ ] OAuth login and callback work on both env URLs

## Output Requirements

When using this skill, output:

- final chosen defaults
- unresolved decisions
- exact DNS records to add
- host rule mapping table
- env var matrix (with source: secret/env)
- first safe rollout order and rollback note
