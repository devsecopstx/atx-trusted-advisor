# Backlog & migration notes


- **TODO:** Restore `LoginProductPanel` on `/login` or fold plan tiers into registration / access-request flow (deferred).
- **TODO:** Google OAuth — add `/api/auth/google/login` + callback + env; enable the login page Google button when shipped.

### Tomorrow — admin portfolios & onboarding follow-ups

| Priority | Item | Notes |
|----------|------|--------|
| 1 | **Spring BFF parity** for `GET/POST /api/admin/portfolios`, `PATCH/DELETE /api/admin/portfolios/{id}`, nested accounts routes | **Current:** these routes are **Next-only** (no `proxyRequestToBackend`) so admin works when `ATXFINANCE_BACKEND_ORIGIN` is set. **Future:** add Kotlin handlers + proxy again if you want all admin traffic on Spring. Update `./atx-sre-ops/atxfinance-backend-http-api.md` and smoke parity when implemented. |
| 2 | **Accounts subpage** (`/admin/portfolios/[portfolioId]/accounts`) | Match **Save changes** batch pattern + resolve **friendly user / account** labels (parity with main admin portfolios table). |
| 3 | **Default portfolio validation** | Guardrail when a user has **multiple** portfolios: ensure **exactly one** `isDefault: true` (clear UX + server-side check; align with Mongo partial unique index). |
| 4 | **Audit trail** | Log admin portfolio create/update/delete (and optional CSV export) via existing `admin_audit_events` / audit pipeline — traceability for tenant moves. |

**Docs index:** [README.md](./README.md). Phase 1 multi-agent: [atx-xchat/atx-multi-agent.md](./atx-xchat/atx-multi-agent.md). BFF: [atx-sre-ops/api-consolidation-spring-backend.md](./atx-sre-ops/api-consolidation-spring-backend.md).

---

## Phase 1 — xChat → xStrategyBuilder multi-agent (next chunks)

**Canonical:** [atx-xchat/atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) (locked decisions) · [atx-multi-agent-design-loop.mmd](./atx-xchat/atx-multi-agent-design-loop.mmd) (flow). **Routing:** [context-routing-multi-agent-policy.md](./atx-xchat/context-routing-multi-agent-policy.md) · **BFF cutover:** [api-consolidation-spring-backend.md](./atx-sre-ops/api-consolidation-spring-backend.md).

Chunk work in this **order** so APIs exist before UI and observability: **Backend (orchestrator)** → **Backend (LLM + artifact)** → **SRE / platform** → **Frontend** → **Reviewer**. Subgraphs in the design-loop diagram map roughly: **orchestrator** → Chunk 1; **llm** + parse/handoff → Chunk 2; **ingress + scale + errors** → Chunk 3; **handoff UI** → Chunk 4; cross-cutting **Reviewer** → Chunk 5.

### Chunk 1 — Backend: orchestrator (state machine)

| Step | Deliverable | Design-loop anchor |
|------|-------------|-------------------|
| 1.1 | Mongo job model + indexes (`userId`, `emailAccountId`, `jobId` / `correlationId`, `step`, slots, status, idempotency fields) | Load job / session, Create job row |
| 1.2 | Spring API: create job, post user turn, read status; **hourly cap** + soft warn per `atx-multi-agent.md` | Slots complete?, Next prompt step, Persist step |
| 1.3 | Redis: hot keys + rate-limit counters scoped to isolation rules | Scale & safety (RL) |
| 1.4 | JVM tests (repository + controller); no Next dependency | — |

**Exit criteria:** Slot-filling loop works with mocked finalizer; idempotent retries safe on duplicate `Idempotency-Key` / hash.

**Shipped (initial):** Kotlin **`StrategyJobService`** + **`StrategyJobsController`** (`POST /api/strategy-jobs`, `GET /api/strategy-jobs/{jobId}`, `POST .../turns`), Mongo **`strategy_jobs`**, Mongo-count **hourly rate limit** + **24h idempotency** on `Idempotency-Key`, Next **BFF proxy** + **503** when backend off, **`StrategyJobServiceTest`**. **1.3 Redis** still open (optional hot-path optimization; caps work without it).

### Chunk 2 — Backend: LLM tier + artifact v1

