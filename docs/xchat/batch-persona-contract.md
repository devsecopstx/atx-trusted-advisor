# Batch (KB-style) persona contract

Batch jobs use the **persona stored in the database** for prompt and tools. Nothing is hardcoded. Outbound requests follow the **[xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)**; see **[xAI as the integration standard](./xai-api-standard.md)** (entry: [docs.x.ai overview](https://docs.x.ai/overview)).

## Per batch item

- **System prompt:** `persona.systemPrompt`; if missing or empty, fallback is the generic string `"You are a helpful assistant."` (no product-specific text). When the persona includes `atxfinance`, a **server-loaded workspace snapshot** (portfolio, accounts, watchlist, capped positions preview) is appended before tool instructions — same helper as interactive ask (`buildWorkspaceServerSnapshotBlock`). **`ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`** / **`HOSTED_SEARCH_SESSION_TOOL_INSTRUCTIONS`** are appended when the persona includes `atxfinance` or `web_search` / `x_search`, matching interactive ask (`default-xpersonas.ts`).
- **User prompt:** `persona.overridePrompt` (if any) + user message + appended metadata block (**resolved** xAI collection ids — union of `xaiCollection.collectionId`, optional `teamCollection.collectionId`, tool `collection_ids`, and optional **user bootstrap** when `includeUserBootstrapCollection` is true — plus list of persona tools). **`POST /api/xchat/ask` appends the same block** (`buildBatchUserPromptAugmentation`) so interactive xChat and batch items see identical KB-style hints. No env default KB collection id is injected.
- **Tools:** Full `persona.xapi.tools` from DB, expanded the same way as xChat ask: `atxfinance` / `yahoo_finance` markers become xAI `function` tool schemas (`personaXapiToolsToXaiRequestTools` in `src/lib/xai-tools.ts`). Hosted tools (`web_search`, `x_search`, `file_search`) pass through or map from `collections_search`. Batch runs as **single-shot** xAI Batch requests (no local `respondWithXaiToolLoop`); whether xAI completes multi-turn tool execution for custom functions inside a batch item depends on the provider — the request payload now matches persona configuration so models see the same tool surface as interactive ask when tools are enabled.
- **RAG:** When `persona.enableRag` is not false and at least one resolved collection id exists (`xaiCollection`, `teamCollection`, tool ids, and/or user bootstrap when enabled), pre-search runs against **that union** and context is injected into the system prompt (same id set as ask via `resolveXchatLinkedCollectionIds` in `persona-linked-collections.ts`). Batch resolves the user bootstrap collection when `includeUserBootstrapCollection` is true (`resolveOrCreateUserBootstrapCollection`).

Operators change behavior by editing the persona in Admin → Personas (system prompt, override prompt, tools, collection).

## See also

- [`xchat-tools-guide.md`](./xchat-tools-guide.md) — ask vs batch prompt/tool workflow (mermaid)
- [`xai-api-standard.md`](./xai-api-standard.md) — xAI docs as the standard + repo map
- `src/modules/xchat/batch-service.ts` — `submitBatchJob`
- `src/modules/xchat/batch-prompt-context.ts` — prompt augmentation (tool list, collection id)
- [xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)
