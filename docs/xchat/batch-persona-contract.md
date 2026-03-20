# Batch (KB-style) persona contract

Batch jobs use the **persona stored in the database** for prompt and tools. Nothing is hardcoded.

## Per batch item

- **System prompt:** `persona.systemPrompt`; if missing or empty, fallback is the generic string `"You are a helpful assistant."` (no product-specific text).
- **User prompt:** `persona.overridePrompt` (if any) + user message + appended metadata block (default collection id, persona RAG collection, list of persona tools for context).
- **Tools:** `persona.xapi.tools` from DB, minus `atxfinance` (not executed in batch API). So `web_search`, `x_search`, `file_search` / `collections_search` are included only when configured on the persona.
- **RAG:** When `persona.enableRag` is not false and `persona.xaiCollection.collectionId` is set, collection pre-search runs and context is injected into the system prompt.

Operators change behavior by editing the persona in Admin → Personas (system prompt, override prompt, tools, collection).

## See also

- `src/modules/xchat/batch-service.ts` — `submitBatchJob`
- `src/modules/xchat/batch-prompt-context.ts` — prompt augmentation (tool list, collection id)
- [xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)
