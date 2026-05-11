# xChat: context routing vs tools vs multi-agent

Short policy for how `POST /api/xchat/ask` should combine **pre-call retrieval**, **built-in / custom tools**, and **parallel multi-agent** (`grok-4.20-multi-agent` + `agent_count`). Use this when tuning personas, plans, or prompts.

## Phase 1: xAI collections (canonical Finance KB)

**Shipped:** one shared **Finance** xAI collection (`XAI_FINANCE_COLLECTION_ID`, default `collection_b75e188e-e7e6-4aa8-8e01-23caf0946236`) for all tenants. xChat ask pins finance/options/portfolio/strategy prompts to that id (single retrieval call). Persona rows still edit prompts/tools; optional per-persona extras remain capped at two ids. **`XAI_TEAM_ID`** remains for admin discovery and legacy segment ingest — not merged into ask unless declared on the persona. **Long-term memory:** when **`enableLongTermXaiMemory`** is on, ask includes capped thread history in the Responses tool loop and may continue via **`previous_response_id`** when **`XCHAT_USE_REMOTE_HISTORY`** is enabled. Details: [`atx-multi-agent.md`](./atx-multi-agent.md).

## Decision table (intent → path)

| User intent (examples) | Prefer | Why |
|------------------------|--------|-----|
| Answer from **your docs** (persona / **team** xAI collection under `XAI_TEAM_ID`, Mongo RAG scope where applicable) | **Retrieval first** — server-side `searchDocumentsInCollections` / `retrieveRagChunks` injected into system context | Lowest latency and cost; grounded answers; no extra model round-trips for static knowledge. |
| **Live user state** (positions, balances, watchlist) | **`atxfinance` tool** (responses tool loop) | Data is per-session Mongo; not in xAI collections; must run server executor. |
| **Show watchlist** (`"show my watchlist"`, `"show watchlist for <portfolio>"`) | **`atx_function.watchlist_snapshot` + market pulse enrichment** | Deterministic, tool-backed output. Render as table with live 1D delta / `% distance` from target and xOptions CTA links; avoid model-invented prices. |
| **Live market quote** | **`yahoo_finance` or `atxfinance` + `market_quote`** | Canonical Yahoo path; avoid inventing prices from web prose. |
| **Rank options structures / strategy ideas** | **`atx_function.strategy_recommendations`** | Spring `OptionsStrategyEngine` returns structured recommendation JSON (legs, score, risk/reward, rationale) for model narration; fail closed on missing symbols/outlook/risk/horizon or backend outage. |
| **Breaking news, sentiment, “what happened today”** | **`web_search` / `x_search` tools** (after retrieval if needed) | Collections lag; tools pull fresh web/X. |
| **Heavy synthesis** (many conflicting sources, multi-angle research, explicit “red team”) | **Multi-agent** (`grok-4.20-multi-agent` + `reasoningEffort`) — **admin / cost-approved tiers only** by default | Higher cost and latency; use when single-pass quality is insufficient, not for every turn. |

**Rule:** Multi-source context (team + Mongo RAG where enabled) does **not** by itself require parallel agents. Prefer **one model + merged retrieval + selective tools**.

### Cost optimization (HNWI / scale)

- **RAG-first:** Keep canonical options-strategy narratives, desk playbooks, and skills-style prose in **team xAI collections** (persona-linked) so `searchDocumentsInCollections` grounds answers without extra tool/model churn. See [`atx-docs/rag-collection/options-strategy-xchat-seeding.md`](../rag-collection/options-strategy-xchat-seeding.md) for upload guidance.
- **Tool-second:** Use `atx_function` / Yahoo only when the user needs **live** book or market state; static structure education belongs in RAG.
- **Spend telemetry:** Persisted turns store xAI **`usage.cost_in_usd_ticks`** as **`xchat_logs.xaiUsage.costUsdTicks`** when the API returns it — Admin → **xChat usage & spend** aggregates vendor ticks; optional tenant **`xchat_spend_alert`** scheduled task compares rolling 24h spend to **`tenantPreferences.xchat_daily_spend_alert_usd_ticks`**.
- **Spring + Redis:** Workspace preload remains **`xf:wsnap:v1:*`** (shared with Next). JVM **`StrategyOptionsYahooClient`** caches raw Yahoo option-chain JSON under **`xf:oyahoo:v1:{UNDERLYING}:{epoch}`** with market-aware TTLs to cut duplicate chain fetches before any downstream use.

