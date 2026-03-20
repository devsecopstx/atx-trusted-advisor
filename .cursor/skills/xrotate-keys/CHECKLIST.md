# xrotate-keys Checklist

## Mandatory Checklist

### 1) Pre-rotation inventory

- [ ] Identify exactly which credentials are rotating and why.
- [ ] Confirm active production URL/domain and all OAuth callback URLs.
- [ ] Confirm current App Runner service and GitHub repo/branch used for deploys.
- [ ] Open `docs/secret-rotation.md` in the atxFinance repo as the runbook baseline.

### 2) Create new credentials

- [ ] Generate new provider credentials (do not revoke old yet).
- [ ] For auth secret: `npx auth secret` (or generate base64 variant if needed).
- [ ] Record creation timestamp and owner in internal notes (never store secret values in git).

### 3) Stage locally (never commit secrets)

- [ ] Update local `.env.local` with only rotated values.
- [ ] Validate local critical flows (`pnpm dev`) before production update.
- [ ] Ensure no secret values are staged in git.

### 4) Update production runtime (App Runner first)

- [ ] AWS Console -> App Runner -> Service -> Configuration -> Environment variables.
- [ ] Set rotated values and deploy service.
- [ ] Keep old credentials active during verification window (24-48h).

### 5) Update CI/deploy integration (GitHub as needed)

- [ ] GitHub Secrets: rotate values used by Actions (`AWS_*`, `SLACK_WEBHOOK_URL`, etc.) only if in scope.
- [ ] GitHub Variables: verify deploy variables (`APP_RUNNER_SERVICE_ARN`, `APP_URL`, `ENABLE_AWS_DEPLOY`, `AWS_REGION`) are correct, especially after service/domain changes.

### 6) Provider-specific validation

- [ ] X OAuth login works end-to-end and callback URL matches.
- [ ] Google OAuth login works end-to-end and callback URL matches.
- [ ] GitHub OAuth login works end-to-end and callback URL matches.
- [ ] xAI/Grok calls succeed with new key.
- [ ] Stripe checkout + webhook signature verification succeed.

### 7) Repo/docs hygiene

- [ ] Update `docs/secret-rotation.md` if process or env ownership changed.
- [ ] Update `.env.example` comments/placeholders only (no real values).
- [ ] Append an entry to `CHANGELOG.secret-rotations.md` (no secrets).
- [ ] Run gitleaks before commit (`pre-commit run gitleaks --all-files`).

### 8) Finalize cutover

- [ ] Monitor auth, payments, and health checks for 24-48h.
- [ ] Revoke old credentials after stable window.
- [ ] Mark changelog entry with old-credential revocation date.
