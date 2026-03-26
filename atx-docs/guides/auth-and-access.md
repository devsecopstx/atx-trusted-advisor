# Auth and Access Guide

This is the auth/access entrypoint. Use this page for incident triage, then jump to deep docs for implementation details.

## Deep-dive docs

- `src/modules/identity/authorization.ts` (login/role gate behavior)
- `src/modules/surface-policy.ts` (admin_console vs app_user path policy)
- `src/proxy.ts` (protected route redirect behavior)
- `atx-docs/sre-ops/auth-oauth-spring-dual-run.md` (OAuth dual-run/cutover operations)
- `atx-docs/sre-ops/x-oauth-atx-callbacks.md` (callback host/config checklist)

## Platform roles vs tenant membership

Session payload distinguishes:

- **Platform roles (`roles`)**: `global_admin`, `advisor`, `operator`, `viewer`
- **Tenant membership (`tenantRole`)**: `tenant_admin`, `member`

`app_user` in docs means signed-in product users with platform roles `advisor`, `operator`, or `viewer`; it is not a stored role string.

## Surface policy

- `admin_console`: `/admin/*` and `/api/admin/*` (`global_admin` only)
- `app_user`: `/xchat`, `/portfolio`, `/watchlist`, `/recommendations`, `/xstrategybuilder`

Reference: `src/modules/surface-policy.ts` and `src/proxy.ts`.

## Access request lifecycle

State machine:

- `new -> triaged -> pending -> approved|rejected|expired`
- Terminal states: `approved`, `rejected`, `expired`

SLA expiry window is 7 days (`ACCESS_REQUEST_SLA_DAYS`).

## OAuth and login consistency

Keep these aligned to avoid missing cookie context and callback failures:

- Browser host used during login
- `X_OAUTH_CALLBACK_URL` host (if set)
- X developer app callback URL

## Common login error meanings

- `email_link_required`: no email claim from X and no login-allowed role yet
- `access_request_pending`: account exists but lacks login-allowed role
- `bootstrap_failed`: post-auth bootstrap failed (membership/session persistence path)

## App_user HTTP 500 triage

If admin works but app_user routes fail:

1. Verify `GET /api/health` is `200`.
2. Inspect Cloud Run logs around path + auth callback events.
3. Confirm Mongo schema compatibility for user/portfolio identity fields.
4. Re-check callback/env values (especially empty or incorrect callback URL values).
5. Clear cookies after `AUTH_SECRET` rotation.

If incident is deploy-related, continue in `atx-docs/guides/deploy-and-ops.md`.
