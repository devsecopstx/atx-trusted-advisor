# xChat tool: `atxfinance` (runtime contract)

## Status

**Shipped** for `POST /api/xchat/ask` when the effective persona tools include `atxfinance` (or for **app members** — roles `advisor` / `operator` / `viewer` — the ask route **merges** `{ "type": "atxfinance" }` if the persona omitted it). Execution lives in [`src/modules/xchat/tool-executor.ts`](../../src/modules/xchat/tool-executor.ts) behind the Responses API tool loop ([`respondWithXaiToolLoop`](../../src/lib/xai.ts)). If persona `xapi.mode` is `chat_completions` but `atxfinance` or `yahoo_finance` is present (including auto-injected Yahoo), the ask route still uses that tool loop — plain `chat/completions` does not execute these custom tools server-side. If the model returns assistant **text** that looks like a fenced JSON `atxfinance` call (instead of a real `function_call` output item), the tool loop **parses and runs** that operation once so portfolio-style prompts still hit Mongo-backed data.

## Security

- **Session scope only:** the executor receives `userId` and `tenantId` from the authenticated session. **Do not** accept or trust a client-supplied user id for these reads.
- Read-only operations against Mongo (`portfolio_*` collections via [`src/modules/core-admin/repository.ts`](../../src/modules/core-admin/repository.ts)); no mutations, credentials, or deploy actions.

## Exposed operations

Single function tool `atxfinance` with JSON args `{ "operation": "<name>", "symbol"?: "<ticker>" }`.

| Operation | Purpose |
|-----------|---------|
| `portfolio_summary` | Default portfolio name, **`ext_broker_ref`** (default `extBrokerName` for cohort grouping until linked), per-account metadata (`name`, `type`, `extAccountId`, `isDefault`, **`cashBalance`**, **`positionCount`**), **`totalPositionCount`**. If no default portfolio exists yet, the executor runs **`provisionDefaultPortfolioForUser`** once (aligned with `GET /api/portfolios/default`) before returning `no_default_portfolio`. |
| `positions_snapshot` | Holdings per account: `symbol`, `qty`, `avgCost`. Response is **capped** (200 positions); **`truncated`** / **`omittedCount`** when clipped. **Not** tool-cached (fresher data). |
| `watchlist_snapshot` | Watchlist name and symbols with **`addedAt`** (ISO string). |
| `account_health` | Accounts with **`cashBalance`**, plus **`defaultAccountName`**. |
| `task_status` | Scheduled tasks and recent runs (tenant-scoped). |
| `market_quote` | Yahoo-backed quote via shared path with `yahoo_finance` tool. |

`portfolio_summary`, `watchlist_snapshot`, and `account_health` use the short-lived per-user tool cache in [`src/modules/xchat/tool-cache.ts`](../../src/modules/xchat/tool-cache.ts).

## Persona binding

- Persona `xapi.tools` may include `{ "type": "atxfinance" }` (validated in [`persona-validation.ts`](../../src/modules/xchat/persona-validation.ts)).
- Personas named **xFinance** still get `atxfinance` injected when missing ([`ensureInternalFinanceToolsForPersona`](../../src/app/api/xchat/ask/route.ts)).
- **App members** always receive `atxfinance` after persona normalization if still absent.
- When `atxfinance` is in the effective tool list, the ask route appends **`ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`** ([`default-xpersonas.ts`](../../src/modules/xchat/default-xpersonas.ts)) to the system prompt so the model calls the tool for portfolio/watchlist/position questions instead of asking the user to paste holdings.

## Admin → Persona text (Mongo only)

**You do not need to paste `portfolio_summary` / `positions_snapshot` / operation lists into the persona** when `atxfinance` is enabled: the ask route injects operation guidance via **`ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`** (system side). Use Admin → Personas for **tone, exam rules, and disclaimers** only.

| Field | Use for | `atxfinance` operations? |
|-------|---------|---------------------------|
| **systemPrompt** | Identity, scope (finance/exam), disclaimers, style | **Optional** short reinforcement only; full operation list is redundant with server injection. |
| **overridePrompt** | Prepended to the **user message bundle** (`override` + `User message:` + text). Good for output format / checklist. | **Avoid** long tool schemas here — it repeats every turn and reads like user-side noise. |

## What goes to the user’s xAI collection (not persona text)

Turn sync ([`appendXchatTurnToUserCollection`](../../src/modules/core-admin/access-request-bootstrap.ts)) uploads **only** a small markdown artifact per ask: metadata (user id, persona **name**, model, scope, retention) plus **`## Prompt`** (user message) and **`## Response`** (assistant text). **It does not include** `systemPrompt`, `overridePrompt`, RAG snippets, or `ATXFINANCE_SESSION_TOOL_INSTRUCTIONS`. Persona prompts remain **MongoDB + server composition only** (unless you explicitly put text into a user message).

## Limitations / notes

- **`chat_completions`** persona mode uses [`chatWithXai`](../../src/lib/xai.ts) without the local tool executor loop; custom function tools may not behave like the Responses path. Default published personas use **`responses`** mode.
- User price **alerts** are not a stored domain model yet; not part of this tool.
- Large tool payloads are truncated at 8KB after JSON serialization.

## Tests

- [`tests/integration/atxfinance-tool-executor.test.ts`](../../tests/integration/atxfinance-tool-executor.test.ts)
- [`tests/integration/xchat-ask-route.test.ts`](../../tests/integration/xchat-ask-route.test.ts) (app_user `atxfinance` injection)
