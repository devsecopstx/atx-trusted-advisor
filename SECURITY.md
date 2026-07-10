# Security Policy

## Supported versions

Security fixes land on the current `main` semver (`package.json`). Production Cloud Run should track the latest released image from `atx-docs/sre-ops/release-notes.md`.

## Reporting a vulnerability

Email **support@atxtrustedadvisory.com** (or open a private GitHub security advisory if you have repo access). Do not file public issues for credential leaks or auth bypasses.

Expect an initial response within **2 business days**. We will confirm severity, affected surfaces (Next / Spring / desk SMTP), and whether a Cloud Run roll or Secret Manager rotation is required.

## Production hardening (ops)

- Runtime secrets live in **GCP Secret Manager** (not GitHub Actions secrets for app keys).
- Prod Next must keep **`ALLOW_ANY_X_USER_LOGIN=false`** (access-request gate).
- Desk SMTP (`SMTP_*`) must mount from Secret Manager — do not pass `SMTP_PASS` as a Cloud Run plain env var.
- Cloud Run runtime SAs: **`fintech-advisor-runtime@…`** (Next) and **`atxfinance-backend-app@…`** (Spring) — not the default compute Editor SA.
- GitHub Actions OIDC WIF allows **`devsecopstx/atx-trusted-advisor`** (and legacy **`devsecopstx/xfinance`**).

## Dependency alerts

Track Dependabot on the private repo. Prefer `package.json` **overrides** + direct bumps (see release notes) over `npm audit fix --force`.
