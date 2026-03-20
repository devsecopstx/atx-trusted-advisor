# xChat Pre-Release Check: Docs & Security

Final pass before release — gaps in documentation and security focus. Align with `xfinance-chat-expert.mdc` and `docs/xchat/*.md`.

---

## 1. Documentation Gaps

| Gap | Location | Recommendation |
|-----|----------|----------------|
| **No single xChat “contract” doc** | `docs/xchat/` | Add `docs/xchat/README.md` (or extend existing) with: public routes (`POST /api/xchat/ask`, batch), persona resolution (Super-Agent vs xFinance from session role), and pointer to OpenAPI + persona governance. |
| **Plan limits not wired in API** | `src/modules/xchat/plan-limits.ts` vs `ask/route.ts` | Document in `DEVELOPMENT.md` or `docs/xchat/`: `getPlanLimits()` exists; **daily prompt caps and plan-based gating are not enforced** in `POST /api/xchat/ask` (only fixed rate limit 20/60s). AGENTS.md “Deferred — plan limits UI” already notes usage meter / soft-limit copy; add one line that ask route does not yet enforce `maxPromptsPerDay`. |
| **Tool stub vs runtime** | `docs/xchat/atxfinance-tool-stub.md`, `xfeature-tools-plan.md` | Stub and plan are accurate (deferred runtime). No change; ensure new contributors see stub before adding tool execution. |
| **Feedback retention (PLAN.md)** | `docs/PLAN.md` | “User-facing privacy / retention” is Design TBD for **Feedback** only. Extend to **xChat**: short note that `xchat_logs` stores message, response, user identifiers, and collection refs; retention and export policy TBD unless already defined elsewhere. |

---

## 2. Security Focus

| Area | Current State | Gap / Action |
|------|---------------|--------------|
| **Auth** | `requireSessionUser()` on ask/batch; persona from session role. | Document: unauthenticated requests get 401; `personaId` in body is ignored (chosen server-side). Already in OpenAPI summary. |
| **Rate limiting** | Ask: 20 req/60s per user; batch create/poll: rate limited. | Document in docs: key = `xchat-ask:{userId}`; 429 with `retryAfterSeconds`. OpenAPI has 429. |
| **Payload size** | Ask: `MAX_ASK_PAYLOAD_BYTES = 24 * 1024`; 413 if exceeded. | Optional: mention in API doc or OpenAPI description. |
| **PII to model** | User message and RAG context (Mongo + xAI collection snippets) sent to xAI; `saveXChatLog` stores message, response, `userEmail`, `requestedBy`, chunk refs. | **Gap:** No doc stating what must **not** be sent to the model (e.g. no SSN, account numbers in prompts) or that user content is sent to xAI. Add 1–2 sentences to `docs/xchat/` or `DEVELOPMENT.md`: “User message and retrieved context are sent to xAI; do not include sensitive PII in prompts; chat is stored in `xchat_logs` for support/audit.” |
| **Audit / logging** | Personas, access requests, users: `createAuditEvent` + admin audit explorer. xChat: `saveXChatLog` only (no `AuditEntityType` for chat). | **Acceptable** if product treats chat logs as operational logs, not compliance audit. If compliance requires “every chat request” in audit trail, consider adding `xchat` entity type or documenting that chat is logged only in `xchat_logs` and not in `admin_audit_events`. |
| **Disclaimers** | Default persona system prompt includes “educational”; no “not financial advice” in UI or API. | **Gap:** If release is user-facing, add short disclaimer in UI (e.g. xChat page or first message) and/or in API response metadata: “For education only; not financial advice.” Deferred in AGENTS.md is acceptable if explicitly scoped. |
| **Secrets in workflow** | **Single source of truth:** runtime keys live in **GCP Secret Manager** only; GitHub Environments store **OIDC** (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`) plus non-secret **variables**. “Validate staging deploy configuration” checks vars + OIDC only. After GCP auth, **`gcloud secrets describe`** preflights required secret **names** in the target project (staging and production jobs). | No app secrets in GitHub; values never echoed in logs; Cloud Run mounts `*:latest` from GSM. |

---

## 3. OpenAPI & Route Parity

| Item | Status |
|------|--------|
| `POST /api/xchat/ask` | In `current-state.ts` + overrides; 200/400/401/413/429/502/503. |
| `POST /api/xchat/batch`, `GET /api/xchat/batch/{batchId}` | In inventory; 429 in overrides. |
| Rate limit response shape | `RateLimitErrorResponse` with `retryAfterSeconds`. |

No OpenAPI gap for xChat routes.

---

## 4. Checklist Summary

- [ ] **Docs:** Add or update one xChat overview (routes, persona resolution, plan limits not enforced in ask).
- [ ] **Docs:** One sentence on PII/model: user message + context sent to xAI; avoid sensitive PII; chat stored in `xchat_logs`.
- [ ] **Docs:** Optional: xChat retention / export policy or “TBD” in PLAN.md.
- [ ] **Security:** Optional: UI or API disclaimer “education only; not financial advice” if release is user-facing.
- [ ] **Security:** Confirm no secrets in client or logs (already validated).
- [ ] **Compliance:** Decide if xChat must appear in admin audit trail; if yes, extend audit entity types and document.

---

*Pre-release check; update when contract or security posture changes.*
