---
id: atx-xchat-validation-checklist
name: atx-xchat-validation-checklist
description: Run a repeatable xChat validation checklist across local and staging without deployment or infra mutation.
---

# atxFinance xChat Validation Checklist

## Goal

Verify xChat behavior, persona wiring, and retrieval/fallback outcomes with reproducible checks.

## Use This Skill When

- Validating xChat after route, persona, or tool configuration changes.
- Confirming local and staging behavior parity.
- Producing a pre-merge confidence report for xChat flows.

## Inputs

- `AGENTS.md` quick health checks and validation gates
- `tests/integration/xchat-ask-route.test.ts`
- `src/app/api/xchat/ask/route.ts`
- `src/modules/xchat/repository.ts` (`resolveDefaultXchatPersonaForSession`, `ensureDefaultTrustedAdvisorPersonaExists`)
- `src/modules/xchat/default-xpersonas.ts`
- Persona configuration from `/api/personas` (directory vs xChat default persona are separate: xChat does not use client-selected `personaId`)

## Validation Checklist

1. Confirm baseline endpoints are healthy (`/api/health`, `/api/personas`).
2. Validate xChat ask with **global_admin** (expects resolved **Super-Agent** — keep this persona **published**; **503** if missing).
3. Validate xChat ask with a **non-admin** session (expects resolved **atx-trusted-advisor** — keep **published** in prod; auto-created on first ask only if still absent).
4. Validate context source behavior (`xai_collection`, `mongo_scope`, `none`).
5. Validate provider failure path (`502` with retryable metadata).
6. Validate persona tool constraints (`file_search` / `collections_search` require `xaiCollection.collectionId` on create/update payloads per `persona-validation.ts`).
7. Validate RAG readiness lifecycle: uploaded files surface `processingStatus`; poll `GET /api/rag/files/:fileId/readiness`; ensure non-ready files are labeled/blocked from collection-link and xChat collection retrieval until status is `complete`/`skipped`.
8. Validate execution-path lock for ask hotfix: `/api/xchat/ask` uses a single `respondWithXaiToolLoop` flow (no chat-completions fallback) to reduce live-search drift.
9. Validate model policy: default ask model when persona omits `model` is **`XAI_CHAT_MODEL`** or **`grok-4-1-fast-reasoning`**; persona may pin `grok-4.20-multi-agent` / `grok-4.20-multi-agent-0309`; `reasoningEffort` is accepted only for those multi-agent ids.

## Guardrails

- Do not deploy or reroute traffic.
- Do not mutate production secrets or key material.
- Prefer read-only verification before any write operations.

## Expected Output

- Pass/fail checklist with reproducible commands.
- Root-cause hints separated by layer: UI, API, provider, config.
