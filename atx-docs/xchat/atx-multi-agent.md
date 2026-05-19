# Multi-agent orchestration & xChat ↔ xOptions

**Docs index:** [`../README.md`](../README.md). Diagram: [`atx-multi-agent-design-loop.mmd`](./atx-multi-agent-design-loop.mmd).

**Elsewhere (do not duplicate):** [`context-routing-multi-agent-policy.md`](./context-routing-multi-agent-policy.md) · [`../sre-ops/api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md) · `.cursor/skills/xdesign-review/SKILL.md` · `.cursor/plans/backend-xchat-multi-agent-orchestrator.plan.md`

---

## Locked decisions (non-negotiable — Phase 1 only)

1. **Orchestrator** = **Spring + Redis** (server-only). **xOptions** (strategy builder) remains UI-only (renders artifacts / review — no orchestration state).
2. **xAI collections** = **TEAM-only** via **`XAI_TEAM_ID`** (no per-user bootstrap, no legacy default merges). Chat-history collections stay under that team when productized.
3. **Artifact** = **v1**: Markdown + fenced JSON block; **server-side validation**. **v2** strict JSON Schema is **deferred**.
4. **Default mode** = **async**. SLO: **p50 ≤ 2.5s**, **p95 ≤ 7s** from **`slots_complete` → artifact**; if p95 > 7s → polling + push. **Sync** = premium / flag **later** (not Phase 1 default).
5. **Routing** = **retrieval-first** + **selective tools**; **multi-agent** (`grok-4.20-multi-agent`) **only when explicitly needed**, **plan-limited** — clamp via **`clampMultiAgentParallelismForPlan`** on `POST /api/xchat/ask` ([`context-routing-multi-agent-policy.md`](./context-routing-multi-agent-policy.md)).
6. **Caps** = **12** strategy job **creates** / hour (**Redis-backed** when `REDIS_URL` is set; else Mongo count), **soft warn at 8**. Hourly scope matches job isolation: **`tenantId` + `userId` + `emailAccountId`** (Spring `app.atxfinance.strategy-max-jobs-hourly` / `strategy-soft-warn-jobs-hourly`). xChat multi-agent caps: **`clampMultiAgentParallelismForPlan`** ([`src/modules/xchat/plan-limits.ts`](../../src/modules/xchat/plan-limits.ts)).
7. **Isolation** = **`userId` + `emailAccountId`** (plus **`tenantId`** on rows and auth). BFF-only traffic: Next → Spring, same-origin cookies.

### Quick reference table

| Topic | Decision |
|--------|-----------|
| **Traffic** | **BFF-only** — Next → Spring proxy, same-origin cookies. |
| **Workspace preload** | Next materializes Mongo rows; **`GET /api/portfolios/{id}/snapshot`** on JVM (Redis `xf:wsnap:v1:*`, market-window TTL, **`data.structured`** strip) is the canonical fast-path when BFF + Redis are on — warms **`loadWorkspaceSnapshotPreload`** / find-options bootstrap; same keys as Next Redis cache; dual-run safe when origin unset. |
| **Config** | `STRATEGY_MAX_JOBS_HOURLY` env → `app.atxfinance.strategy-max-jobs-hourly` (default **12**); soft warn default **8**. |

---

## 1. Pattern (slots + orchestrator)

Multi-turn strategy flows need **state**, **one question per turn**, then a **final** model call with a filled template.

1. **Persist** jobs in **Mongo**; **Redis** for hourly create cap — key by **`tenantId` + `userId` + `emailAccountId`** (normalized, same as Mongo count; + `jobId` / conversation keys as needed later).
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
| **xChat `/ask`** | Responses API + tool loop; plan limits; **live token SSE** on Next (per-turn streaming + SSE **`done`** = JSON `data`). |
| **xOptions** | Renders artifacts / review — **no** orchestration state. |

**HTTP (Chunk 1):** Spring **`/api/strategy-jobs`** (BFF from Next when `ATXFINANCE_BACKEND_ORIGIN` set) — slot collection to `slots_complete`; see **[`../sre-ops/atxfinance-backend-http-api.md`](../sre-ops/atxfinance-backend-http-api.md)**.

**Routing:** retrieval + tools before **multi-agent** (`grok-4.20-multi-agent`); clamp `agent_count` by plan.

**Handoff v1:** stable `jobId` / `correlationId` / optional `strategySessionId`; Markdown + fenced `json`; failures use structured codes (no silent fallback to generic chat).

---

## 3. Scale & ops

Async jobs meet SLOs; **idempotency** via `Idempotency-Key` or deterministic hash on `(userId, emailAccountId, jobId, step, message)`. Redis/Mongo queries filter **`userId` + `emailAccountId`**. **xChat streaming (shipped):** Next emits SSE during the tool loop; Spring **`POST /api/xchat/ask/stream`** is BFF-forwarded when the product BFF gate is on (**`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** forces Next-only). Strategy artifacts: **job-backed**, async default; UI polls or push.

---

## Changelog

- **2026-05-07** — Document **live token SSE** for xChat ask on Next (per-turn `stream: true`, `done` = full JSON `data`); JVM **`/api/xchat/ask/stream`** BFF follows the main **`ATXFINANCE_BACKEND_ORIGIN`** gate with **`XCHAT_SSE_PROXY_BACKEND`** as an ops opt-out to Next-only streaming. Artifact **v2** JSON Schema remains **deferred**.
- **2026-04-03** — Non-negotiable Phase 1 list expanded (v2 schema deferred; `slots_complete`→artifact SLO anchor; routing + `clampMultiAgentParallelismForPlan`; Redis cap key aligned to `tenantId`+`userId`+`emailAccountId`; GET/turns enforce `emailAccountId` match).
- **2026-03-23** — Consolidated docs + locked boundaries (server orchestrator, v1 artifact format, async SLOs, isolation, caps, BFF-only).
- **2026-03-24** — Phase 1 xAI: TEAM_XAI + `XAI_TEAM_ID` only; legacy default/bootstrap collection work out of Phase 1 scope.
- **2026-03-25** — Roadmap status (shipped vs outstanding) for this track lives in [`../PLAN.md`](../PLAN.md) § **xChat Hardcore** (*Phase 1 — xChat → xOptions multi-agent*); design loop: [`atx-multi-agent-design-loop.mmd`](./atx-multi-agent-design-loop.mmd).