### NL slot collection for watchlist intent

- If user asks **"show watchlist for ..."** and the ask payload does not include `portfolioId`, run slot collection before tool execution.
- Accept an inline 24-char Mongo id from the message when present; otherwise ask for `portfolioId` explicitly and defer response generation.
- Do not guess portfolio identity from natural-language names in this path; fail closed until `portfolioId` is resolved.

## Admin persona defaults (daily xChat — locked)

Do **not** set **`grok-4.20-multi-agent`** / **`grok-4.20-multi-agent-0309`** as the persona **`model`** for normal product chat (watchlist, quotes, portfolio review, quick options ideas). Use **`grok-4-1-fast-reasoning`** (or rely on empty → server **`XAI_CHAT_MODEL`** / same fallback). Multi-agent is for **heavy synthesis** (server may still downgrade retrieval-first per ask) and for **strategy-job / xOptions orchestrator** finalizer paths on the **backend** — not as the default persona model on every ask.

**Lock:** **xAPI mode** `responses`, **tool_choice** `auto`, **max_turns** `5`, **RAG** enabled. Admin UI documents this in **Tools & xAPI** on the persona editor.

## Effective xAI model

`POST /api/xchat/ask` uses the **resolved persona’s** `model` field (Admin → Personas / Mongo). If it is empty, the server uses **`XAI_CHAT_MODEL`** (env / Cloud Run), else **`grok-4-1-fast-reasoning`**. There is **no** raw client `model` id override.

**Depth for this turn** (optional **`reasoningMode`**: `fast` \| `expert` \| `heavy`, mutually exclusive with body **`reasoningEffort`**): **`fast`** → **`grok-4-1-fast`**; **`expert`** → **`grok-4.3`** + **`reasoning.effort` `medium`**; **`heavy`** → **`grok-4.3`** + **`reasoning.effort` `high`**. Legacy **`reasoningEffort`** alone maps non–multi-agent personas to **`grok-4.3`** + matching **`reasoning.effort`** (including **`none`** on grok-4.3); **`reasoningEffort` `none`** is rejected when the persona model is multi-agent. When the persona **`model`** is **`grok-4.20-multi-agent`** / **`grok-4.20-multi-agent-0309`** and depth presets are not forcing **`grok-4.3`**, **`agent_count`** + **`reasoning.effort`** follow **`reasoningEffort`** + plan **`multiAgentParallelMaxAgents`** (see plan-limits).

## Plan limits (subscription → multi-agent cap)

Defined in [`src/modules/xchat/plan-limits.ts`](../../src/modules/xchat/plan-limits.ts):

- Field **`multiAgentParallelMaxAgents`**: `0` | `4` | `16` — max `agent_count` for non–`global_admin` sessions.
- **Shipped defaults:** **`basic`**/**`free`** → **`0`** (Expert/Heavy **`reasoningMode`** falls back to plan **`escalationModel`** without parallelism); **`premium`**/**`pro`** → **`4`**; **`premium_plus`**/**`enterprise`** → **`16`**.
- **`global_admin`** sessions skip this clamp so internal testing and admin overrides stay usable.

Clamp helper: `clampMultiAgentParallelismForPlan` (used from [`src/app/api/xchat/ask/route.ts`](../../src/app/api/xchat/ask/route.ts) after resolving `reasoningEffort` + multi-agent model).

**When raising caps:** set e.g. `enterprise: { multiAgentParallelMaxAgents: 4 }` first, then `16` only if `reasoningEffort: "high"` is explicitly productized for that tier. Document the change in release notes.

## Related docs

- [`atx-multi-agent.md`](./atx-multi-agent.md) — locked Phase 1 TEAM-only collection scope (`XAI_TEAM_ID`).
- [`atxfinance-tool-stub.md`](./atxfinance-tool-stub.md) — portfolio / watchlist tool contract.
- [`xchat-debug-logging.md`](./xchat-debug-logging.md) — opt-in diagnostics.
- [`pre-release-check.md`](./pre-release-check.md) — broader xChat gaps.
