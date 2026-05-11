# xChat Debug Logging

When **`core_tenants.tenantPreferences.xchat_debug_enabled`** is **`true`** (boolean), set by **global_admin** in **Admin → Tenant workspace**, the app emits **structured JSON** lines for xChat ask, history list, and batch flows. Use these for RAG tuning, expert learning, and replay analysis.

**Default is off.** There is **no** `ENABLE_XCHAT_DEBUG` (or other env) switch for `[xchat/debug]` — only the per-tenant workspace toggle.

**Where logs appear:** `[xchat/debug]` uses `console.info` on the **server only** (`isXchatStructuredDebugEnabled()` is false when `window` is defined, so browser bundles never emit these lines). In **`next dev`**, server `console` output may also show in the **terminal** running Next — not in end-user browsers in production.

**Next.js dev request lines** (for example `GET /api/xchat/history/stats 200 in …ms` with `next.js` / `proxy.ts` / `application-code` breakdown) are **framework request logging**, not `[xchat/debug]`. They appear in the dev terminal when `next dev` is running; production builds do not print them the same way.

### Parsing lines with `jq` (e.g. `tee .next/dev.log`)

Each `[xchat/debug]` line is **`[xchat/debug]` + space + a single JSON object** (`JSON.stringify` in code). `jq` must read **only the JSON**, not the prefix (and not any Next.js timestamp text before `[xchat/debug]`). Strip everything before the first `{` on the line, then pipe to `jq`:

```bash
grep '"type":"xchat_perf"' .next/dev.log | sed 's/^[^{]*//' | jq -c '.'
grep '"type":"xchat_ask_full"' .next/dev.log | tail -1 | sed 's/^[^{]*//' | jq '.'
```

If `jq` still errors, the line may be **non-debug** noise (framework requests, stack traces) — tighten `grep` or capture logs only from the Next server child process.

**Implementation:** `src/lib/xchat-debug.ts` · **Tenant flag:** `AsyncLocalStorage` from `src/lib/xchat-debug-context.ts` (`runWithXchatTenantDebug` / `runWithXchatTenantDebugAsync`), entered from xChat API routes after loading the tenant and `isTenantXchatDebugPreferenceEnabled()`.

## Log taxonomy (prefixes)

| Prefix | When | Contents |
|--------|------|----------|
| **`[xchat/debug]`** | Only if tenant workspace xChat debug is on for that request | JSON with `type` (see below). User id / email **masked**; xAI collection id **masked**; full prompts + RAG + response in `xchat_ask_full` only when debug is on. |
| **`[xchat/ask]`** | Always on errors/warnings | Operational: RAG search failures, mongo scope failures, responses→chat fallback, provider 502 path. **No** full message bodies by default. |
| **`[xchat/limit]`** | Every `POST /api/xchat/ask` after limit check | Single JSON object (`console.info`): `type: "xchat.ask.limit_decision"`, `correlationId`, tenant/user ids, plan, `decision` (`allowed` / minute-hourly-daily exceeded / `limiter_degraded_allow`), bucket counts, effective caps, `latencyMs`. Use for log-based metrics (`xchat_asks_total`–style dashboards). Not gated by tenant xChat debug. |
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
| `xchat_ask_stream` | **Live SSE ask** (`Accept: text/event-stream` on `POST /api/xchat/ask`, or via `POST /api/xchat/ask/stream`): timing and **event markers** — e.g. `sseEvent`: `meta`, `turn_start`, `provider_headers`, `tool_status` / `tool_status_upstream`, `done`, `error`; numeric fields such as `elapsedMs`, `turnIndex`, `turnsUsed`, `deltaChars`, `toolCount`, `hasGrokConvId`, `code` (error path). Does **not** log raw token text. |
| `xchat_ask_tool_batch` | After each `/v1/responses` turn that runs **local** tools in parallel: `turnIndex`, `parallelLocalCount`, per-call `name` + `durationMs`, `slowestMs`, plus `correlationId` / `requestId` for join with Mongo audit. |
| `xchat_batch` | Batch flows: includes `batchPhase` — `item_prepare` (per JSONL line while building upload) or `job_created` (xAI batch id known). |
| `xchat_history_list` | `GET /api/xchat/history` list response metadata (limit, counts, cursor). |
| `workspace_snapshot_backend` | JVM snapshot coordination: **`backendFetchMs`** (client-side fetch to Spring), **`elapsedMs`** (full load path), portfolio id, rev when **`loadWorkspaceSnapshotPreload`** successfully hydrates from **`GET /api/portfolios/{id}/snapshot`**. Correlate with JVM response headers **`X-Atx-Snapshot-Handler-Ms`** (handler wall time on Spring) and **`X-Atx-Snapshot-Cache`** (`hit` / `miss` / `skipped`). |

**Workspace snapshot (optional, same prefix):** when tenant xChat debug is on, `[workspace-snapshot-for-prompt.ts](../../src/modules/xchat/workspace-snapshot-for-prompt.ts)` emits the same **`[xchat/debug]` + JSON** shape (`type`: `workspace_snapshot_load` / `workspace_snapshot_build` / `workspace_snapshot_backend`; `elapsedMs`; portfolio id + rev when relevant). Filter on `workspace_snapshot_` in JSON if needed.

**Snapshot timing:** `workspace_snapshot_backend.backendFetchMs` measures Next→JVM network + JVM work for the snapshot GET; Spring adds **`X-Atx-Snapshot-Handler-Ms`** for server-only timing (Redis + Mongo + structured summary assembly). **`data.structured.lastUpdated`** mirrors **`preload.promptJson.loadedAt`** when present (else materialized row timestamp).

**Monitoring / SLO hints:** After index or Redis changes, compare `workspace_snapshot_load.elapsedMs` before vs after on the same portfolio. Aim **&lt;50 ms** when `source === "cache"`; use **`mongo`** rows to validate cold paths. See **`atx-docs/sre-ops/mongo-indexing-guide.md`** §8.

**Tool-loop latency:** With tenant debug on, `xchat_ask_tool_batch` surfaces **per-tool `durationMs`** after each turn. The host runs **independent local tools concurrently** (same xAI `function_call` batch), so wall time for that batch approaches **`slowestMs`**, not the sum of calls. Correlate with `correlationId` / `requestId` from the same ask request.

**Live token SSE:** Join `xchat_ask_stream` lines (`sseEvent`, `elapsedMs`) with `xchat_ask_tool_batch` on the same `requestId` / `correlationId` to see **wall-clock streaming** vs **local tool batch** timings. First `provider_headers` after each xAI round-trip may include **`hasGrokConvId`** when `x-grok-conv-id` is present (prompt-cache hints vary by account).

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
