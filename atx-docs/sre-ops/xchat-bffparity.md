# xChat BFF Parity Plan (Spring Migration)

**Status:** Phase 1 shipped on branch `feature/spring-xchat-parity-phase1` (direct scan/watchlist SSE; xAI tool loop Phase 2)  
**Owner:** Samuel Perez / Architect  
**Last Updated:** 2026-05-11  
**Goal:** Make Spring the default path for `POST /api/xchat/ask/stream` with **full functional parity** to the current Next.js implementation, so we can safely set `XCHAT_SSE_PROXY_BACKEND=1` in production.

---

## 1. Current State (as of 2026-05-11)

- **Next.js** (`src/app/api/xchat/ask/route.ts` + `stream/route.ts`): Full production implementation
  - xAI Responses tool loop
  - Direct `options_action_scan` + `watchlist_snapshot` paths
  - RAG + persona collections
  - Distributed usage limits (Mongo)
  - Full SSE event stream (`meta`, `delta`, `turn`, `tool_status`, `provider`, `done`, `error`)
  - Vision, multi-agent reasoning, income ideas optimization, audit

- **Spring** (`XchatAskStreamController.kt` + `XchatAskService.kt`): Phase 1 stream
  - Virtual-thread controller delegates to `XchatAskService`
  - Direct `options_action_scan` / `watchlist_snapshot` intents emit `meta`, `turn`, `tool_status`, `delta`, `provider`, `done` (stub rows)
  - No real xAI Responses tool loop, RAG, or distributed usage limits yet

**Risk of enabling flag today:** High — would break real HNWI options scans.

---

## 2. Target State (Full Parity)

When `XCHAT_SSE_PROXY_BACKEND=1`:

- `POST /api/xchat/ask/stream` routes to Spring
- Spring handles:
  - Session + persona resolution
  - xAI Responses API tool loop (with function calling)
  - `atx_function` executor (`options_action_scan`, `watchlist_snapshot`, future tools)
  - RAG / collection search (via existing Spring RAG helpers)
  - Usage limit enforcement (same Mongo counters as Next)
  - Full SSE event emission (exact same shape as Next)
  - Audit lineage (`admin_audit_events`)
  - Fallback to Next on any failure (safety net)

**Non-goals for v1:** Streaming from Spring to xAI (keep non-streaming Responses + emit deltas), multi-agent parallel reasoning (Phase 2+).

---

## 3. Phased Rollout Plan

### Phase 1 — Foundation & Tool Loop Skeleton (Current — 1–2 days)

**Goal:** Make the Spring path functional for the most common HNWI use case ("Scan my options from holdings + watchlist").

**Deliverables:**

- Upgraded `XchatAskStreamController.kt` (virtual threads + real service)
- New `XchatAskService.kt` with:
  - Basic xAI Responses client (WebClient)
  - Tool routing for `options_action_scan` + `watchlist_snapshot`
  - Full SSE event emission (meta, delta, turn, tool_status, done, error)
  - Usage limit check stub + audit hook
- `XaiResponsesClientConfig.kt`
- Smoke test that the endpoint returns correct SSE shape

**Files to modify/create:**

1. `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/web/XchatAskStreamController.kt`
2. `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/xchat/XchatAskService.kt` (new)
3. `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/xchat/XaiResponsesClientConfig.kt` (new)
4. Update `atxfinance-backend-http-api.md` (add endpoint + Phase 1 note)
5. Update `PLAN.md` (add Phase 1 status)

**Acceptance Criteria:**

- `curl -N -H "Accept: text/event-stream" .../api/xchat/ask/stream` returns valid events
- `options_action_scan` path works end-to-end (stub data OK)
- No new environment variables required
- Falls back gracefully on error

---

### Phase 2 — Full xAI Tool Loop + Limits (3–5 days)

**Goal:** Replace stub with real xAI Responses + function calling + usage limits.

**Key Tasks:**

