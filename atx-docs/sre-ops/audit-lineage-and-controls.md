# Audit lineage, BFF, and control gaps (atxfinance)

**Index:** [atx-docs README](../README.md) · **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../../.cursor/skills/atxdesign-review-audit/SKILL.md)

This document maps **repository reality** to the **xdesign-review-audit** skill: what is implemented today, what is tested, and what remains for regulatory-grade replay / non-repudiation.

## Canonical store

| Concern | Implementation |
|--------|------------------|
| Admin / product audit rows | MongoDB collection **`admin_audit_events`** |
| Next writers | `src/modules/audit/repository.ts` → `createAuditEvent` |
| Spring writers | `AuditEventService` (`services/atxfinance-backend/…`) |
| Admin read API | `GET /api/admin/audit` — Next handler **or** Spring `AdminAuditController` when BFF proxy is on |

### Document shape (both stacks)

Rows are **append-only** application inserts (not tamper-evident by themselves):

- `entityType`, `entityId`, `action`
- `actor`: `{ userId, email?, username? }` (Next `AuditActor`; Kotlin mirrors)
- `details?`: arbitrary JSON bag for context
- `createdAt`

**Not stored today:** hash chains, signatures, `correlationId` / `requestId`, model/prompt/RAG lineage for xChat (see gaps below).

## BFF (`ATXFINANCE_BACKEND_ORIGIN`)

When `proxyRequestToBackend` in `src/lib/backend-bff.ts` returns a `Response`, the **Next.js route body does not run**. Side effects that only exist in Next (e.g. Pub/Sub publish on recommendations) are skipped — see [`./api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md) § operational parity.

**Audit implication:** Mutations that move to Spring **must** write audit rows on the JVM for parity **when Next already wrote them** (e.g. access-request approve). The consolidation doc lists JVM status per effect; treat that table as the compliance checklist before enabling BFF in prod. **Admin nested portfolio** CRUD (recommendations, alerts, delivery-channels, portfolio tasks) did **not** emit `admin_audit_events` on Next either; BFF-on does not introduce a new audit gap vs Next for those routes.

## Retrieval parity (`GET /api/admin/audit`)

- **Next** `listAuditEvents` supports `actor` as a **case-insensitive regex** across `actor.email` and `actor.username`, plus exact `actor.userId` match (`repository.ts`).
- **Kotlin** `AdminAuditQueryService` matches `actor` with **exact** `userId`, `email`, or `username` (no regex). Operators filtering by partial email should prefer Next until aligned.

Document this difference in runbooks when debugging “missing” rows across environments.

## Tests (inventory)

| Area | Test file / location |
|------|----------------------|
| Next admin audit route (local path) | `tests/integration/admin-audit-route.test.ts` |
| Self-service access request + audit (incl. BFF short-circuit skips Next audit) | `tests/integration/self-access-request-route.test.ts` |
| BFF contract / Kotlin mapping smoke | `tests/smoke/backend-http-api-parity.test.ts` |
| Admin portfolio nested REST proxy short-circuit | `tests/integration/admin-portfolio-nested-rest-bff-proxy.test.ts` |
| `AuditEvent` type contract | `tests/unit/audit-event-contract.test.ts` |

**Gap (explicit):** No automated test proves **byte-for-byte** parity between Next and Spring audit **writes** for every migrated route; rely on code review + JVM integration tests when adding controllers.

## Gaps vs xdesign-review-audit skill

| Skill requirement | Status |
|-------------------|--------|
| Full decision replay (prompt, RAG chunks, tools, params) | **Not** in `admin_audit_events`; xChat paths need a dedicated inference log before claiming replay. |
| Tamper-evident logs (hash chain / signed) | **Not** implemented; MongoDB RBAC + backups only. |
| Correlation IDs end-to-end | **Partial** — forward `X-Request-Id` / trace context in BFF is **not** yet a contract (see `proxyRequestToBackend` — cookies only). |
| Policy trace (rule id + version per allow/deny) | **Partial** — product actions log `action` + `details`; no unified policy-version field. |
| Retention / legal hold | **Ops** — define in deployment policy, not enforced in app code here. |

## Related

- [atx-docs README](../README.md) — full docs index
- [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md) — BFF migration and side-effect parity
- [`atxfinance-backend-http-api.md`](./atxfinance-backend-http-api.md) — HTTP surface including admin audit
- [`.cursor/skills/atxdesign-review-audit/CHECKLIST.md`](../../.cursor/skills/atxdesign-review-audit/CHECKLIST.md) — reviewer checklist
