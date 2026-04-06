# xChat tool: workspace / `atx_function` (runtime contract; citations: `atxfinance`)

## Status

**Integration standard:** xAI’s HTTP **Responses** API and docs ([overview](https://docs.x.ai/overview)) — see `[xai-api-standard.md](./xai-api-standard.md)`.

**Shipped** for `POST /api/xchat/ask` when the resolved persona’s `xapi.tools` include **`atx_function`** (persona marker and xAI wire function name; **no** server-side injection for app roles or persona name — configure the marker in Admin → Personas). Product copy and citation chips may still say **atxfinance** / `XF_CITE:atxfinance` for the same tool. **Ask route:** live workspace state is **not** bulk-injected into the system prompt. `[createXfinanceToolExecutor](../../src/modules/xchat/tool-executor.ts)` receives `workspaceLazyLoad` (`userId`, `tenantId`, optional **`workspacePortfolioId`** from the ask body’s **`portfolioId`**) and the same optional **`workspacePortfolioId`** at top level so snapshot/watchlist ops resolve the **active workspace portfolio** (owned id only; otherwise Mongo default). On the **first** same-request tool call among **`portfolio_summary`**, **`account_health`**, **`positions_snapshot`**, or **`watchlist_snapshot`**, it runs `[loadWorkspaceSnapshotPreload](../../src/modules/xchat/workspace-snapshot-for-prompt.ts)` (Mongo + optional Redis/in-process cache keyed by `userId`, `tenantId`, resolved `portfolioId`, and `portfolio.workspaceContentRev`) and short-circuits those ops from memory until **`watchlist_add_symbols` / `watchlist_remove_symbols`** invalidate preload for the rest of the turn. Other ops (e.g. **`market_quote`**) skip that load until a short-circuit op runs. Session tool copy tells the model to use **`atx_function`** for portfolio facts. **xChat batch** still uses `[loadWorkspaceSnapshotPreload]` + `[formatWorkspaceServerSnapshotBlock](../../src/modules/xchat/workspace-snapshot-for-prompt.ts)` when the persona includes **`atx_function`** (no local tool loop in batch JSONL).

Execution lives in `[src/modules/xchat/tool-executor.ts](../../src/modules/xchat/tool-executor.ts)` behind the xAI **Responses** tool loop (`[respondWithXaiToolLoop](../../src/lib/xai.ts)`). If persona `xapi.mode` is `chat_completions` but **`atx_function`** or `yahoo_finance` is present, the ask route still uses that loop so custom tools run server-side. If the model returns assistant **text** with JSON `operation` / `"tool":"atx_function"` (or legacy `"atxfinance"`), fenced JSON code blocks, or XML-style `<function_call name="atx_function">…</function_call>` blocks (inner body may be **legacy `<argument>` tags** or a **single JSON object** with `operation` plus optional `symbol` / `symbols`), the loop **parses and runs** those operations and continues the conversation. Portfolio reads use the same **tenant scope** as other admin collections (legacy rows without `tenantId` remain visible).

**Cache invalidation:** `[bumpPortfolioWorkspaceContentRev](../../src/modules/core-admin/repository.ts)` increments `workspaceContentRev` on the portfolio document when positions, accounts, watchlist, or relevant portfolio fields change so snapshot cache keys miss. TTL: `REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS` (default 120s; see `.env.example`).

## See also

- `[xchat-tools-guide.md](./xchat-tools-guide.md)` — full ask prompt/tool pipeline (diagrams)

## Security

- **Session scope only:** the executor receives `userId` and `tenantId` from the authenticated session. **Do not** accept or trust a client-supplied user id for these reads or mutations.
- **Reads** hit Mongo (`portfolio_*` collections via `[src/modules/core-admin/repository.ts](../../src/modules/core-admin/repository.ts)`). `**watchlist_add_symbols` / `watchlist_remove_symbols`** call `**mutatePortfolioWatchlistSymbols**` for the user’s **default portfolio** only (same path as `PATCH /api/portfolios/:id/watchlist`). No credentials or deploy actions.

## Exposed operations

Single custom function tool **`atx_function`** (xAI Responses) with JSON args `{ "operation": "<name>", "symbol"?: "<ticker>", "symbols"?: string[] }` (use `**symbol`** or `**symbols**` for watchlist mutations; max 20 tickers per call).


| Operation                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portfolio_summary`        | Same account/position rollup as before, plus `**watchlist**`: either `{ name, symbolCount, symbols[] }` (same shape as `watchlist_snapshot` entries) or `{ error: "no_watchlist" }`. Default portfolio name, `**ext_broker_ref**`, per-account metadata (`name`, `type`, `extAccountId`, `isDefault`, `**cashBalance**`, `**positionCount**`), `**totalPositionCount**`. If no default portfolio exists yet, the executor runs `**provisionDefaultPortfolioForUser**` once before returning `no_default_portfolio`. **Same-request optimization:** when ask/batch built a workspace preload, served from memory **without** re-querying Mongo until watchlist mutations invalidate preload. In-process `**watchlist_snapshot` / `account_health`** TTL cache still applies when preload is absent. |
| `positions_snapshot`       | Holdings per account: `symbol`, `qty`, `avgCost`. Response is **capped** (200 positions); `**truncated`** / `**omittedCount**` when clipped. **Same-request optimization:** full book is served from preload when still valid (no extra Mongo read). **Not** long-lived tool-cached.                                                                                                                                                                                                                                                       |
| `watchlist_snapshot`       | Watchlist name and symbols with `**addedAt`** (ISO), `**addedAtDisplay**`, `**targetEntryDisplay**` (desk **entry price** USD or “not set”), `**targetEntryNotional100xDisplay**` (raw whole-dollar **100×** string for legacy callers), `**spotPriceDisplay**` (Yahoo spot as **`$…`** or “—”), `**targetEntryNotional100xUsdDisplay**` (same notional as **`$…`**), optional `**lineType**`, `**strategy**`, `**quantity**`, `**entryPrice**` / `**targetEntryPrice**`. Populated via Mongo + **`lookupSymbols`** (same family as `GET .../watchlist?quotes=1`). The deterministic **show my watchlist** shortcut in **`ask/route.ts`** lists **Spot** + **Target entry** in USD and does **not** print **added** timestamps.                                                                                                                                                                                                                                                              |
| `watchlist_add_symbols`    | Add one or more tickers to the **default** watchlist (`mutatePortfolioWatchlistSymbols` with `addSymbols`). Clears cached `**watchlist_snapshot**` / `**account_health**` and **invalidates** the ask-turn workspace preload so subsequent tool calls re-hit Mongo.                                                                                                                                                                                                                                                                                    |
| `watchlist_remove_symbols` | Remove tickers from the default watchlist (`removeSymbols`). Same cache + preload invalidation as add.                                                                                                                                                                                                                                                                                                                                   |
| `account_health`           | Accounts with `**cashBalance**`, plus `**defaultAccountName**`.                                                                                                                                                                                                                                                                                                                                                                        |
| `task_status`              | Scheduled tasks and recent runs (tenant-scoped).                                                                                                                                                                                                                                                                                                                                                                                       |
| `market_quote`             | Yahoo-backed quote via shared path with `yahoo_finance` tool.                                                                                                                                                                                                                                                                                                                                                                          |


`watchlist_snapshot` and `account_health` use the short-lived per-user tool cache in `[src/modules/xchat/tool-cache.ts](../../src/modules/xchat/tool-cache.ts)` (`portfolio_summary` and `positions_snapshot` are always read fresh). Watchlist mutations **invalidate** the `watchlist_snapshot` cache for that user.

## Persona binding

- Persona `xapi.tools` may include `{ "type": "atxfinance" }` (validated in `[persona-validation.ts](../../src/modules/xchat/persona-validation.ts)`).
- **Effective tools and RAG collection scope** for ask/batch: `normalizePersonaXapiConfig` → `ensureSuperAgentDefaultTools` (Super-Agent display name) → `resolveXchatTeamOnlyLinkedCollectionIds` (persona `teamCollection` + `XAI_TEAM_ID` / deploy default, **max 2** ids) → `withLinkedCollectionTools(..., "replace")` so `file_search` / `collections_search` **do not** accumulate persona-declared vector stores → `mergeXchatHostedToolBaseline`. Admin “linked collections” counts may still union `xaiCollection` + tools for display; runtime xChat does not merge long tool `collection_ids` lists into the wire payload.
- When `atxfinance` is in the effective tool list, the ask route includes the workspace section of **`buildSessionToolInstructions`** (`[xchat-prompt-build.ts](../../src/modules/xchat/xchat-prompt-build.ts)`) in the system prompt so the model calls the tool for portfolio/watchlist/position questions instead of asking the user to paste holdings.

## Admin → Persona text (Mongo only)

**You do not need to paste `portfolio_summary` / `positions_snapshot` / operation lists into the persona** when `atxfinance` is enabled: the ask route injects operation guidance via **`buildSessionToolInstructions`** (system side). Use Admin → Personas for **tone, exam rules, and disclaimers** only.


| Field              | Use for                                                                                                             | `atxfinance` operations?                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **systemPrompt**   | Identity, scope (finance/exam), disclaimers, style                                                                  | **Optional** short reinforcement only; full operation list is redundant with server injection. |
| **overridePrompt** | Prepended to the **user message bundle** (`override` + `User message:` + text). Good for output format / checklist. | **Avoid** long tool schemas here — it repeats every turn and reads like user-side noise.       |


## What goes to the user’s xAI collection (not persona text)

Turn sync (`[appendXchatTurnToUserCollection](../../src/modules/core-admin/access-request-bootstrap.ts)`) uploads **only** a small markdown artifact per ask: metadata (user id, persona **name**, model, scope, retention) plus `**## Prompt`** (user message) and `**## Response**` (assistant text). **It does not include** `systemPrompt`, `overridePrompt`, RAG snippets, or server-injected session tool copy. Persona prompts remain **MongoDB + server composition only** (unless you explicitly put text into a user message).

## Limitations / notes

- `**chat_completions`** persona mode uses `[chatWithXai](../../src/lib/xai.ts)` without the local tool executor loop; custom function tools may not behave like the Responses path. Default published personas use `**responses**` mode.
- User price **alerts** are not a stored domain model yet; not part of this tool.
- Large tool payloads are truncated at 8KB after JSON serialization.

## Tests

- `[tests/integration/atxfinance-tool-executor.test.ts](../../tests/integration/atxfinance-tool-executor.test.ts)`
- `[tests/integration/xchat-ask-route.test.ts](../../tests/integration/xchat-ask-route.test.ts)` (workspace snapshot + persona-only `atxfinance` wiring)
- `[tests/unit/app-user-default-book.test.ts](../../tests/unit/app-user-default-book.test.ts)` — `loadAppUserDefaultBookForPortfolioId` (owned portfolio pin for `/xchat?portfolioId=`)
- `[tests/unit/watchlist-prompt-format.test.ts](../../tests/unit/watchlist-prompt-format.test.ts)` — notional vs desk formatters

