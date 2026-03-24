# Auth / OAuth — Spring session + callback dual-run

**Status:** Next.js is **authoritative** for OAuth start, PKCE, callback, and session cookie issuance. **atxfinance-backend** (Spring) **reads** the same signed `xf_core_session` cookie for BFF-proxied product APIs; it does **not** yet expose a production OAuth callback.

**Canonical migration plan:** [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md) — *Auth callback contract (approved)*.

## Current implementation (Next)

| Concern | Location / behavior |
|---------|---------------------|
| OAuth redirect to X | `GET /api/auth/x/login` — `src/app/api/auth/x/login/route.ts` |
| PKCE `state` + `code_verifier` | HTTP-only cookies on the **redirect response** (`applyOAuthFlowCookiesToRedirect` in `src/lib/auth.ts`) |
| Callback | `GET /api/auth/x/callback` — `src/app/api/auth/x/callback/route.ts` |
| Session cookie | `xf_core_session` — HMAC-signed payload, `sameSite: "lax"`, `secure` in production (`createSession` in `src/lib/auth.ts`) |
| Post-login redirect | **Hard-coded** to `/admin` (global admin) or `/xchat` (others); does **not** yet honor `login?next=` on success (product gap vs pitch CTAs). |
| Failure redirect | `/login?error=<code>` — see **Next error codes** below. |

## Spring today

| Concern | Status |
|---------|--------|
| Parse `xf_core_session` | `SessionCookieParser` + `SessionCookieParserTest` — same signing secret rules as Next (`AUTH_SECRET` or `X_OAUTH_CLIENT_SECRET`). |
| Issue session from OAuth | **Not implemented** — no `/api/auth/x/callback` on JVM in this repo yet. |
| Redis PKCE store | **Not wired** for OAuth (contract assumes 10-minute TTL keyed by `state`). |

## Approved target contract vs gaps

| Contract item | Target (approved) | Gap today |
|---------------|--------------------|-----------|
| Session authority | Spring only | Next issues session; Spring consumes cookie only. |
| Cookie `SameSite` | `Strict` | Next uses `lax` (OAuth cross-site return needs careful testing before tightening). |
| PKCE storage | Redis, TTL 10m | Next uses ephemeral cookies. |
| Post-login `next` | Allowlisted paths; default `/dashboard` | Next ignores `next` on success; product uses `/admin` \| `/xchat`. Align allowlist with real routes (`/xchat`, `/portfolio`, `/admin`, …) before cutover. |
| Failure `error` codes | `invalid_state`, `code_reused`, `missing_email`, `access_denied`, `generic` | Next emits **granular** codes (table below). Map or alias in Spring + login UI for dual-run. |

## Next `/login?error=` codes (regression matrix for Spring parity)

Codes emitted by `src/app/api/auth/x/callback/route.ts` today (non-exhaustive for deep branches):

| Code | Typical cause |
|------|----------------|
| `missing_oauth_callback_params` | Missing `code` or `state` query param. |
| `missing_oauth_cookie_context` | PKCE cookies missing; no existing session (callback without prior `/api/auth/x/login` or cookie dropped). |
| `invalid_oauth_state` | `state` mismatch vs cookie. |
| `token_exchange_failed` | X token endpoint non-2xx. |
| `missing_access_token` | Token JSON missing `access_token`. |
| `userinfo_failed` | Userinfo request failed (optional `details` query param). |
| `invalid_user_profile` | Profile missing `id` / `username`. |
| `email_link_required` | Placeholder / link-email flow. |
| `not_seeded_email` | Email path could not bootstrap user. |
| `access_request_pending` | User lacks login-eligible role and fallback disabled. |
| `not_authorized_admin` | Admin allowlist denied. |
| `tenant_bootstrap_failed` | Default tenant missing. |
| `bootstrap_failed` | Session bootstrap exception (logged server-side). |

**Test coverage today:** host canonicalization + happy-path branches are partially covered in `tests/smoke/oauth-host-normalization-smoke.test.ts` and `tests/integration/access-request-approval-login.test.ts`. **Early callback validation** is covered in `tests/smoke/oauth-callback-error-redirects.test.ts`.

## Dual-run cutover checklist (operators)

1. **Implement** Spring callback + Redis PKCE + session issuance matching **byte-compatible** cookie format (Spring already verifies Next-shaped cookies in tests).
2. **Register** the **same** callback URL(s) in the X developer portal (already `…/api/auth/x/callback` on the app host — see [`x-oauth-atx-callbacks.md`](./x-oauth-atx-callbacks.md)). Dual-run does **not** require a second path if traffic is switched by deployment (only one handler should answer per environment at a time unless you intentionally shadow a percentage — not described here).
3. **Staging:** enable Spring callback behind a feature flag or deploy Spring as the sole handler for `/api/auth/x/callback` while Next route remains in codebase (rollback = redeploy Next-only or route LB back).
4. **Soak 7–14 days:** monitor `[auth/x/callback]` logs (Next) vs Spring equivalents; compare login success rate, `invalid_oauth_state`, and token exchange errors.
5. **Align** login page copy for any new unified error aliases (`generic`, `invalid_state`, …).
6. **Remove** Next callback issuance path only after Spring integration tests and smoke login pass in CI.

## Clarifications (for implementers / reviewers)

- **Single vs dual physical callback URL:** The approved contract uses one path (`/api/auth/x/callback`). "Dual-run" means **two codepaths** (Next and Spring) available across **time** or **environments**, not necessarily two registered redirect URIs at X.
- **BFF vs direct browser → Spring:** If the browser ever POSTs/redirects to Spring on another origin, X's **redirect_uri** must match exactly; prefer same-origin BFF until CORS/cookie strategy is explicit.
- **`next` query:** Today's Next login page may pass `next=`; callback **success** still lands on `/admin` or `/xchat`. Spring cutover is a good moment to implement allowlisted `next` for product parity with pitch CTAs.

## Related

- [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md) — status board + auth contract
- [`atxfinance-backend-http-api.md`](./atxfinance-backend-http-api.md) — Spring HTTP surface
- [`x-oauth-atx-callbacks.md`](./x-oauth-atx-callbacks.md) — X app callback URLs
- `AGENTS.md` — local validation and session cookie testing notes