| Step | Deliverable | Design-loop anchor |
|------|-------------|-------------------|
| 2.1 | Context bundle: retrieval vs tools vs multi-agent per policy; clamp `agent_count` | Route by intent, RAG / TOOL / MA |
| 2.2 | Async xAI call path by default; sync only behind product flag | POST ask / worker |
| 2.3 | Server-side **artifact v1** validation (Markdown + fenced JSON); **structured error codes** on parse failure (no silent generic chat) | Structured parse OK?, Clarify or retry |
| 2.4 | `bff-proxy-routes.ts` + `./atx-sre-ops/atxfinance-backend-http-api.md` + `tests/smoke/backend-http-api-parity.test.ts` | BFF-only traffic |

**Exit criteria:** Happy path produces a validated handoff payload + stable `jobId` / `correlationId`; failure paths return documented codes.

### Chunk 3 — SRE / platform

| Step | Deliverable | Design-loop anchor |
|------|-------------|-------------------|
| 3.1 | Env + secrets matrix for new services (Redis, optional queue); document in `DEVELOPMENT.md` | Ingress / tenancy |
| 3.2 | Observability: logs include `correlationId`, `jobId`, `personaId`, `effectiveModel`; **no raw PII** in operational logs | OBS |
| 3.3 | If p95 > SLO: queue / Pub/Sub **off HTTP thread** + retry policy (align with `atx-multi-agent.md` §3) | Queue / Pub/Sub |
| 3.4 | Per-tenant rate limits + plan caps enforced at edge of orchestrator; 401/403 fail-closed | RL, E401 |

**Exit criteria:** Staging runbook steps + how to trace a single `correlationId` through logs.

### Chunk 4 — Frontend

| Step | Deliverable | Design-loop anchor |
|------|-------------|-------------------|
| 4.1 | **xStrategyBuilder** — UI only: poll (or push) job status; render artifact; deep link `jobId` / `correlationId` | xStrategyBuilder handoff |
| 4.2 | **xChat** (optional): thin entry to start/resume a job — **no client-side orchestration state** | User message shell |
| 4.3 | Error UX mapped to backend codes (timeout, retry-safe, degrade) | errors subgraph |

**Exit criteria:** No strategy state duplicated in `localStorage`; loading/error/empty states reviewed (see `atxdesign-review` for Core MVP scope).

### Chunk 5 — Reviewer / governance

| Step | Deliverable | Notes |
|------|-------------|-------|
| 5.1 | OpenAPI / route parity | `generate-docs` + integration tests for new APIs |
| 5.2 | `atxdesign-review-audit` | Gaps vs replay/lineage documented; add `correlationId` on inference store if compliance requires |
| 5.3 | Product doc parity | `xchat-tools-guide.md`, `context-routing-multi-agent-policy.md`, this PLAN |

**Open question (resolve before `user_history_agent`):** The § *Phase: xChat chat_history → XAI collection (`user_history_agent`)* backlog below still assumes per-user bootstrap xAI collections; [atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) Phase 1 locks **TEAM_XAI + `XAI_TEAM_ID`** only — reconcile targets or defer that phase until policy allows per-user collection writes.

---

## SRE status (Mar 2025)

| Area | Status | Notes |
|------|--------|-------|
| **BFF frontend→backend** | ✅ Verified | Product portfolio/positions (and other listed) routes call `proxyRequestToBackend` first when origin is set; cookie forwarded; same-origin. **`/api/admin/portfolios/**` is intentionally Next-only** until Spring implements it. `BFF_PROXY_ROUTES` ↔ Kotlin parity in smoke tests for proxied paths. |
| **Auth / OAuth** | Next authoritative | OAuth callback (`/api/auth/x/callback`) on Next; Spring reads `xf_core_session`. Cutover to Spring callback deferred until API migration complete. See [auth-oauth-spring-dual-run.md](./atx-sre-ops/auth-oauth-spring-dual-run.md). |
| **Deploy** | See workflow | Current gates: `AGENTS.md` + [`.github/workflows/deploy-cloud-run.yml`](../.github/workflows/deploy-cloud-run.yml) (staging vs manual prod). |
| **CI gate** | ✅ Pass | Lint, typecheck, build, tests green. |

