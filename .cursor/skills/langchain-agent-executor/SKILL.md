---
id: langchain-agent-executor
name: langchain-agent-executor
description: Design and implement LangChain-based agent executors in Node.js/TypeScript with robust tool routing, memory boundaries, retry policies, and observability. Use when building or debugging LangChain agents, tool-calling workflows, executor loops, callback tracing, or production reliability around LLM orchestration.
---

# LangChain Agent Executor

## Purpose

Build reliable, production-grade LangChain agent executors with explicit control over tools, memory, retries, and tracing.

## Use This Skill When

- Implementing a new LangChain agent or refactoring an existing one
- Defining tool-calling behavior and safe tool schemas
- Choosing/limiting memory strategies per task
- Adding retry, timeout, and fallback policies
- Instrumenting agent runs for debugging and performance analysis

## Defaults

- Language: TypeScript (strict mode, no `any`)
- Runtime: Node.js
- Tool schemas: Zod
- Observability: LangChain callbacks + OpenTelemetry + structured logs
- Persistence: external store for task/session state; avoid hidden in-memory coupling

## Executor Architecture

1. Build typed tools with strict input/output contracts.
2. Bind model + tools through a single executor entrypoint.
3. Keep memory scoped (session/task) with explicit retention rules.
4. Wrap each executor step with retry/timeout/circuit-breaker behavior.
5. Emit traceable events for every model call and tool invocation.
6. Return deterministic, typed final responses to callers.

## Tooling Pattern

Rules:
- Each tool must validate inputs before execution.
- Tool results must be normalized to a stable shape.
- Reject ambiguous tool names and overlapping responsibilities.
- Enforce per-tool timeout and max retry budgets.

## Memory Pattern

Use explicit memory modes:
- `none`: stateless tasks (recommended default)
- `short`: bounded per-session context
- `thread`: durable thread history for multi-turn flows

Guardrails:
- Never persist secrets in memory blobs.
- Truncate/summarize context by token budget.
- Store source-of-truth domain data outside memory.

## Retry + Failure Strategy

Apply retries only for transient failures:
- model rate limits / transport failures
- temporary tool dependency outages

Do not retry:
- schema validation failures
- deterministic tool misuse
- authorization failures

Policy template:
- `maxAttempts`: 3
- exponential backoff with jitter
- phase timeout + global deadline
- fallback model only on transient model errors

## Observability Requirements

Each run must include:
- `runId`, `sessionId`, `taskId`, `correlationId`
- model name + latency + token usage
- selected tools + duration + success/failure
- retry count and failure reason taxonomy

Emit structured events for:
- executor start/end
- llm call start/end
- tool call start/end
- retry scheduled/performed
- terminal outcome

## Minimal Type Contracts

```ts
export type ExecutorOutcome =
  | { ok: true; output: string; citations?: string[] }
  | { ok: false; code: "timeout" | "validation" | "tool_error" | "model_error"; message: string };

export type ExecutorRunMeta = {
  runId: string;
  sessionId: string;
  taskId: string;
  correlationId: string;
  startedAt: string;
  finishedAt?: string;
  attempts: number;
};
```

## Prompting + Tool Routing Rules

- Keep system prompts short, explicit, and tool-aware.
- Prefer function/tool calling over free-form parsing.
- Require the model to explain why a tool is needed before invocation when cost is high.
- Set max tool iterations to prevent loops.
- Return partial results when non-critical tools fail.

## Debug Workflow

1. Reproduce with fixed seed/config where possible.
2. Inspect traces for the first divergence point.
3. Verify tool schema mismatch before blaming model quality.
4. Check memory window truncation and token pressure.
5. Tune prompt and tool descriptions after confirming runtime constraints.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
