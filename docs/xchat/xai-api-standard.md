# xAI as the integration standard

atxFinance xChat, personas, RAG, batch jobs, and tool wiring are built against **xAI’s public API and documentation**. When product behavior or request/response shapes are ambiguous, **treat [xAI documentation](https://docs.x.ai/overview) as the source of truth** and align our routes (`src/lib/xai.ts`, `src/lib/xai-batch.ts`, `src/lib/xai-tools.ts`) with those contracts.

## Entry points

| Area | Purpose | Documentation |
|------|---------|----------------|
| **Overview** | API orientation, auth, base URLs | [Welcome to xAI Documentation](https://docs.x.ai/overview) |
| **Responses** | Multi-turn, tools, `function_call` / `function_call_output` | See API guides under [docs.x.ai](https://docs.x.ai/overview) (Responses / chat sections) |
| **Chat completions** | OpenAI-compatible chat + tool_calls | Same — xAI chat API docs |
| **Batch** | JSONL batch upload, polling, output files | [Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api) |
| **Collections / RAG** | `file_search`, collection ids, document search | e.g. [Collections Search tool](https://docs.x.ai/developers/tools/collections-search) |

## In this repo

- **Interactive xChat:** `POST /api/xchat/ask` → `respondWithXaiToolLoop` or `chatWithXai` (`src/lib/xai.ts`).
- **Batch:** `POST /api/xchat/batch` → `submitBatchJob` (`src/modules/xchat/batch-service.ts`) using the Batch API.
- **Tool schemas:** Persona `xapi.tools` are mapped to xAI request tools in `src/lib/xai-tools.ts` (hosted tools + `atxfinance` / `yahoo_finance` function tools).

If xAI changes field names, endpoints, or tool semantics, update implementation **and** this folder’s contracts (`atxfinance-tool-stub.md`, `xfeature-tools-plan.md`, [`xchat-tools-guide.md`](./xchat-tools-guide.md)) after verifying against the official docs.
