# xChat: context routing vs tools vs multi-agent

Short policy for how `POST /api/xchat/ask` should combine **pre-call retrieval**, **built-in / custom tools**, and **parallel multi-agent** (`grok-4.20-multi-agent` + `agent_count`). Use this when tuning personas, plans, or prompts.

## Phase 1: xAI collections (TEAM only)

New work: **`XAI_TEAM_ID`** per tenant; TEAM append/retrieval; chat-history collections under that team only. No new reliance on per-user bootstrap or legacy default merges — details and locked decisions in [`atx-multi-agent.md`](./atx-multi-agent.md).

## Decision table (intent → path)

| User intent (examples) | Prefer | Why |
|------------------------|--------|-----|
| Answer from **your docs** (persona / **team** xAI collection under `XAI_TEAM_ID`, Mongo RAG scope where applicable) | **Retrieval first** — server-side `searchDocumentsInCollections` / `retrieveRagChunks` injected into system context | Lowest latency and cost; grounded answers; no extra model round-trips for static knowledge. |
| **Live user state** (positions, balances, watchlist) | **`atxfinance` tool** (responses tool loop) | Data is per-session Mongo; not in xAI collections; must run server executor. |
| **Live market quote** | **`yahoo_finance` or `atxfinance` + `market_quote`** | Canonical Yahoo path; avoid inventing prices from web prose. |
| **Breaking news, sentiment, “what happened today”** | **`web_search` / `x_search` tools** (after retrieval if needed) | Collections lag; tools pull fresh web/X. |
| **Heavy synthesis** (many conflicting sources, multi-angle research, explicit “red team”) | **Multi-agent** (`grok-4.20-multi-agent` + `reasoningEffort`) — **admin / cost-approved tiers only** by default | Higher cost and latency; use when single-pass quality is insufficient, not for every turn. |

**Rule:** Multi-source context (team + Mongo RAG where enabled) does **not** by itself require parallel agents. Prefer **one model + merged retrieval + selective tools**.

## Admin persona defaults (daily xChat — locked)

Do **not** set **`grok-4.20-multi-agent`** / **`grok-4.20-multi-agent-0309`** as the persona **`model`** for normal product chat (watchlist, quotes, portfolio review, quick options ideas). Use **`grok-4-1-fast-reasoning`** (or rely on empty → server **`XAI_CHAT_MODEL`** / same fallback). Multi-agent is for **heavy synthesis** (server may still downgrade retrieval-first per ask) and for **strategy-job / xOptions orchestrator** finalizer paths on the **backend** — not as the default persona model on every ask.

**Lock:** **xAPI mode** `responses`, **tool_choice** `auto`, **max_turns** `5`, **RAG** enabled. Admin UI documents this in **Tools & xAPI** on the persona editor.

## Effective xAI model

`POST /api/xchat/ask` uses the **resolved persona’s** `model` field (Admin → Personas / Mongo). If it is empty, the server uses **`XAI_CHAT_MODEL`** (env / Cloud Run), else **`grok-4-1-fast-reasoning`**. There is **no** client `model` override on the ask payload — multi-agent parallelism follows the same persona model (e.g. `grok-4.20-multi-agent`) plus optional `reasoningEffort` in the body.

## Plan limits (subscription → multi-agent cap)

Defined in [`src/modules/xchat/plan-limits.ts`](../../src/modules/xchat/plan-limits.ts):

- Field **`multiAgentParallelMaxAgents`**: `0` | `4` | `16` — max `agent_count` for non–`global_admin` sessions.
- **Current default:** all tiers (`free`, `pro`, `enterprise`) use **`0`**: app-facing users do not receive multi-agent parallelism until ops raises caps (cost absorption).
- **`global_admin`** sessions skip this clamp so internal testing and admin overrides stay usable.

Clamp helper: `clampMultiAgentParallelismForPlan` (used from [`src/app/api/xchat/ask/route.ts`](../../src/app/api/xchat/ask/route.ts) after resolving `reasoningEffort` + multi-agent model).

**When raising caps:** set e.g. `enterprise: { multiAgentParallelMaxAgents: 4 }` first, then `16` only if `reasoningEffort: "high"` is explicitly productized for that tier. Document the change in release notes.

## Related docs

- [`atx-multi-agent.md`](./atx-multi-agent.md) — locked Phase 1 TEAM-only collection scope (`XAI_TEAM_ID`).
- [`atxfinance-tool-stub.md`](./atxfinance-tool-stub.md) — portfolio / watchlist tool contract.
- [`xchat-debug-logging.md`](./xchat-debug-logging.md) — opt-in diagnostics.
- [`pre-release-check.md`](./pre-release-check.md) — broader xChat gaps.
