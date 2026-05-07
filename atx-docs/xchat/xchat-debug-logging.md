# xChat Debug Logging

When **`core_tenants.tenantPreferences.xchat_debug_enabled`** is **`true`** (boolean), set by **global_admin** in **Admin → Tenant workspace**, the app emits **structured JSON** lines for xChat ask, history list, and batch flows. Use these for RAG tuning, expert learning, and replay analysis.

**Default is off.** There is **no** `ENABLE_XCHAT_DEBUG` (or other env) switch for `[xchat/debug]` — only the per-tenant workspace toggle.

**Where logs appear:** `[xchat/debug]` uses `console.info` on the **server only** (`isXchatStructuredDebugEnabled()` is false when `window` is defined, so browser bundles never emit these lines). In **`next dev`**, server `console` output may also show in the **terminal** running Next — not in end-user browsers in production.

**Next.js dev request lines** (for example `GET /api/xchat/history/stats 200 in …ms` with `next.js` / `proxy.ts` / `application-code` breakdown) are **framework request logging**, not `[xchat/debug]`. They appear in the dev terminal when `next dev` is running; production builds do not print them the same way.

**Implementation:** `src/lib/xchat-debug.ts` · **Tenant flag:** `AsyncLocalStorage` from `src/lib/xchat-debug-context.ts` (`runWithXchatTenantDebug` / `runWithXchatTenantDebugAsync`), entered from xChat API routes after loading the tenant and `isTenantXchatDebugPreferenceEnabled()`.

## Log taxonomy (prefixes)

| Prefix | When | Contents |
|--------|------|----------|
| **`[xchat/debug]`** | Only if tenant workspace xChat debug is on for that request | JSON with `type` (see below). User id / email **masked**; xAI collection id **masked**; full prompts + RAG + response in `xchat_ask_full` only when debug is on. |
| **`[xchat/ask]`** | Always on errors/warnings | Operational: RAG search failures, mongo scope failures, responses→chat fallback, provider 502 path. **No** full message bodies by default. |
| **`[xchat/batch]`** | Always on batch errors | Operational: batch submit failures, poll issues (see routes). |

Filter in Cloud Logging:

- Opt-in debug: `textPayload=~"\[xchat/debug\]"` or parse JSON `type` field.
- Failures: `textPayload=~"\[xchat/ask\]"` OR `textPayload=~"\[xchat/batch\]"`.

## JSON `type` values (`[xchat/debug]`)

Exported as `XCHAT_DEBUG_LOG_TYPES` in `src/lib/xchat-debug.ts`.

| `type` | Purpose |
|--------|---------|
| `xchat_ask` | Summary per `POST /api/xchat/ask`: lengths, previews, `contextSource`, `scope`, masked `collectionId`, `toolCallCount`, `mode`, etc. |
| `xchat_ask_full` | Full `systemPrompt`, `userPrompt`, `ragContext`, `responseText` — **high sensitivity**; only with tenant debug on. |
| `xchat_ask_pre_request` | **Before** the xAI `/v1/responses` call: `wireTools` (final JSON array sent), `model`, `toolChoice`, `maxTurns`. Use when tracing 422/502 without a successful turn. |
| `xchat_ask_provider_error` | On provider failure (same request as above): `error` message plus `wireTools` again for correlation. |
| `xchat_ask_tool_batch` | After each `/v1/responses` turn that runs **local** tools in parallel: `turnIndex`, `parallelLocalCount`, per-call `name` + `durationMs`, `slowestMs`, plus `correlationId` / `requestId` for join with Mongo audit. |
| `xchat_batch` | Batch flows: includes `batchPhase` — `item_prepare` (per JSONL line while building upload) or `job_created` (xAI batch id known). |
| `xchat_history_list` | `GET /api/xchat/history` list response metadata (limit, counts, cursor). |

**Workspace snapshot (optional, same prefix):** when tenant xChat debug is on, `[workspace-snapshot-for-prompt.ts](../../src/modules/xchat/workspace-snapshot-for-prompt.ts)` logs `console.info("[xchat/debug]", { type: "workspace_snapshot_load", … })` (cache vs mongo, `elapsedMs`, masked portfolio id) and `{ type: "workspace_snapshot_build", … }` after a Mongo build. These `type` strings are **not** in `XCHAT_DEBUG_LOG_TYPES` yet; filter on `workspace_snapshot_` in JSON if needed.

**Monitoring / SLO hints:** After index or Redis changes, compare `workspace_snapshot_load.elapsedMs` before vs after on the same portfolio. Aim **&lt;50 ms** when `source === "cache"`; use **`mongo`** rows to validate cold paths. See **`atx-docs/sre-ops/mongo-indexing-guide.md`** §8.

**Tool-loop latency:** With tenant debug on, `xchat_ask_tool_batch` surfaces **per-tool `durationMs`** after each turn. The host runs **independent local tools concurrently** (same xAI `function_call` batch), so wall time for that batch approaches **`slowestMs`**, not the sum of calls. Correlate with `correlationId` / `requestId` from the same ask request.

## Enabling

1. **Per-tenant:** Admin → **Tenant workspace** → check **Enable xChat debug logs for this tenant** (writes `tenantPreferences.xchat_debug_enabled` as boolean `true`). Applies only to users on that tenant and only for requests that run inside `runWithXchatTenantDebugAsync` (xChat ask, history list, batch).
2. **Mongo sanity:** If you expect debug off but still see `[xchat/debug]`, confirm `tenantPreferences.xchat_debug_enabled` is not a string `"true"` — only strict boolean **`true`** enables the preference reader used by API routes.

## Log retention (30 days)

Cloud Logging retention is configured at the **project** or **log bucket** level, not in application code.

To retain xChat debug logs for 30 days:

1. **Default _Default bucket** —

   ```bash
   gcloud logging buckets update _Default --location=global --retention-days=30 --project=<project-id>
   ```

2. **Or** create a dedicated bucket for `[xchat/debug]` with 30-day retention and route via a log sink.

## Privacy & compliance

- **Masked in `xchat_ask` / `xchat_batch`:** `userId`, `email`, `collectionId` (shortened).
- **`xchat_ask_full`:** logs **full** prompts, RAG text, and model output — treat as **PII / confidential**; enable only on trusted staging or short-lived production windows; align retention and access with policy.
- Operational `[xchat/ask]` / `[xchat/batch]` lines should remain free of raw user message text; they log errors and metadata only.

Do **not** ship tenant xChat debug on by default in production without explicit operator intent.
