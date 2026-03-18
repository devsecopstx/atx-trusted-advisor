# xChat Custom Tool Stub: `atxfinance`

## Status

This document is a design stub only. Runtime execution is explicitly deferred.

## Proposed Tool Name

- `atxfinance`

## Intent

Provide a single finance-domain tool surface for future xChat orchestration where personas can call controlled atxFinance capabilities and return structured outputs.

## Capability Categories (Draft)

- portfolio lookup and aggregation
- watchlist and position snapshots
- account and holdings health checks
- scheduled-task status summaries

## Draft Input Schema

```json
{
  "operation": "portfolio_summary | watchlist_snapshot | account_health | task_status",
  "tenantId": "string",
  "userId": "string",
  "scope": "global | tenant | user",
  "args": {}
}
```

## Draft Output Schema

```json
{
  "ok": true,
  "operation": "string",
  "data": {},
  "meta": {
    "source": "atxfinance",
    "generatedAt": "ISO-8601 timestamp"
  },
  "error": null
}
```

## Safety Boundaries and Non-goals

- no side-effecting mutations in first implementation
- no credential or secret material returned in tool output
- no direct deploy, infra, or key-rotation operations
- no implicit access outside authenticated tenant/user scope

## Future Persona Binding Model

In a later phase, `xPerson` config can include this tool in a persona-managed tool list and optionally attach collection-aware constraints:

- tool allowlist entry: `{ "type": "atxfinance" }`
- optional policy config:
  - allowed operations
  - allowed scopes
  - collection linkage requirements for context-sensitive operations

## Deferred Rollout Checklist

1. Update persona tool validation to allow `atxfinance`.
2. Update xChat ask-route tool passthrough logic for `atxfinance`.
3. Add backend executor routing for each allowed operation.
4. Add telemetry and audit fields for tool invocation and outcomes.
5. Add regression tests for success, denial, and error paths.

## Explicit Defer Marker

Deferred in this phase:

- no API route additions
- no updates to xChat runtime tool enums/contracts
- no persona schema migrations
- no execution wiring in `ask` or batch routes
