# xChat BFF Parity (Spring Migration)

**Status:** Shipped (May 2026) — JVM **`POST /api/xchat/ask/stream`** matches Next SSE shape for direct scan/watchlist paths and the xAI Responses tool loop. **No open engineering items** on this track; production still defaults to Next until ops enables **`XCHAT_SSE_PROXY_BACKEND`**.  
**Owner:** Samuel Perez / Architect  
**Last Updated:** 2026-05-11  
**Goal:** Make Spring a safe optional path for **`POST /api/xchat/ask/stream`** with functional parity to the Next.js implementation, so **`XCHAT_SSE_PROXY_BACKEND=1`** can be turned on after staging soak.

---

## 1. Shipped behavior

- **Next.js** (`src/app/api/xchat/ask/route.ts` + `stream/route.ts`) remains the **default** production path (live token SSE, JSON fallback, full feature surface).
- **Spring** (`XchatAskStreamController.kt` + `XchatAskService.kt`):
  - Virtual-thread controller with distributed usage limits (**`XchatUsageLimitService`**, 429 + limit headers aligned with Next).
  - Direct **`options_action_scan`** / **`watchlist_snapshot`** intents with **`meta`**, **`turn`**, **`tool_status`**, **`delta`**, **`provider`**, **`done`**, **`error`**.
  - xAI Responses tool loop (**`XaiToolLoopService`**) with **`AtxFunctionExecutor`**, persona resolution, RAG context (**`XchatRagContextService`**), session log persistence, and **`admin_audit_events`** hooks.
  - BFF from Next only when **`ATXFINANCE_BACKEND_ORIGIN`** is set and **`XCHAT_SSE_PROXY_BACKEND`** is explicitly **`true` / `1` / `yes`** (`src/lib/xchat-live-sse-policy.ts`, `src/app/api/xchat/ask/stream/route.ts`).

**Non-goals (unchanged):** Streaming raw tokens from Spring to xAI (non-streaming Responses + emitted deltas); multi-agent parallel reasoning on the JVM path.

---

## 2. Ops cutover (optional)

1. Deploy current Spring + Next to **staging**.
2. Set **`XCHAT_SSE_PROXY_BACKEND=1`** on the **Next** Cloud Run service only (keep **`ATXFINANCE_BACKEND_ORIGIN`** on the Spring HTTPS origin).
3. Monitor Spring logs, xChat error rate, and options-scan success for 24h.
4. Promote to production or rollback by unsetting the flag and redeploying Next (instant).

---

## 3. Risks & mitigations

| Risk | Mitigation | Owner |
| ---- | ---------- | ----- |
| Spring tool loop slower | Timeout + Next fallback on proxy failure | Backend |
| Usage limit drift | Shared Mongo counters + same limit headers | Backend |
| Client breakage | Keep exact SSE event shape | Frontend |

---

## 4. References

- Next.js implementation: `src/app/api/xchat/ask/route.ts`
- Spring: `services/atxfinance-backend/.../xchat/XchatAskService.kt`
- BFF proxy: `src/lib/bff-proxy-routes.ts`
- Consolidation registry: [api-consolidation-spring-backend.md](./api-consolidation-spring-backend.md)
- JVM route inventory: [atxfinance-backend-http-api.md](./atxfinance-backend-http-api.md)
