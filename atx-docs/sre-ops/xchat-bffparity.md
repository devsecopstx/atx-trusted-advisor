# xChat BFF Parity (Spring Migration)

**Status:** Shipped (May 2026) — JVM **`POST /api/xchat/ask/stream`** matches Next SSE shape for direct scan/watchlist paths and the xAI Responses tool loop. **BFF default:** when **`ATXFINANCE_BACKEND_ORIGIN`** is set and the product BFF gate is on (same rules as portfolios / admin plane), Next **forwards** the browser stream to Spring. Set **`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** on Next to **force in-process** streaming (ops opt-out).  
**Owner:** Samuel Perez / Architect  
**Last Updated:** 2026-05-13  
**Goal:** Spring is a first-class path for **`POST /api/xchat/ask/stream`** with functional parity to the Next.js implementation; local dev keeps Next when the gate skips loopback.

---

## 1. Shipped behavior

- **Next.js** (`src/app/api/xchat/ask/route.ts` + `stream/route.ts`) serves **in-process** SSE when the BFF gate is off or when **`XCHAT_SSE_PROXY_BACKEND`** opts out (live token SSE, JSON fallback, full feature surface).
- **Spring** (`XchatAskStreamController.kt` + `XchatAskService.kt`):
  - Virtual-thread controller with distributed usage limits (**`XchatUsageLimitService`**, 429 + limit headers aligned with Next).
  - Direct **`options_action_scan`** / **`watchlist_snapshot`** intents with **`meta`**, **`turn`**, **`tool_status`**, **`delta`**, **`provider`**, **`done`**, **`error`**.
  - xAI Responses tool loop (**`XaiToolLoopService`**) with **`AtxFunctionExecutor`**, persona resolution, RAG context (**`XchatRagContextService`**), session log persistence, and **`admin_audit_events`** hooks.
  - BFF from Next when **`isXchatSseProxyBackendEnabled()`** is true — delegates to **`shouldProxyPortfolioRequestsToBackend()`** (unset origin ⇒ false; loopback + dev/test ⇒ false; otherwise true unless **`XCHAT_SSE_PROXY_BACKEND`** opts out).

**Non-goals (unchanged):** Streaming raw tokens from Spring to xAI (non-streaming Responses + emitted deltas); multi-agent parallel reasoning on the JVM path.

---

## 2. Ops cutover

1. Deploy current Spring + Next to **staging**.
2. Set **`ATXFINANCE_BACKEND_ORIGIN`** on the **Next** Cloud Run service to the Spring HTTPS origin (same as other BFF routes).
3. Confirm **`POST /api/xchat/ask/stream`** hits Spring (logs). If you need Next-only SSE temporarily, set **`XCHAT_SSE_PROXY_BACKEND=false`** on Next only.
4. Monitor Spring logs, xChat error rate, and options-scan success; promote to production or unset origin / opt-out to roll back.

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
