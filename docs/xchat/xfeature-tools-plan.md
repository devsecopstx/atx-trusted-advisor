# xFeature Tools Implementation Plan

## Status

Planning document. No runtime changes until explicitly approved.

## Context

The `atxfinance` custom tool stub (`docs/xchat/atxfinance-tool-stub.md`) defines the target tool surface for xChat personas to call controlled atxFinance capabilities. This plan turns that stub into a phased implementation roadmap.

## Current State

- xChat ask route forwards `xapi.tools` to xAI responses API (`web_search`, `x_search`, `file_search`).
- xAI handles tool execution server-side for these three built-in tools.
- The `atxfinance` custom tool requires client-side execution: xAI calls the tool, we execute it, and return results back to xAI for the next turn.
- Persona validation only allows `web_search | x_search | file_search` via `PERSONA_XAPI_TOOL_TYPES`.
- The tool stub defines four operations: `portfolio_summary`, `watchlist_snapshot`, `account_health`, `task_status`.

## Architecture Decision

xAI responses API supports custom tools via the `function` tool type. When the model decides to call a custom function, the API returns a `tool_call` output item with the function name and arguments. The client must:

1. Parse the `tool_call` from the response output.
2. Execute the function locally.
3. Submit a follow-up request with the function result as a `function_call_output` input item.
4. Repeat until the model produces a final text response (up to `max_turns`).

This is the **tool-use loop** pattern. The current `respondWithXai` in `src/lib/xai.ts` does not implement this loop — it sends a single request and extracts text. The loop must be added.

## Phase 1: Tool-Use Loop in xAI Client

### Scope
- Extend `respondWithXai` (or add `respondWithXaiToolLoop`) in `src/lib/xai.ts` to support multi-turn tool calls.
- Define a `ToolExecutor` callback type: `(name: string, args: Record<string, unknown>) => Promise<string>`.
- The loop calls xAI, checks output for `tool_call` items, invokes the executor, appends `function_call_output`, and re-calls until text output or max turns.

### Contracts
```ts
type ToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ result: string; error?: string }>;

type RespondWithToolLoopInput = {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  tools: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "required" | "none";
  maxTurns?: number;
  executor: ToolExecutor;
};
```

### Safety
- Hard cap on loop iterations (default 5, configurable via persona `maxTurns`).
- If executor throws, return a structured error result to the model (do not crash the loop).
- Log each tool call (name, args summary, duration, success/failure) for audit.

### Testing
- Unit test the loop with mocked fetch: model calls tool → executor returns → model produces text.
- Test max-turns enforcement.
- Test executor failure handling.

## Phase 2: atxFinance Tool Executor

### Scope
- Create `src/modules/xchat/tool-executor.ts` implementing the four operations from the stub.
- Each operation is a pure read against existing repository functions (no mutations in v1).

### Operations

| Operation | Repository Source | Return Shape |
|-----------|-----------------|--------------|
| `portfolio_summary` | `getDefaultPortfolio` + `listPortfolioAccounts` | `{ name, isDefault, accountCount, accounts[] }` |
| `watchlist_snapshot` | `getPortfolioWatchlist` | `{ name, symbols[], symbolCount }` |
| `account_health` | `listPortfolioAccounts` | `{ accounts[]: { name, type, extAccountId, isDefault } }` |
| `task_status` | `listScheduledTasks` + `listTaskRuns` | `{ tasks[], recentRuns[] }` |

### Auth/Scope
- Executor receives `userId` and `tenantId` from the session context (passed through the ask route).
- Each operation is scoped to the authenticated user's tenant. No cross-tenant access.
- No secret or credential material in outputs.

### Safety
- Read-only: no `$set`, no `updateOne`, no inserts.
- Output is serialized to a string (JSON) with a max length cap (e.g. 8KB) to prevent prompt overflow.
- Unknown operation names return `{ error: "unknown_operation" }`.

### Testing
- Unit tests for each operation with mocked repository.
- Test unknown operation rejection.
- Test output length cap.

## Phase 3: Persona Tool Validation Update

### Scope
- Add `"atxfinance"` to `PERSONA_XAPI_TOOL_TYPES` in `src/modules/xchat/types.ts`.
- Update persona validation in `src/modules/xchat/persona-validation.ts` to accept `atxfinance` as a tool type.
- Update `normalizePersonaXapiConfig` to pass through `atxfinance` tools.
- Update the persona editor multi-select UI to include an `atxfinance` checkbox.

### Compatibility
- Existing personas without `atxfinance` tool are unaffected.
- The tool is opt-in per persona.
- `atxfinance` tool definition: `{ type: "atxfinance" }` (no `source` required).

