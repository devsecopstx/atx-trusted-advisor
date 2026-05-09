# xChat history — storage model (Mongo first)

**Audience:** engineers and ops configuring xChat + xAI.

## Source of truth

- **Conversation turns** for the web app are stored in **MongoDB** (`xchat_logs` and related fields). This is the **authoritative** history for UI rails, limits, and audit-oriented flows tied to the Next app.
- **RAG / retrieval** for ask uses **persona-linked** xAI collection ids only (`resolveXchatPersonaDeclaredCollectionIds`: `xaiCollection`, `teamCollection`, and tool-declared `collection_ids`, capped). Deploy env team KB (`resolveTeamKbCollectionId`) is **not** merged into ask/batch/orchestrator collection wiring.

## Deprecated / unused env (do not set)

| Name | Status |
|------|--------|
| **`ATXFINANCE_COLLECTION_ID`** | **Never implemented** in `src/lib/env.ts` or runtime. Legacy tests only assert batch metadata **does not** mention this string. **Do not** add to Secret Manager or `.env`. |

## Optional naming prefix (not per-turn storage)

- **`ATX_INSTANCE_COLLECTION_ROOT`** — tenant **prefix** for **display names** of instance-scoped xAI resources when seed/bootstrap creates them (see `atx-instance-collection-root.ts`). It is **not** a substitute for Mongo history and does **not** alone persist chat turns.

## Per-user xAI collections (retired / off)

- **Per-user xAI history (`user_history`)** is gated by Mongo **`xchat_user_preferences`**: the user must enable **“Keep last 10 messages”** and the secondary **“Enable long-term xAI memory…”** toggle. Only then does OAuth bootstrap (when prefs already saved), **`GET /api/xchat/collections`** expose **`user_history`**, and **`user_history_agent`** upload pending `xchat_logs` turns. Opt-out / purge clears the xAI collection binding — see [`../sre-ops/audit-lineage-and-controls.md`](../sre-ops/audit-lineage-and-controls.md) § xChat long-term xAI memory.
- Re-enabling would require an explicit product change to that function (and tests), not only env.

## Remote xAI conversation state

- **`XCHAT_USE_REMOTE_HISTORY`** — parsed in **`src/lib/env.ts`** (default **`false`**). When **`true`** and the user has opted into **Keep last 10 messages**, `POST /api/xchat/ask` sets `store_messages` and, when `threadId` + prior `xaiResponseId` exist (same `personaId`), sends `previous_response_id` and omits Mongo recent-turn injection for that continuation. Disabled when keep-last-10 is off (ephemeral mode), when `keepXchatHistory` is false on the persona, or on vision turns. **Persona edits:** xAI does not allow sending `instructions` together with `previous_response_id`; the remote chain keeps the **first** turn’s system prompt. Ask stores **`xchatInstructionsFingerprint`** on each `xchat_logs` row (`computeXchatRemoteChainInstructionsFingerprint` in **`xchat-prompt-build.ts`**) and **starts a fresh chain** (drops `previous_response_id`, uses client `recentMessages` + new `instructions`) when the fingerprint no longer matches—so Mongo-updated persona text and tool/citation flags apply on the next turn.

## Threaded rails + hydration

- `POST /api/xchat/ask` always resolves a `threadId` (request value or server-generated UUID) and echoes it in `data.metadata.threadId`.
- `GET /api/xchat/threads` returns newest-first thread summaries (title preview, `lastMessageAt`, turn count) for the current app-user tenant scope.
- `GET /api/xchat/history?threadId=...` hydrates one thread (newest-first turns); `/xchat` uses this for sidebar thread selection and instant thread restore.
- `DELETE /api/xchat/history?threadId=...` can purge one thread; omitting `threadId` keeps the existing full-history delete behavior.

## Ask JSON envelope (`data.content` + `data.metadata`)

Successful **`POST /api/xchat/ask`** responses include (inside **`data`**):

- **`content`** — same markdown as **`response`** (integrations may prefer `content`; **`response`** remains for backward compatibility).
- **`metadata`** — **`durationMs`** / **`sourcesUsed`** (same numbers as **`interactionMeta.generationMs`** and **`interactionMeta.sources.total`**), **`personaId`** (resolved xPersona hex for this turn), **`model`** (effective model or sentinel), **`threadId`** (echo of the request body’s **`threadId`**, or empty string when omitted).

Canonical durable history still lives in **Mongo** when the user has opted in (**`getXchatUserPreferences`** → **`saveXChatLog`**); this wire metadata does **not** replace `xchat_logs`. Default published persona for app users without an assignment is governed by **`xchat_platform_settings.defaultAppUserPersonaId`** (see **`xchat-platform-settings.ts`** and persona resolution in the ask route)—the **`metadata.personaId`** field reflects the **effective** persona after assignment + picker policy, not only that default row.

## See also

- [`xai-api-standard.md`](./xai-api-standard.md) · [`xchat-tools-guide.md`](./xchat-tools-guide.md) · [`atx-multi-agent.md`](./atx-multi-agent.md) (team-only collections)
