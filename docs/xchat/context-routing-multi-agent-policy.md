# xChat: context routing vs tools vs multi-agent

Short policy for how `POST /api/xchat/ask` should combine **pre-call retrieval**, **built-in / custom tools**, and **parallel multi-agent** (`grok-4.20-multi-agent` + `agent_count`). Use this when tuning personas, plans, or prompts.

## Decision table (intent → path)

| User intent (examples) | Prefer | Why |
|------------------------|--------|-----|
| Answer from **your docs** (persona collection, user history collection, team collections, Mongo RAG scope) | **Retrieval first** — server-side `searchDocumentsInCollections` / `retrieveRagChunks` injected into system context | Lowest latency and cost; grounded answers; no extra model round-trips for static knowledge. |
| **Live user state** (positions, balances, watchlist) | **`atxfinance` tool** (responses tool loop) | Data is per-session Mongo; not in xAI collections; must run server executor. |
| **Live market quote** | **`yahoo_finance` or `atxfinance` + `market_quote`** | Canonical Yahoo path; avoid inventing prices from web prose. |
| **Breaking news, sentiment, “what happened today”** | **`web_search` / `x_search` tools** (after retrieval if needed) | Collections lag; tools pull fresh web/X. |
| **Heavy synthesis** (many conflicting sources, multi-angle research, explicit “red team”) | **Multi-agent** (`grok-4.20-multi-agent` + `reasoningEffort`) — **admin / cost-approved tiers only** by default | Higher cost and latency; use when single-pass quality is insufficient, not for every turn. |

**Rule:** Multi-source context (personal + team + default collection) does **not** by itself require parallel agents. Prefer **one model + merged retrieval + selective tools**.

## Effective xAI model

`POST /api/xchat/ask` uses the **resolved persona’s** `model` field (Admin → Personas / Mongo). If it is empty, the server falls back to `DEFAULT_XCHAT_MODEL`. There is **no** client `model` override on the ask payload — multi-agent parallelism follows the same persona model (e.g. `grok-4.20-multi-agent`) plus optional `reasoningEffort` in the body.

## Plan limits (subscription → multi-agent cap)

Defined in [`src/modules/xchat/plan-limits.ts`](../../src/modules/xchat/plan-limits.ts):

- Field **`multiAgentParallelMaxAgents`**: `0` | `4` | `16` — max `agent_count` for non–`global_admin` sessions.
- **Current default:** all tiers (`free`, `pro`, `enterprise`) use **`0`**: app-facing users do not receive multi-agent parallelism until ops raises caps (cost absorption).
- **`global_admin`** sessions skip this clamp so internal testing and admin overrides stay usable.

Clamp helper: `clampMultiAgentParallelismForPlan` (used from [`src/app/api/xchat/ask/route.ts`](../../src/app/api/xchat/ask/route.ts) after resolving `reasoningEffort` + multi-agent model).

**When raising caps:** set e.g. `enterprise: { multiAgentParallelMaxAgents: 4 }` first, then `16` only if `reasoningEffort: "high"` is explicitly productized for that tier. Document the change in release notes.

## Related docs

- [`atxfinance-tool-stub.md`](./atxfinance-tool-stub.md) — portfolio / watchlist tool contract.
- [`xchat-debug-logging.md`](./xchat-debug-logging.md) — opt-in diagnostics.
- [`pre-release-check.md`](./pre-release-check.md) — broader xChat gaps.
