---
id: ai-agent-integration
name: ai-agent-integration
description: Build and integrate AI-powered async agents in Node.js/TypeScript using libraries like LangChain or TensorFlow.js. Use when the user asks about agent orchestration, option scanners, strategy builders, polling loops, task IDs, job state tracking, streaming progress, or real-time context for card-based UI flows such as A2A cards.
---

# AI Agent Integration

## Purpose

Implement production-ready AI integrations for async agents that run as jobs and report progress to the UI in real time.

## Use This Skill When

- Building option scanners, strategy builders, or research agents
- Designing async job APIs (`start`, `status`, `cancel`, `result`)
- Adding polling, retry, and timeout handling
- Attaching rich, real-time context updates to UI cards
- Coordinating LLM/tool pipelines with predictable task state

## Default Stack

- Runtime: Node.js + TypeScript
- LLM orchestration: LangChain (preferred for tool chaining and memory)
- ML inference: TensorFlow.js (when local model execution is required)
- Transport for updates: SSE first, WebSocket if bidirectional control is needed
- Persistence: MongoDB/Redis for task state and context snapshots

## Implementation Workflow

1. Define a typed task lifecycle: `queued -> running -> succeeded | failed | cancelled`.
2. Generate a durable `taskId` and persist initial metadata immediately.
3. Execute agent work in a background worker or queue consumer.
4. Emit incremental progress events (`phase`, `percent`, `message`, `contextDelta`).
5. Expose status endpoint optimized for polling and optionally SSE for live updates.
6. Store final artifacts separately from transient progress logs.
7. Enforce idempotency and cancellation checks at every major step.

## Required Contracts

Use strict TypeScript types (no `any`) for job APIs and event payloads.

```ts
export type AgentTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentTask = {
  taskId: string;
  status: AgentTaskStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  progressPercent: number;
  phase: "init" | "planning" | "tooling" | "synthesizing" | "finalizing";
  message?: string;
  error?: { code: string; message: string };
  resultRef?: string;
  context: {
    symbol?: string;
    timeframe?: string;
    strategyId?: string;
    cardId?: string;
    correlationId: string;
  };
};
```

## API Pattern

- `POST /api/agents/:agentType/tasks` -> returns `{ taskId, status }`
- `GET /api/agents/tasks/:taskId` -> returns full typed state for polling
- `GET /api/agents/tasks/:taskId/events` -> SSE stream of progress deltas
- `POST /api/agents/tasks/:taskId/cancel` -> best-effort cancellation

Polling guidance:

- Client starts at 1s interval, backs off to 2s/3s/5s after stable phases.
- Stop polling on terminal states.
- Resume from last known version to avoid duplicate UI updates.

## Reliability Rules

- Always include `correlationId` for traceability across logs and events.
- Persist before publish to avoid phantom task states.
- Make retries idempotent via deterministic task keys.
- Validate all tool outputs before passing to downstream LLM steps.
- Add execution deadlines per phase and a global timeout.

## A2A Card Context Pattern

For card-based real-time UX, emit compact deltas instead of full payloads:

```ts
export type CardContextDelta = {
  taskId: string;
  cardId: string;
  version: number;
  ts: string;
  patch: {
    kind: "metric" | "signal" | "insight" | "risk" | "action";
    key: string;
    value: string | number | boolean;
  }[];
};
```

Rules:

- Monotonic `version` per `taskId + cardId`
- Apply deltas atomically on the client
- Reconcile with full snapshot every N deltas or on reconnect

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
