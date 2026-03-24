# xChat Debug Logging

When `ENABLE_XCHAT_DEBUG=true` is set in the environment (local `.env`, Cloud Run, or GitHub Actions vars → deploy), the app emits **structured JSON** lines for xChat ask and batch flows. Use these for RAG tuning, expert learning, and replay analysis.

**Implementation:** `src/lib/xchat-debug.ts` · **Flag:** `isXchatDebugEnabled()` in `src/lib/env.ts`.

## Log taxonomy (prefixes)

| Prefix | When | Contents |
|--------|------|----------|
| **`[xchat/debug]`** | Only if `ENABLE_XCHAT_DEBUG=true` | JSON with `type` (see below). User id / email **masked**; xAI collection id **masked**; full prompts + RAG + response in `xchat_ask_full` only when debug is on. |
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
| `xchat_ask_full` | Full `systemPrompt`, `userPrompt`, `ragContext`, `responseText` — **high sensitivity**; only with debug flag. |
| `xchat_ask_pre_request` | **Before** the xAI `/v1/responses` call: `wireTools` (final JSON array sent), `model`, `toolChoice`, `maxTurns`. Use when tracing 422/502 without a successful turn. |
| `xchat_ask_provider_error` | On provider failure (same request as above): `error` message plus `wireTools` again for correlation. |
| `xchat_batch` | Batch flows: includes `batchPhase` — `item_prepare` (per JSONL line while building upload) or `job_created` (xAI batch id known). |

## Enabling

1. **Local:** `.env` → `ENABLE_XCHAT_DEBUG=true` (see `.env.example`). **Restart `next dev`** after changing env — Next only reads `.env` at process start.
2. **GitHub variable** (recommended for Cloud Run): `ENABLE_XCHAT_DEBUG=true` for the environment. The deploy workflows pass it (see `.github/workflows/deploy-cloud-run.yml` and `.github/workflows/deploy-cloud-run-production.yml`).
3. **Manual:** `gcloud run services update <service> --region <region> --set-env-vars ENABLE_XCHAT_DEBUG=true`

## Log retention (30 days)

Cloud Logging retention is configured at the **project** or **log bucket** level, not in application code.

To retain xChat debug logs for 30 days:

1. **Default _Default bucket**:**

   ```bash
   gcloud logging buckets update _Default --location=global --retention-days=30 --project=<project-id>
   ```

2. **Or** create a dedicated bucket for `[xchat/debug]` with 30-day retention and route via a log sink.

## Privacy & compliance

- **Masked in `xchat_ask` / `xchat_batch`:** `userId`, `email`, `collectionId` (shortened).
- **`xchat_ask_full`:** logs **full** prompts, RAG text, and model output — treat as **PII / confidential**; enable only on trusted staging or short-lived production windows; align retention and access with policy.
- Operational `[xchat/ask]` / `[xchat/batch]` lines should remain free of raw user message text; they log errors and metadata only.

Do **not** ship debug-on by default in production without explicit operator intent.
