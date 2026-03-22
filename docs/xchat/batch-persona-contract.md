# Batch (KB-style) persona contract

Batch jobs use the **persona stored in the database** for prompt and tools. Nothing is hardcoded. Outbound requests follow the **[xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)**; see **[xAI as the integration standard](./xai-api-standard.md)** (entry: [docs.x.ai overview](https://docs.x.ai/overview)).

## Per batch item

- **System prompt:** Built with **`buildXchatSystemPrompt`** (`src/modules/xchat/xchat-prompt-build.ts`) — same locked order as ask: persona text (fallback `"You are a helpful assistant."` if empty) → RAG line or “No RAG context available.” → optional **`buildWorkspaceServerSnapshotBlock`** when `atxfinance` is in effective tools → **`buildSessionToolInstructions`** from effective tools (hosted search + workspace tool copy when those tools are present).
- **User prompt:** `persona.overridePrompt` (if any) + user message + **`appendXchatKbMetadata`** (same as `POST /api/xchat/ask`): resolved xAI collection ids (union of `xaiCollection`, `teamCollection`, tool `collection_ids`, optional user bootstrap when `includeUserBootstrapCollection`) plus enumerated persona tools. No env default KB collection id.
- **Tools:** Same effective pipeline as ask: `normalizePersonaXapiConfig` → `ensureSuperAgentDefaultTools` → `resolveXchatLinkedCollectionIds` → `withLinkedCollectionTools` → `mergeXchatHostedToolBaseline`, then `personaXapiToolsToXaiRequestTools` / `toXaiRequestTools` (`xai-tools.ts`). Batch is **single-shot** xAI Batch JSONL (no local `respondWithXaiToolLoop`); provider-side tool chains are best-effort.
- **RAG:** When `persona.enableRag` is not false and at least one resolved collection id exists, pre-search runs against that union and feeds the RAG segment of the system prompt (`resolveXchatLinkedCollectionIds`, `resolveOrCreateUserBootstrapCollection` when enabled).

Operators change behavior by editing the persona in Admin → Personas (system prompt, override prompt, tools, collection).

## See also

- [`xchat-tools-guide.md`](./xchat-tools-guide.md) — ask vs batch workflow
- [`xai-api-standard.md`](./xai-api-standard.md) — xAI standard + repo map
- `src/modules/xchat/batch-service.ts` — `submitBatchJob`
- `src/modules/xchat/batch-prompt-context.ts` — `appendXchatKbMetadata`
- `src/modules/xchat/xchat-prompt-build.ts` — `buildXchatSystemPrompt`, `buildSessionToolInstructions`
- [xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)