- Implement real `respondWithXaiToolLoop` equivalent in Kotlin (using WebClient + Reactor)
- Wire `AtxFunctionExecutor` for all current tools (`options_action_scan`, `watchlist_snapshot`, future)
- Implement `UsageLimitService` (Mongo `xchat_usage_limits` + distributed counters, same logic as Next)
- Add RAG / collection search (reuse existing `rag/` package)
- Full audit event writing (`admin_audit_events`)
- Persona + workspace snapshot loading
- Vision/image attachment support (optional in this phase)

**New/Modified Files:**

- `XchatAskService.kt` — major expansion
- New: `XaiToolLoopService.kt`
- New: `UsageLimitService.kt`
- Update: `AtxfinanceProperties.kt` (add xAI config if needed)
- Update: `atxfinance-backend-http-api.md`

**Acceptance Criteria:**

- Real xAI Responses calls succeed
- Usage limits enforced exactly like Next (429 with correct headers)
- Full event stream matches Next byte-for-byte
- Staging soak with real tenant data passes

---

### Phase 3 — Production Cutover (1–2 days)

**Goal:** Safely enable the flag in production.

**Tasks:**

- Set `XCHAT_SSE_PROXY_BACKEND=1` on Next Cloud Run (staging first)
- Update `bff-proxy-routes.ts` if needed
- Add observability (correlation IDs, latency metrics)
- Create rollback runbook (unset flag + redeploy)
- Update release notes + `current-state-features.md`
- Deprecate Next xChat ask logic (keep only as fallback)

---

## 4. Detailed Implementation Steps (Phase 1)

### Step 1: Controller Upgrade

Replace `XchatAskStreamController.kt` with the version that:

- Uses `Thread.ofVirtual()`
- Delegates to `XchatAskService`
- Removes the old stub message

### Step 2: Create XchatAskService.kt

Implement the service with:

- `streamAsk(...)` method
- SSE emission helpers (`emit`, `emitError`)
- Tool decision logic (`shouldRunOptionsScan`)
- Call to existing `atxFunctionExecutor`
- Placeholder for real xAI call (commented)

### Step 3: Add WebClient Config

Create `XaiResponsesClientConfig.kt` with base URL `https://api.x.ai/v1` and `XAI_API_KEY`.

### Step 4: Dependencies

No new dependencies needed (Spring WebClient + Reactor already present).

### Step 5: Testing

- Local: `./gradlew bootRun` + Postman / curl with `Accept: text/event-stream`
- Staging: Deploy → test "Scan my options from holdings + watchlist" prompt
- Verify events match Next.js exactly

---

## 5. How to Enable the Flag (After Phase 2)

1. Deploy Phase 2 to staging
2. Set `XCHAT_SSE_PROXY_BACKEND=1` on **Next** Cloud Run service only
3. Monitor:
   - Cloud Run logs for Spring
   - xChat error rate
   - Options scan success rate
4. If stable for 24h → promote to production
5. Rollback: unset the flag + redeploy Next (instant)

---

## 6. Risks & Mitigations

| Risk                        | Mitigation                              | Owner    |
|----------------------------|-----------------------------------------|----------|
| Spring tool loop slower    | Add timeout + fallback to Next          | Backend  |
| Usage limit drift          | Share same Mongo collection + logic     | Backend  |
| Missing RAG                | Phase 2 — reuse existing Spring RAG     | Backend  |
| Audit gaps                 | Write to `admin_audit_events` in Phase 2| SRE      |
| Client breakage            | Keep exact SSE event shape              | Frontend |

---

## 7. References

- Next.js implementation: `src/app/api/xchat/ask/route.ts`
- Current Spring stub: `XchatAskStreamController.kt`
- Tool executor: `strategy/` package (reuse for `atx_function`)
- Usage limits: `modules/xchat/ask-usage-limits.ts` (port to Kotlin)
- BFF proxy: `src/lib/bff-proxy-routes.ts`

---

**Next Action:**  
Phase 2 — wire real xAI Responses tool loop, Mongo usage limits, RAG, and audit; soak on staging before enabling **`XCHAT_SSE_PROXY_BACKEND=1`**.
