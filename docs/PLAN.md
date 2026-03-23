# Backlog & migration notes

**Docs index:** [`README.md`](./README.md). Phase 1 multi-agent: [`xchat/atx-multi-agent.md`](./xchat/atx-multi-agent.md). BFF: [`ops/api-consolidation-spring-backend.md`](./ops/api-consolidation-spring-backend.md).

---

## Completed (refactor notes)

| Change | Files | Purpose |
|--------|-------|---------|
| Client-safe team collection helpers | `team-xai-collection-sync.ts` (new), `team-xai-collection.ts` | Client components (`xchat-conversation`, `types`) import from `-sync` (env read only). Server routes use `team-xai-collection` for `resolveTeamKbCollectionId`. Prevents Mongo in client bundle. |
| Tool definitions extraction | `tool-definitions.ts` (new), `tool-executor.ts`, `xai-tools.ts` | `ATXFINANCE_TOOL_DEFINITION`, `YAHOO_FINANCE_TOOL_DEFINITION` live in `tool-definitions`; executor and `xai-tools` import. Keeps definitions usable without pulling Mongo. |

---

## TEAM-only xAI: remove legacy collection paths

**Goal:** ~~Remove **`ATXFINANCE_COLLECTION_ID`**~~ (done). Remove **`userBootstrapCollectionId`** and per-user bootstrap xAI flows. **Anchor:** **`XAI_TEAM_ID`** (team UUID or `collection_*` KB id) for team collection append/retrieval; chat-history collections only under that team.

**Why:** Phase 1 is TEAM_XAI-only; legacy merges remain until this refactor.

### Touch points (audit before PR)

| Area | Files / notes |
|------|----------------|
| Constants & types | `src/modules/xchat/types.ts` |
| Ask pipeline | `src/app/api/xchat/ask/route.ts` |
| Linked collections | `persona-linked-collections.ts`, `persona-validation.ts`, `multi-source-context-orchestrator.ts`, `batch-prompt-context.ts`, `batch-service.ts` |
| Collections API | `src/app/api/xchat/collections/route.ts` |
| Admin / UI | `src/app/api/admin/users/[userId]/settings/route.ts`, `src/app/xchat/ui/xchat-conversation.tsx` |
| Defaults | `src/modules/xchat/default-xpersonas.ts` |
| Tests | `tests/integration/xchat-ask-route.test.ts`, `xchat-collections-route.test.ts`, `admin-user-settings-route.test.ts`, `tests/unit/persona-linked-collections.test.ts`, `batch-prompt-context.test.ts` |
| OpenAPI | `src/lib/openapi/current-state*.ts` if semantics change |

### Acceptance

- [x] No **`ATXFINANCE_COLLECTION_ID`** in app code (use **`XAI_TEAM_ID`** only).
- [ ] Linked-collection resolution uses **team + persona** only — no user-bootstrap branch.
- [ ] **`XAI_TEAM_ID`** where team xAI runs; integration tests green.
- [ ] `docs/xchat/context-routing-multi-agent-policy.md` + `xchat-tools-guide.md` match shipped behavior.

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

- **Mongo collection:** Store chat turns (prompt + response pairs) per user in a collection (e.g. `xchat_history` or `xchat_turns`), keyed by userId.
- **Scheduled task:** Add task category/runner **`user_history_agent`** — on schedule (e.g. hourly), read recent turns from Mongo, format as documents, and append to the user’s xAI collection (the one exposed as `user_history` in `GET /api/xchat/collections`).
- **Integration:** Uses existing `resolveOrCreateUserBootstrapCollection` / `getUserBootstrapCollectionByUserId` for the per-user xAI collection target.

### Touch points (audit before PR)

| Area | Files / notes |
|------|----------------|
| Mongo schema | New collection; define `xchat_history` / `xchat_turns` schema (userId, turnId, prompt, response, createdAt, metadata). |
| Ask pipeline | Ensure turns are written to Mongo after each `/api/xchat/ask` response (or confirm existing flow). |
| Task runner | Add `user-history` category; implement `user_history_agent` runner in `task-runner.ts` (Next) and `AdminScheduledTasksService.kt` (Kotlin when BFF on). |
| Admin tasks | Extend `category` enum to include `user-history`; add to `tasks-console.tsx`, OpenAPI. |
| xAI API | Use `addFileToXaiCollection` or equivalent to append formatted history to user collection. |

### Acceptance

- [ ] Mongo collection stores chat turns; schema documented.
- [ ] Scheduled task `user_history_agent` syncs Mongo turns → xAI user collection.
- [ ] User’s `user_history` collection in xchat includes synced turns for retrieval.
- [ ] Integration tests for task execution (mocked xAI append).

### Out of scope

- Real-time sync (task-based only); xChat streaming BFF migration.

---

## Deferred

- xChat streaming on Spring + BFF (`docs/ops/api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts (v2 — `atx-multi-agent.md`).
