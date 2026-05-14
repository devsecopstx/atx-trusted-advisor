# xChat tools & prompt workflow

**Audience:** engineers and **xDesign Review** (`.cursor/skills/xdesign-review/SKILL.md`).

**Standard:** [xAI docs](https://docs.x.ai/overview) — [`xai-api-standard.md`](./xai-api-standard.md).

**Code map:** `ask/route.ts`, `ask/stream/route.ts`, `xchat-prompt-build.ts`, `batch-prompt-context.ts`, `batch-service.ts`, `lib/xai.ts`, `lib/xai-responses-stream.ts`, `lib/xai-tools.ts`, `lib/xchat-live-sse-policy.ts`, `tool-executor.ts`, `tool-definitions.ts`, `team-xai-collection-sync.ts`, `workspace-snapshot-for-prompt.ts`.

**UI (assistant bubbles):** `xchat-markdown-body.tsx` — `react-markdown` + `remark-gfm` + `rehype-sanitize`, Prism **oneDark** for fenced code, `preprocessXchatMarkdown` (`xchat-markdown-preprocess.ts`) for light cleanup before render.

---

## Flow (interactive ask)

```mermaid
flowchart TD
  A["POST /api/xchat/ask"] --> B["Persona + effective tools\nnormalize → Super-Agent defaults → persona-linked ids → withLinked"]
  B --> C["RAG: persona-linked TEAM xAI collections then Mongo scope"]
  C --> D["buildXchatSystemPrompt\n(stable: tenant → persona system → persona override → session tools → routing → citations → beta;\nvolatile: RAG → history → workspace snapshot)"]
  D --> E["User: live message + appendXchatKbMetadata"]
  E --> F["respondWithXaiToolLoop /v1/responses\n(prompt_cache_key per thread)"]
```

- **Effective tools:** ask uses the persona tool config plus `ensureSuperAgentDefaultTools` where applicable. `mergeXchatHostedToolBaseline` is compatibility glue and must not be treated as an unconditional hosted-tool injector.
- **Runtime Finance KB:** ask and batch prepend the canonical **Finance** collection (`XAI_FINANCE_COLLECTION_ID`; finance/options/portfolio/strategy prompts pin to that id only). Persona-declared extras (`xaiCollection`, `teamCollection`, tool `collection_ids`) may add at most one additional id (max 2 total). `XAI_TEAM_ID` remains for admin discovery; it is not auto-merged into ask grounding.
- **Ask execution:** Always `respondWithXaiToolLoop` (not chat-completions). Batch stays **single-turn** xAI Batch JSONL — same **prompt** builders, different **transport**.

---

## Live token SSE (interactive ask)

**Goal:** Stream **partial assistant text** and **tool-phase markers** while the multi-turn Responses **tool loop** runs, without changing the **final** client contract: the SSE **`done`** event carries the **same `data` object** as `POST /api/xchat/ask` JSON (**`content`**, **`metadata`**, **`interactionMeta`**, **`toolCalls`**, usage snapshot fields, etc.).

| Topic | Behavior |
|--------|-----------|
| **Wire** | When `streamHooks.onTextDelta` is set, `lib/xai.ts` sends **`stream: true`** to xAI **`POST /v1/responses`** per loop turn; `consumeXaiResponsesSse` parses SSE chunks (`response.output_text.delta`, Chat-style `choices[].delta`, etc.). If streaming yields no usable terminal payload, the turn **falls back** to non-streaming JSON (dual-run safe). |
| **Headers** | `onProviderHeaders` forwards **`x-grok-conv-id`** and best-effort cache hints into SSE **`provider`** events (`promptCache` when present). |
| **Mid-stream tools** | Parsed SSE objects feed **`onResponsesStreamEvent`** → summarized **`tool_status`** lines (`upstream` phase + vendor `streamType` + optional **`name`**). Local parallel tools emit **`tool_status`** with **`local_complete`** after each batch (same timing as `xchat_ask_tool_batch` debug). |
| **Next routes** | **`POST /api/xchat/ask`** with **`Accept: text/event-stream`** runs the live pipeline (`createXchatLiveSseReadableStream`). Optional **`XCHAT_STREAM_INTERNAL_SECRET`** requires header **`x-xchat-stream-internal`** for that mode (server delegates add it). **`XCHAT_LIVE_SSE_ENABLED=false`** disables live SSE (JSON only). **`POST /api/xchat/ask/stream`** BFF-forwards the browser stream to Spring when the product BFF gate is on; set **`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** to keep in-process Next streaming. |
| **UI** | **`NEXT_PUBLIC_XCHAT_LIVE_SSE`** — client uses **`/api/xchat/ask/stream`**, consumes **`delta`** / **`tool_status`** / **`ping`** (stall watchdog ~90s), one retry on transport failure, then finalizes from **`done`**. |

---

## Prompt assembly (locked)

| Layer | Builder | Notes |
|--------|---------|--------|
| System (`instructions`) | `buildXchatSystemPrompt` | **Stable prefix first** (xAI prompt caching): optional tenant → persona `systemPrompt` → persona `overridePrompt` → `buildSessionToolInstructions` → routing blurb → citation policy → beta UI copy. **Volatile suffix:** RAG block → optional recent history → user workspace summary → workspace snapshot. |
| User (`input`) | `appendXchatKbMetadata` + live caption | Persona override text is **not** duplicated here (moved into `instructions` for cacheable prefix alignment). Same KB suffix pattern for ask and batch. |
| xAI routing | `respondWithXaiToolLoop` | Sends **`prompt_cache_key`** on **every** `/v1/responses` HTTP round-trip when `threadId` is known (including tool-loop continuations and `previous_response_id` chains) — same semantics as **`x-grok-conv-id`** per [xAI prompt caching](https://docs.x.ai/docs/advanced-api-usage/prompt-caching). `instructions` are only sent when **not** using `previous_response_id`. |
| Tools wire | `personaXapiToolsToXaiRequestTools` → `toXaiRequestTools(..., { forXaiResponsesApi: true })` | **`/v1/responses`** expects **flat** function tools (`type`, `name`, `parameters` at root). OpenAI-style nesting under `function` causes **422** and the request never runs hosted **web_search** / **x_search**. Chat Completions uses `toXaiRequestTools` without the flag (nested shape). |

**Model (ask):** persona `model`, else `XAI_CHAT_MODEL` or **`grok-4-1-fast-reasoning`** (`getDefaultPersonaChatModelId` in `ask/route.ts`); optional `reasoningEffort` for multi-agent ids only.

**Continuity mode (ask):**

- `XCHAT_USE_REMOTE_HISTORY=true` (preferred): use xAI hosted state via `store_messages` + `previous_response_id`.
- unset / `false`: no cross-turn continuity is injected.
- Mongo logs are still written for audit/debug/UI rails; they are not injected into ask prompts.

**Workspace portfolio scope (ask):** optional JSON **`portfolioId`** (24-char hex, user-owned) on `POST /api/xchat/ask` and optional **`/xchat?portfolioId=`** on the page load — both feed `workspacePortfolioId` into `loadWorkspaceSnapshotPreload` / `createXfinanceToolExecutor` so watchlist and positions match **`/watchlist?portfolioId=`**. Watchlist symbol JSON includes **`spotPriceDisplay`**, **`targetEntryNotional100xUsdDisplay`** (USD **`$…`** for the **100×** notional), legacy **`targetEntryNotional100xDisplay`** (plain digits), and desk **`targetEntryDisplay`** / **`entryPrice`**. The direct **“show my watchlist”** path formats **Spot** + **Target entry** in USD and skips added-at lines.

---

## Tool routing (ask)

| | |
|--|--|
| Path | `respondWithXaiToolLoop` + local executor when persona has `atxfinance` / `yahoo_finance`; stub for hosted-only. |
| Recovery | Synthetic / `previous_response_id` handling in `lib/xai.ts` — see [`xfeature-tools-plan.md`](./xfeature-tools-plan.md), [`atxfinance-tool-stub.md`](./atxfinance-tool-stub.md). |

**Marker → wire:** `atxfinance` / `yahoo_finance` → function schemas (flattened for Responses); `collections_search` → `file_search` + `vector_store_ids`; hosted types via `toXaiRequestTools`. Hosted tool **calls** are satisfied on xAI’s side; the loop acks `web_search` / `x_search` / `file_search` with `{}` (and defensively handles `collections_search` if emitted) in `lib/xai.ts`.

### Engine-grounded recommendations (PLAN 707)

`atx_function.strategy_recommendations` is the first engine-grounded xChat bridge:

- Next keeps ownership of `POST /api/xchat/ask`, persona resolution, live SSE, logs, and usage metering.
- The local tool executor validates `symbols`, `outlook`, `risk`, and `horizonDays`, then calls Spring `POST /api/strategy-recommendations/generate` with the signed session cookie when `ATXFINANCE_BACKEND_ORIGIN` is set.
- Spring owns the deterministic `OptionsStrategyEngine.generateRecommendations(...)` call and returns compact structured JSON (`recommendations`, `source`, `chainSources`, `generatedAt`, `correlationId`).
- If the backend or chain data is unavailable, the tool returns `engine_unavailable` / `invalid_strategy_context`; xChat should not invent legs, scores, or risk/reward values outside the tool JSON.

---

## Batch (`POST /api/xchat/batch`)

Jobs use the **persona from the database** (Admin → Personas); nothing is hardcoded server-side except the shared builders below. Transport: **[xAI Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)** via `submitBatchJob` in `batch-service.ts`.

| | |
|--|--|
| System / user | Same as ask: `buildXchatSystemPrompt`, `appendXchatKbMetadata`, and the same effective-tool pipeline ending in `personaXapiToolsToXaiRequestTools` → `toXaiRequestTools`. |
| Execution | **Single-shot** JSONL per item — **no** local `respondWithXaiToolLoop`; provider-side tool chains are best-effort. |
| RAG | If `enableRag !== false` and `resolveXchatPersonaDeclaredCollectionIds` returns ids (persona `xaiCollection` / `teamCollection` / tool `collection_ids` only — no env team KB merge; max 2), pre-search feeds the RAG segment; `withLinkedCollectionTools(..., "replace")` matches ask (no merge of long persona tool `collection_ids`). |

**Modules:** `batch-service.ts`, `batch-prompt-context.ts`, `xchat-prompt-build.ts`.

---

## Multi-source orchestrator (Phase A)

`multi-source-context-orchestrator.ts` — parallel gather + optional synthesis; **not** wired to `POST /api/xchat/ask`. xAI collection search uses `resolveXchatPersonaDeclaredCollectionIds` (same cap as ask).

---

## Review checklist

- [ ] This file if prompt order or ask routing changes.
- [ ] OpenAPI overrides if `/api/*` contract changes.
- [ ] `npm run ci:gate` (and `npm run build` if deploy-sensitive).

## Related

[`xai-api-standard.md`](./xai-api-standard.md) · [`atxfinance-tool-stub.md`](./atxfinance-tool-stub.md) · [`xfeature-tools-plan.md`](./xfeature-tools-plan.md) · [`xchat-debug-logging.md`](./xchat-debug-logging.md)
