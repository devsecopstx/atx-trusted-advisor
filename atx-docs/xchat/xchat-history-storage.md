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

- **`XCHAT_SYNC_TURNS_TO_USER_XAI_COLLECTION`** appears in **`.env.example`** as an *opt-in legacy* path (Mongo → per-user xAI upload via `user_history_agent`). In production code, **`isXchatUserHistoryXaiCollectionEnabled()`** in [`xchat-platform-settings.ts`](../../src/modules/xchat/xchat-platform-settings.ts) currently returns **`false`**, so OAuth bootstrap, `/api/xchat/collections` **user_history**, and `user_history_agent` **do not** upload turns to xAI regardless of that env flag.
- Re-enabling would require an explicit product change to that function (and tests), not only env.

## Remote xAI conversation state

- **`XCHAT_USE_REMOTE_HISTORY`** — parsed in **`src/lib/env.ts`** (default **`false`**). When **`true`**, `POST /api/xchat/ask` sets `store_messages` and, when `threadId` + prior `xaiResponseId` exist (same `personaId`), sends `previous_response_id` and omits Mongo recent-turn injection for that continuation. Disabled when `keepXchatHistory` is false on the persona, on vision turns, or without `threadId`.

## See also

- [`xai-api-standard.md`](./xai-api-standard.md) · [`xchat-tools-guide.md`](./xchat-tools-guide.md) · [`atx-multi-agent.md`](./atx-multi-agent.md) (team-only collections)
