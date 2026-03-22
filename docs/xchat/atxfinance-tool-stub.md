# xChat tool: `atxfinance` (runtime contract)

## Status

**Integration standard:** xAI’s HTTP API and docs ([overview](https://docs.x.ai/overview)) — see `[xai-api-standard.md](./xai-api-standard.md)`.

**Shipped** for `POST /api/xchat/ask` when the resolved persona’s `xapi.tools` include `atxfinance` (**no** server-side injection for app roles or persona name — configure the marker in Admin → Personas). Before the model runs, the ask route loads **portfolio, accounts, watchlist, and a capped positions preview** server-side (`[buildWorkspaceServerSnapshotBlock](../../src/modules/xchat/workspace-snapshot-for-prompt.ts)`) and injects them into the **system** prompt; `atxfinance` remains for refresh, full book, quotes, and tasks. xChat batch uses the same snapshot when the persona includes `atxfinance`.

Execution lives in `[src/modules/xchat/tool-executor.ts](../../src/modules/xchat/tool-executor.ts)` behind the xAI **Responses** tool loop (`[respondWithXaiToolLoop](../../src/lib/xai.ts)`). If persona `xapi.mode` is `chat_completions` but `atxfinance` or `yahoo_finance` is present, the ask route still uses that loop so custom tools run server-side. If the model returns assistant **text** with JSON `operation` / `"tool":"atxfinance"`, fenced JSON code blocks, or XML-style `<function_call name="atxfinance">…</function_call>` blocks (inner body may be **legacy `<argument>` tags** or a **single JSON object** with `operation` plus optional `symbol` / `symbols`), the loop **parses and runs** those operations and continues the conversation. Portfolio reads use the same **tenant scope** as other admin collections (legacy rows without `tenantId` remain visible).

## See also

- `[xchat-tools-guide.md](./xchat-tools-guide.md)` — full ask prompt/tool pipeline (diagrams)

## Security

- **Session scope only:** the executor receives `userId` and `tenantId` from the authenticated session. **Do not** accept or trust a client-supplied user id for these reads or mutations.
- **Reads** hit Mongo (`portfolio_*` collections via `[src/modules/core-admin/repository.ts](../../src/modules/core-admin/repository.ts)`). `**watchlist_add_symbols` / `watchlist_remove_symbols`** call `**mutatePortfolioWatchlistSymbols**` for the user’s **default portfolio** only (same path as `PATCH /api/portfolios/:id/watchlist`). No credentials or deploy actions.

## Exposed operations

Single function tool `atxfinance` with JSON args `{ "operation": "<name>", "symbol"?: "<ticker>", "symbols"?: string[] }` (use `**symbol`** or `**symbols**` for watchlist mutations; max 20 tickers per call).


| Operation                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portfolio_summary`        | Default portfolio name, `**ext_broker_ref**` (default `extBrokerName` for cohort grouping until linked), per-account metadata (`name`, `type`, `extAccountId`, `isDefault`, `**cashBalance**`, `**positionCount**`), `**totalPositionCount**`. If no default portfolio exists yet, the executor runs `**provisionDefaultPortfolioForUser**` once (aligned with `GET /api/portfolios/default`) before returning `no_default_portfolio`. **Not** tool-cached (live counts). |
| `positions_snapshot`       | Holdings per account: `symbol`, `qty`, `avgCost`. Response is **capped** (200 positions); `**truncated`** / `**omittedCount**` when clipped. **Not** tool-cached (fresher data).                                                                                                                                                                                                                                                       |
| `watchlist_snapshot`       | Watchlist name and symbols with `**addedAt`** (ISO string).                                                                                                                                                                                                                                                                                                                                                                            |
| `watchlist_add_symbols`    | Add one or more tickers to the **default** watchlist (`mutatePortfolioWatchlistSymbols` with `addSymbols`). Clears cached `**watchlist_snapshot`**.                                                                                                                                                                                                                                                                                    |
| `watchlist_remove_symbols` | Remove tickers from the default watchlist (`removeSymbols`). Clears cached `**watchlist_snapshot**`.                                                                                                                                                                                                                                                                                                                                   |
| `account_health`           | Accounts with `**cashBalance**`, plus `**defaultAccountName**`.                                                                                                                                                                                                                                                                                                                                                                        |
| `task_status`              | Scheduled tasks and recent runs (tenant-scoped).                                                                                                                                                                                                                                                                                                                                                                                       |
| `market_quote`             | Yahoo-backed quote via shared path with `yahoo_finance` tool.                                                                                                                                                                                                                                                                                                                                                                          |


`watchlist_snapshot` and `account_health` use the short-lived per-user tool cache in `[src/modules/xchat/tool-cache.ts](../../src/modules/xchat/tool-cache.ts)` (`portfolio_summary` and `positions_snapshot` are always read fresh). Watchlist mutations **invalidate** the `watchlist_snapshot` cache for that user.

## Persona binding

- Persona `xapi.tools` may include `{ "type": "atxfinance" }` (validated in `[persona-validation.ts](../../src/modules/xchat/persona-validation.ts)`).
- **Effective tools and RAG collection scope** come only from the stored persona (`xapi.tools`, `xaiCollection`, and collection ids on `file_search` / `collections_search`). The ask route does **not** merge Super-Agent defaults, xFinance-name shortcuts, app-role portfolio tools, env `ATXFINANCE_COLLECTION_ID`, user bootstrap collections, or an admin “all team collections” sweep into the model request.
- When `atxfinance` is in the persona tool list, the ask route appends `**ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`** (`[default-xpersonas.ts](../../src/modules/xchat/default-xpersonas.ts)`) to the system prompt so the model calls the tool for portfolio/watchlist/position questions instead of asking the user to paste holdings.

## Admin → Persona text (Mongo only)

**You do not need to paste `portfolio_summary` / `positions_snapshot` / operation lists into the persona** when `atxfinance` is enabled: the ask route injects operation guidance via `**ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`** (system side). Use Admin → Personas for **tone, exam rules, and disclaimers** only.


| Field              | Use for                                                                                                             | `atxfinance` operations?                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **systemPrompt**   | Identity, scope (finance/exam), disclaimers, style                                                                  | **Optional** short reinforcement only; full operation list is redundant with server injection. |
| **overridePrompt** | Prepended to the **user message bundle** (`override` + `User message:` + text). Good for output format / checklist. | **Avoid** long tool schemas here — it repeats every turn and reads like user-side noise.       |


## What goes to the user’s xAI collection (not persona text)

Turn sync (`[appendXchatTurnToUserCollection](../../src/modules/core-admin/access-request-bootstrap.ts)`) uploads **only** a small markdown artifact per ask: metadata (user id, persona **name**, model, scope, retention) plus `**## Prompt`** (user message) and `**## Response**` (assistant text). **It does not include** `systemPrompt`, `overridePrompt`, RAG snippets, or `ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`. Persona prompts remain **MongoDB + server composition only** (unless you explicitly put text into a user message).

## Limitations / notes

- `**chat_completions`** persona mode uses `[chatWithXai](../../src/lib/xai.ts)` without the local tool executor loop; custom function tools may not behave like the Responses path. Default published personas use `**responses**` mode.
- User price **alerts** are not a stored domain model yet; not part of this tool.
- Large tool payloads are truncated at 8KB after JSON serialization.

## Tests

- `[tests/integration/atxfinance-tool-executor.test.ts](../../tests/integration/atxfinance-tool-executor.test.ts)`
- `[tests/integration/xchat-ask-route.test.ts](../../tests/integration/xchat-ask-route.test.ts)` (workspace snapshot + persona-only `atxfinance` wiring)

