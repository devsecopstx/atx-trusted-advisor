# Backlog & migration notes

Engineering backlog (not a release blocker unless you close an item). Phase 1 multi-agent rules: [`xchat/atx-multi-agent.md`](./xchat/atx-multi-agent.md). BFF: [`ops/api-consolidation-spring-backend.md`](./ops/api-consolidation-spring-backend.md).

---

## TEAM-only xAI: remove legacy collection paths

**Goal:** Remove **`ATXFINANCE_COLLECTION_ID`**, **`userBootstrapCollectionId`**, and per-user bootstrap xAI flows. **Anchor:** **`XAI_TEAM_ID`** (1:1 tenant) for team collection append/retrieval; chat-history collections only under that team.

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

- [ ] No **`ATXFINANCE_COLLECTION_ID`** in app code (docs/scripts updated or removed).
- [ ] Linked-collection resolution uses **team + persona** only — no user-bootstrap branch.
- [ ] **`XAI_TEAM_ID`** where team xAI runs; integration tests green.
- [ ] `docs/xchat/context-routing-multi-agent-policy.md` + `xchat-tools-guide.md` match shipped behavior.

### Risk

Users with docs only in legacy bootstrap collections may need migration or re-index under the team (define in PR).

---

## Deferred

- xChat streaming on Spring + BFF (`docs/ops/api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts (v2 — `atx-multi-agent.md`).