---

## Completed (refactor notes)


| Change                              | Files                                                           | Purpose                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client-safe team collection helpers | `team-xai-collection-sync.ts` (new), `team-xai-collection.ts`   | Client components (`xchat-conversation`, `types`) import from `-sync` (env read only). Server routes use `team-xai-collection` for `resolveTeamKbCollectionId`. Prevents Mongo in client bundle. |
| Tool definitions extraction         | `tool-definitions.ts` (new), `tool-executor.ts`, `xai-tools.ts` | `ATXFINANCE_TOOL_DEFINITION`, `YAHOO_FINANCE_TOOL_DEFINITION` live in `tool-definitions`; executor and `xai-tools` import. Keeps definitions usable without pulling Mongo.                       |
| PR5 RAG readiness (xChat gate) | `rag-file-readiness.ts` (`getScopeReadinessSummary`), `ask/route.ts`, `multi-source-context-orchestrator.ts`, `tests/unit/rag-team-kb-readiness-summary.test.ts` | Team KB gate uses **read-only** xAI management `GET /collections/{id}` via `resolveTeamKbCollectionId`; no Mongo `listRagFiles` for scope. Runs only when linked persona collections include team KB. Admin file inventory + polls remain `/admin/rag-files` + `pollRagFileReadiness`. |


---

## TEAM-only xAI: remove legacy collection paths

**Goal:** ~~Remove **`ATXFINANCE_COLLECTION_ID`**~~ (done). Remove **`userBootstrapCollectionId`** and per-user bootstrap xAI flows. **Anchor:** **`XAI_TEAM_ID`** (team UUID or `collection_*` KB id) for team collection append/retrieval; chat-history collections only under that team.

**Why:** Phase 1 is TEAM_XAI-only; legacy merges remain until this refactor.

### Touch points (audit before PR)


| Area               | Files / notes                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constants & types  | `src/modules/xchat/types.ts`                                                                                                                                                                         |
| Ask pipeline       | `src/app/api/xchat/ask/route.ts`                                                                                                                                                                     |
| Linked collections | `persona-linked-collections.ts`, `persona-validation.ts`, `multi-source-context-orchestrator.ts`, `batch-prompt-context.ts`, `batch-service.ts`                                                      |
| Collections API    | `src/app/api/xchat/collections/route.ts`                                                                                                                                                             |
| Admin / UI         | `src/app/api/admin/users/[userId]/settings/route.ts`, `src/app/xchat/ui/xchat-conversation.tsx`                                                                                                      |
| Defaults           | `src/modules/xchat/default-xpersonas.ts`                                                                                                                                                             |
| Tests              | `tests/integration/xchat-ask-route.test.ts`, `xchat-collections-route.test.ts`, `admin-user-settings-route.test.ts`, `tests/unit/persona-linked-collections.test.ts`, `batch-prompt-context.test.ts` |
| OpenAPI            | `src/lib/openapi/current-state*.ts` if semantics change                                                                                                                                              |


### Acceptance

- [x] No **`ATXFINANCE_COLLECTION_ID`** in app code (use **`XAI_TEAM_ID`** only).
- [ ] Linked-collection resolution uses **team + persona** only — no user-bootstrap branch.
- [ ] **`XAI_TEAM_ID`** where team xAI runs; integration tests green.
- [ ] `./atx-xchat/context-routing-multi-agent-policy.md` + `xchat-tools-guide.md` match shipped behavior.

### Risk

Users with docs only in legacy bootstrap collections may need migration or re-index under the team (define in PR).

---

## PR 5 — RAG-readiness migration (focused scope)

**Scope:** RAG-readiness only — not full RAG migration (RAG GET/POST, xAI upload, chunking are largely done on Spring + BFF).

**In scope:**

- `GET /api/rag/files/{fileId}/readiness` — poll `processingStatus`; expose `readiness` (ready, pending_embeddings, etc.).
- Scope-level blocking: `getScopeReadinessSummary` blocks collection search when any uploaded file is non-ready (`blocked_non_ready_files`).
- Persona link-files: block non-ready files from linking; label readiness in persona/collection UI.
- xChat ask + multi-source context: skip `collections_search` when `readiness.blocked`.

