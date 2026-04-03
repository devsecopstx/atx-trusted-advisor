# xChat and Personas Guide

This is the xChat/persona entrypoint. It summarizes operational behavior and links to the canonical deep docs.

## Deep-dive docs

- `atx-docs/xchat/xchat-tools-guide.md` (tool-loop, routing, prompt assembly)
- `atx-docs/xchat/xchat-debug-logging.md` (debug log taxonomy and safety)
- `atx-docs/xchat/xai-api-standard.md` (xAI API shape and mapping)
- `atx-docs/xchat/atxfinance-tool-stub.md` (current atxfinance tool contract)
- `atx-docs/rag-collection/README.md` (RAG source tree and ingest conventions; logical path tags still use `atx-rag-collection/…` in file headers)

## xChat API surface

- `POST /api/xchat/ask` — success `data` includes `logId`, `model`, collection search metadata, and optional **`xaiUsage`** (token counts) when xAI returns usage; see OpenAPI `XChatAskResponseData` and `/xchat` Persona rail **Status** for client display.
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

## Persona resolution policy

`POST /api/xchat/ask` resolves the effective persona after session defaults, optional **`personaId`** in the JSON body, and **`admin_user_settings.assignedPersonaId`**.

- **Sidebar / body `personaId`:** When effective tenant workspace limits have **`changePersonaEnabled: true`** (see `atx-docs/sre-ops/tenant-workspace-limits.md`) or the session is **`global_admin`**, the requested **`personaId`** is preferred over **`assignedPersonaId`** when both differ. When **`changePersonaEnabled`** is **false** for app users, only the assigned persona is used (body `personaId` ignored for switching).
- **Role defaults** still apply for directory access (`canSessionUsePersona`), published vs draft, and Super-Agent gating for non-admin personas.
- If the default persona row is missing in edge cases, the route may fail with operator guidance (503 path). Explicit seeding is preferred for consistency.

Implementation: `src/app/api/xchat/ask/route.ts`.

## Persona governance lifecycle

Persona statuses:

- `draft`
- `published`
- `archived`

Supported lifecycle actions:

- publish (version snapshot + publish timestamp)
- archive (snapshot + hidden from non-admin directory)
- rollback (restore from prior version snapshot)

All governance actions should emit audit events.

## Plan limits and cost controls

Plan limits are defined in `src/modules/xchat/plan-limits.ts` and include:

- prompts/hr (billing copy; see `plan-limits` + ask route for enforcement window)
- max turns
- max tool calls
- batch availability and limits
- monthly budget controls
- model escalation thresholds

Tool cache is implemented in `src/modules/xchat/tool-cache.ts`.

## Collection and RAG notes

- Collection inventory endpoints: `GET /api/personas/collections` and `GET /api/personas/collections/:collectionId`
- Collection stats may include `documentCount`, `chunkCount`, `fileCount`, `indexStatus`
- Management operations require `XAI_MANAGEMENT_API_KEY`

## Seed and default verification

After `npm run seed:admin`, verify:

1. default admin user and default tenant are present
2. default persona rows exist and are published as intended
3. default portfolio/account/watchlist records exist
4. xAI verification checks pass when keys are present

## Batch KB workaround

For batch workflows where direct KB retrieval is not available:

1. pre-search collections (`documents/search`)
2. inject snippets into each batch JSONL item
3. submit enriched batch request

## Upload and attach workflow

To use files inside a collection:

1. upload file with `XAI_API_KEY`
2. attach file to collection with `XAI_MANAGEMENT_API_KEY`

Keep this two-step process in runbooks and ops scripts to avoid partial ingest confusion.

For release/deploy controls around xChat runtime secrets and environment parity, use `atx-docs/guides/deploy-and-ops.md`.