### Migration
- No schema migration needed. `atxfinance` is a new tool type, not a field change.
- Optionally add `atxfinance` to Super-Agent default tools via seed update.

## Phase 4: Wire Tool Loop into Ask Route

### Scope
- In `src/app/api/xchat/ask/route.ts`, when the persona has an `atxfinance` tool in `xapi.tools`, use `respondWithXaiToolLoop` instead of `respondWithXai`.
- Pass the `atxFinanceToolExecutor` as the executor.
- Session context (`userId`, `tenantId`) flows from the route handler to the executor.

### Fallback
- If the persona has no custom tools (only `web_search`/`x_search`/`file_search`), use the existing single-request path. No loop overhead for built-in-only personas.

### Audit
- Add `xapiToolCalls` field to `XChatSessionLog` to record which tools were invoked and their results.

## Phase 5: Batch Support for Custom Tools

### Scope
- xAI Batch API does not support multi-turn tool loops. Batch items are single-request.
- For batch workloads with `atxfinance` tool: pre-execute tool calls during prompt assembly (similar to the existing collection pre-search pattern).
- Inject tool output into the system prompt as structured context.

### Pattern
```
For each batch item:
  1. Run portfolio_summary / watchlist_snapshot as applicable.
  2. Serialize output into system prompt context block.
  3. Submit the enriched prompt to batch.
```

## Delivery Order

| Phase | Dependencies | Scope |
|-------|-------------|-------|
| 1 | None | xAI client tool loop |
| 2 | None (parallel with 1) | atxfinance executor |
| 3 | Phase 1 + 2 | Validation + UI update |
| 4 | Phase 1 + 2 + 3 | Ask route wiring |
| 5 | Phase 4 | Batch pre-execution |

## Risk Hotspots

- **Tool loop infinite cycling**: mitigated by hard `maxTurns` cap + per-turn timeout.
- **Executor data leakage**: mitigated by tenant-scoped reads only, no secrets in output.
- **Prompt overflow from large tool outputs**: mitigated by output length cap.
- **Batch items with stale pre-executed context**: acceptable for v1 (batch is async, some staleness expected).

## Non-Goals (v1)

- No mutation operations (create/update/delete via tool calls).
- No real-time market data (tool returns stored portfolio data, not live prices).
- No cross-tenant tool execution.
- No custom tool support in `chat_completions` mode (only `responses` mode has tool loop).

---

## xDesign review (planning snapshot)

Structured pass against `.cursor/skills/xdesign-review/SKILL.md` before implementation sign-off. **This section is documentation only** until phases are approved.

### Findings

#### High

1. **Tool-args injection / over-broad reads** — The executor receives structured args from the model. Without strict validation (allowed keys, max depth, symbol allowlists where applicable), a malicious or confused model could widen reads or force oversized responses. **Mitigation:** validate each operation’s args with Zod (or equivalent) inside the executor; reject unknown keys; keep the documented output cap.

2. **Audit gap vs finance-grade expectations** — Phase 4 adds `xapiToolCalls` to chat logs; Phase 1 mentions logging. If compliance expects parity with `admin_audit_events`, the plan should explicitly state **either** “tool calls are operational logs in `xchat_logs` only” **or** a follow-up to emit audit events for tool invocation. **Mitigation:** add one sentence under Phase 4 *Audit* choosing the model; if dual-write is required, scope it before Phase 4 ships.

#### Medium

1. **Batch staleness** — Phase 5 admits stale pre-executed context. Document maximum acceptable age or a “as of” timestamp in the injected block so batch consumers know freshness limits.

2. **Rate / cost** — No per-user or per-tenant cap on tool-loop turns in addition to `maxTurns`. Consider aligning with existing xChat rate limits (`plan-limits` / ask route) to avoid cost spikes.

#### Low

1. **Persona UX** — Phase 3 adds an `atxfinance` checkbox; ensure admin copy explains that enabling it enables portfolio-linked data in the model context (privacy/trust).

### Reviewer completion (template)

| Reviewer | Status |
|----------|--------|
| design-review-best-practices | pending (re-run at implementation PR) |
| xdesign-review | **complete** (this doc) |
| xdesign-review-adversarial | pending |
| xdesign-review-reliability | pending |
| xdesign-review-audit | pending |

### Merge recommendation (for this plan doc)

- **accept-with-conditions** — Approve the phased roadmap; **block Phase 4 production** until High #1 (arg validation) is explicit in the executor design and High #2 (audit posture) is explicitly decided.

### Gaps

- OpenAPI / route inventory unchanged until ask route behavior changes (Phase 4).
- Integration tests for the tool loop should land with Phase 1 + 4 (mocked xAI + executor).