**Touch points:**

- `src/modules/xchat/rag-file-readiness.ts` — `evaluateRagFileReadiness`, `getScopeReadinessSummary`, `pollRagFileReadiness`.
- `src/app/api/rag/files/[fileId]/readiness/route.ts` — Next-only until Kotlin ships equivalent.
- `src/app/api/xchat/ask/route.ts` — readiness check before collection search.
- `src/modules/xchat/multi-source-context-orchestrator.ts` — `getScopeReadinessSummary` → `collectionSearchSkippedReason`.
- `src/app/api/personas/[personaId]/collection/link-files/route.ts` — `isRagFileReadyForSemanticSearch`.
- `src/app/admin/personas/ui/personas-console.tsx` — file list + readiness labels.
- `persona-collection-routes.test.ts` — blocked files, readiness labels.
- `.cursor/skills/atx-skill-xchat-validation-checklist/SKILL.md` — step 7 (RAG readiness lifecycle).

**Out of scope (already done or separate):** RAG GET/POST on Spring, xAI file upload pipeline, chunking, `xai_collections` inventory.

---

## Phase: xChat chat_history → XAI collection (user_history_agent)

**Goal:** Store xchat conversation turns in a MongoDB collection and sync them to each user’s xAI collection via a scheduled task **`user_history_agent`**, so user chat history can be used for retrieval (collections_search) and context.

### Scope

- **Mongo collection:** Store chat turns (prompt + response pairs) per user in `xchat_logs` (keyed by userId, TTL via `retentionExpiresAt`).
- **Scheduled task:** Add task category/runner **`user_history_agent`** — on schedule (e.g. hourly), read recent turns from Mongo, format as documents, and append to the user’s xAI collection (the one exposed as `user_history` in `GET /api/xchat/collections`).
- **Integration:** Uses existing `resolveOrCreateUserBootstrapCollection` / `getUserBootstrapCollectionByUserId` for the per-user xAI collection target.

### Touch points (audit before PR)


| Area         | Files / notes                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mongo schema | `xchat_logs` — (userId, message, response, personaName, model, scope, createdAt, xaiSyncedAt, xaiTurnFileId, xaiTurnPayloadHash, retentionExpiresAt). |
| Ask pipeline | Ensure turns are written to Mongo after each `/api/xchat/ask` response (or confirm existing flow).                                                      |
| Task runner  | Add `user-history` category; implement `user_history_agent` runner in `task-runner.ts` (Next) and `AdminScheduledTasksService.kt` (Kotlin when BFF on). |
| Admin tasks  | Extend `category` enum to include `user-history`; add to `tasks-console.tsx`, OpenAPI.                                                                  |
| xAI API      | Use `addFileToXaiCollection` or equivalent to append formatted history to user collection.                                                              |


### Acceptance

- Mongo collection stores chat turns; schema documented.
- Scheduled task `user_history_agent` syncs Mongo turns → xAI user collection.
- User’s `user_history` collection in xchat includes synced turns for retrieval.
- Integration tests for task execution (mocked xAI append).

### Out of scope

- Real-time sync (task-based only); xChat streaming BFF migration.

### Audit gaps (xdesign-review-audit)

| Gap | Status | Uplift |
| --- | ------ | ------ |
| Full inference lineage (model, params, tool calls) | Not stored | Add `model`, `personaId`, `correlationId` to `xchat_logs` schema if regulatory replay required. |
| Tamper-evident logs | Not implemented | `xaiTurnPayloadHash` stored on sync; no hash chain. See `./atx-sre-ops/audit-lineage-and-controls.md`. |
| Task run audit | Partial | `user_history_agent` logs output; no `admin_audit_events` row per run. Optional: emit `task_run_completed` audit row. |
| Retention | Implemented | `xaiTurnRetentionExpiresAt` + `retentionExpiresAt` TTL on `xchat_logs`; policy in ops. |

**Note:** Implementation uses `xchat_logs` (not `xchat_history`); schema matches PLAN touch points.

---

## Deferred

- xChat streaming on Spring + BFF (`./atx-sre-ops/api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts (v2 — `atx-multi-agent.md`).

