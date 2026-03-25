# Shared execution context (backend ↔ frontend)

Coordination file for multi-agent work. **If you change an API or app_user contract, update this file** (see `.cursor/agents/*.yaml` personas).

## Live status (edit as work progresses)

- **Backend:** Auth/session migration to Spring per `atx-docs/sre-ops/api-consolidation-spring-backend.md` (callback + PKCE ownership; dual-run).
- **Frontend:** Login / OAuth entry UX; follow `.cursor/rules/xfinance-branding.mdc` and `AGENTS.md`.
- **Reviewer:** Scope + contracts vs `frontend` / `backend` agent personas; branding via **xfinance-branding** (not ad-hoc `feature-branding.md` unless that persona is explicitly selected).

---

## Canonical auth surfaces (today’s app)

Browser auth is **X OAuth redirect**, not JSON email/password. Inventory matches `src/lib/openapi/current-state.ts` (auth tag):

| Method | Path | Role |
|--------|------|------|
| GET | `/api/auth/x/login` | Starts OAuth (redirect). |
| GET | `/api/auth/x/callback` | OAuth callback (session cookie / redirects). |
| GET | `/api/auth/me` | Current user probe. |
| POST | `/api/auth/logout` | End session. |
| POST | `/api/auth/link-email` | Link email when X profile lacks it (body per route). |

**Approved cutover contract** (Spring authority, cookies, PKCE/state in Redis, failure redirects):  
`atx-docs/sre-ops/api-consolidation-spring-backend.md` → section **Auth callback contract (approved)**.

There is **no** shipped `POST /api/v1/auth/login` in this repo; do not build the UI against that path unless backend adds it and updates this file.

---

## Draft / future (not implemented — placeholder only)

*If product adds credential-based login later, define OpenAPI + Spring controller first, then promote here.*

### Example placeholder (do not treat as live)

- **URL:** _TBD — not `/api/v1/...` until version prefix is agreed_
- **Request body (illustrative):**
  ```json
  {
    "email": "string",
    "password": "string",
    "mfaToken": "string"
  }
  ```

---

## Related

- `atx-docs/sre-ops/api-consolidation-spring-backend.md` — migration board + auth topology.
- `atx-docs/sre-ops/atxfinance-backend-http-api.md` — Spring HTTP surface as it lands.
