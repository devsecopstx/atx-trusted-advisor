# xChat — future: tool loop + error UX (TODO)

**Status:** planning only — no runtime change required to ship current BFF/RAG work.

## Tool loop

- Harden the single Responses tool-loop path: deterministic caps on tool rounds, idempotent tool-call ids, and explicit cancellation when upstream disconnects.
- Streaming BFF: when `POST /api/xchat/ask` moves behind Spring or a streaming-capable proxy, verify **no full-body buffering** and preserve SSE/chunked semantics end-to-end.
- Align persona `file_search` / `collection_ids` resolution with **`xai_collections`** inventory and admin RAG flows (see [`../sre-ops/api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md)).

## Error use cases

- Map xAI and management API failures to **stable** `{ error, code?, details? }` shapes; avoid leaking raw provider errors to app_user clients.
- Retry classification: distinguish user-fixable (payload, quota) vs operator (provider outage) vs fail-closed (persona/model denied).
- Observability: keep `[xchat/ask]` / `[xchat/batch]` logs short and PII-safe; structured `[xchat/debug]` is tenant-workspace opt-in only (`xchat-debug-logging.md`).

## Tests

- Integration: tool-loop exhaustion, provider 429/5xx, invalid collection id, stream abort mid-response.
