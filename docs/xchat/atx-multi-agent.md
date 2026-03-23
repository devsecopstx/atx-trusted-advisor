# Multi-agent orchestration & xChat ↔ xStrategyBuilder

Single source for orchestration pattern, xChat integration, and scale notes. Diagram: [`atx-multi-agent-design-loop.mmd`](./atx-multi-agent-design-loop.mmd).

**Elsewhere (do not duplicate):** [`context-routing-multi-agent-policy.md`](./context-routing-multi-agent-policy.md) · [`../ops/api-consolidation-spring-backend.md`](../ops/api-consolidation-spring-backend.md) · `.cursor/skills/xdesign-review/SKILL.md` · `.cursor/plans/atx-backend-xchat-multi-agent-orchestrator.plan.md`

---

## Locked decisions (Phase 1)

| Topic | Decision |
|--------|-----------|
| **Orchestrator** | **Server-only** — Spring + Redis. **xStrategyBuilder** = UI only. |
| **Artifact v1** | Markdown + fenced JSON, validated server-side. Strict external JSON Schema → **v2**. |
| **Latency** | Default **async**. Target p50 ≤ 2.5s, p95 ≤ 7s from last slot → artifact; if p95 > 7s → polling + push. **Sync** = premium + flag. |
| **Isolation** | Jobs scoped **`userId` + `emailAccountId`**. No cross-tenant advisor reads. |
| **Caps** | Hard **12** strategy jobs/user/hour (`STRATEGY_MAX_JOBS_HOURLY`); soft warn at **8**. |
| **Traffic** | **BFF-only** — Next → Spring proxy, same-origin cookies. |
| **xAI collections** | **TEAM_XAI** — **`XAI_TEAM_ID`** per tenant. No `ATXFINANCE_COLLECTION_ID` / per-user bootstrap in Phase 1 tickets. Chat-history collections under the team only. |

---

## 1. Pattern (slots + orchestrator)

Multi-turn strategy flows need **state**, **one question per turn**, then a **final** model call with a filled template.

1. **Persist** jobs in **Mongo**; **Redis** for hot session / rate limits — key by **`userId` + `emailAccountId`** (+ `jobId` / conversation as needed).
2. **Slots** (example): `outlook`, `risk`, `horizon`, `underlying`, `capital`, `step`.
3. Each turn: load → if slots missing → **one** next question (numbered choices when possible) → parse → write → repeat.
4. When complete → context bundle (retrieval, portfolio if tools allow, quotes) → async artifact per SLO.
5. **Edits** (e.g. “change outlook”) → invalidate downstream slots / rewind `step`.

Thin HTTP handlers; async default; idempotent retries; hourly caps limit cost.

---

## 2. Layers

| Layer | Role |
|--------|------|
| **Orchestrator (Spring + Redis)** | Step machine, validation, persistence, idempotency, rate limits, multi-agent coordination. |
| **xChat `/ask`** | Responses API + tool loop; plan limits; streaming later. |
| **xStrategyBuilder** | Renders artifacts / review — **no** orchestration state. |

**Routing:** retrieval + tools before **multi-agent** (`grok-4.20-multi-agent`); clamp `agent_count` by plan.

**Handoff v1:** stable `jobId` / `correlationId` / optional `strategySessionId`; Markdown + fenced `json`; failures use structured codes (no silent fallback to generic chat).

---

## 3. Scale & ops

Async jobs meet SLOs; **idempotency** via `Idempotency-Key` or deterministic hash on `(userId, emailAccountId, jobId, step, message)`. Redis/Mongo queries filter **`userId` + `emailAccountId`**. **Streaming (later):** SSE from Spring, BFF stream-through — see consolidation doc. Artifacts: **job-backed**, async default; UI polls or push.

---

## Changelog

- **2026-03-23** — Consolidated docs + locked boundaries (server orchestrator, v1 artifact format, async SLOs, isolation, caps, BFF-only).
- **2026-03-24** — Phase 1 xAI: TEAM_XAI + `XAI_TEAM_ID` only; legacy default/bootstrap collection work out of Phase 1 scope.
