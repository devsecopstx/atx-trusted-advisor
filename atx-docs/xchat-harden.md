# xChat Hardening Plan (Production Reliability for HNWI Advisor Sessions)

**Status:** Implementation Spec & Bugfix Roadmap — **Phase 1 `v3.18.6`** (limiter + meter parity); **Phase 2 `v3.18.7`** (observability + circuit breaker + admin usage + 429 UX); Phases 3–4 pending  
**Owner:** The Architect  
**Date:** 2026-05-10  
**Priority:** Critical — rate-limit bug observed in prod (hourly cap triggered on first prompt) + general production hardening for live options-trading conversations.

### Phase 1 shipped (2026-05-10, v3.18.6)

| Item | Change |
|------|--------|
| Per-minute burst `0` | `perMinuteLimit <= 0` skips burst enforcement (avoids `1 > 0` blocking every ask if misconfigured). |
| Hour meter vs enforcement | When workspace daily caps apply, **hour bucket always increments**; hourly **enforcement** only if `userChatHourlyLimit > 0`. Aligns `POST /api/xchat/ask` with `GET /api/app-user/xchat/prompt-usage` (`peekXchatAskUsageCounts`). |
| Daily cap coercion | Non-positive `dailyPromptLimit` falls back to tier `maxPromptsPerDay` (never `Math.max(1, 0)` → accidental **1/day**). Same rule in `mergeXchatPromptLimitsForWorkspace` for UI caps. |
| Tests | `tests/unit/xchat-usage-limits-enforcement.test.ts`, `tests/integration/plan-limits.test.ts` (non-positive `userChatLimit`). |

**Files:** `src/modules/xchat/ask-usage-limits.ts`, `src/modules/xchat/plan-limits.ts`, `src/app/api/xchat/ask/route.ts` (positive-only tenant daily override passed to limiter).

**Still verify in prod:** Tenant/plan rows with explicit `userChatLimit: 1` or `userChatHourlyLimit: 1` will legitimately cap after one successful prompt — distinguish from false positives via structured logs (Phase 2).

## Executive Summary

xChat is the primary interface for HNWI clients to get conservative, balanced, and aggressive options income strategies, portfolio reviews, and multi-agent orchestration. Current issues (from live screenshots):

- Hourly limit (`xchat_hourly_limit_exceeded`) incorrectly firing on the **very first prompt** of the session.
- Daily cap reached after 1 prompt (1/1 shown with red progress bar).
- Billing state `approved_unpaid` still shows warning banner even though workspace is fully usable.

**Goal:** Make xChat production-hardened, observable, abuse-resistant, and delightful for real-money users. Zero false-positive rate limits, sub-100ms limit checks, full audit trail, graceful degradation, and seamless integration with the new feature-flag system (`feature-flag.md`).

This plan builds on shipped foundations (`xchat-history-storage.md`, `tenant-workspace-limits.md`, `current-state-features.md`, `PLAN.md` § xChat Hardcore) and the just-committed unified tenant preferences.

## Observed Bugs (Screenshots 2026-05-10)

1. **False hourly limit on first prompt** — User at 0/1 prompts today, sends first message, immediately gets `xchat_hourly_limit_exceeded` + "Try again next hour".
2. **Daily cap incorrectly at 1/1** with red progress bar after single prompt.
3. **Billing banner persists** on `approved_unpaid` even though tenant/workspace limits are active.

Root cause hypothesis (to be confirmed in audit):
- UTC bucket initialization race or off-by-one in `xchat_usage_limits` minute/hour/day counters.
- `mergeTenantWorkspaceLimits` + `planOverrides` not correctly applying `userChatHourlyLimit: 0` (off) or tenant defaults for new users.
- Limiter middleware (`ask-usage-limits.ts` or equivalent) reading stale Redis/Mongo counters or applying global default instead of per-tenant + plan.

## Target Hardened State

- **Rate limiting**: Accurate UTC clock-hour + calendar-day buckets with proper reset. `userChatHourlyLimit: 0` or omitted = unlimited for that tenant/plan. Global admins bypass entirely.
- **Observability**: Every ask logs `correlationId`, tenant, user, plan, current counters, effective limits, and decision (allowed / throttled). Structured logs + OTLP metrics (`xchat_asks_total`, `xchat_limit_exceeded_total`).
- **Error UX**: Clear, actionable messages with "Contact your admin" or "Compare plans" links. No cryptic codes to end users.
- **Graceful degradation**: On limiter failure (Mongo/Redis down), allow the ask but log warning + increment circuit-breaker counter.
- **Abuse resistance**: Per-IP + per-user burst limits (separate from daily/hourly), vision-paste size/virus scan (already shipped but harden), multi-agent tool-loop caps.
- **Feature flags integration**: New flags `xchatRateLimitHardening`, `xchatGracefulDegradation`, `xchatVoiceInput` etc. managed via `/admin/tenant-preferences`.
- **Multi-tenant safety**: Strict tenant isolation on all counters and RAG collections.
- **Performance**: Limit check < 10 ms p99 (Redis primary, Mongo fallback).

## Implementation Phases for Cursor

### Phase 1: Bugfix — False Hourly/Daily Limit (2–3 hrs, ship today) ✅ *delivered v3.18.6*
1. Audit limiter code:
   - **`src/modules/xchat/ask-usage-limits.ts`** — Mongo `xchat_usage_limits` buckets (`minute` / `hour` / `day`), keys include user + tenant + bucket ISO start (UTC-aligned hour via epoch division).
   - Trace **`POST /api/xchat/ask`** → **`enforceDistributedAskUsageLimit`** (no Redis in this path).
2. Fix initialization / coercion:
   - Hour/day buckets still start at 0 via `$inc` upsert; **hour always incremented** when daily caps enforced so meters match sends.
   - **`userChatHourlyLimit: 0` or omitted** → no hourly enforcement (unchanged intent).
   - **Non-positive daily override** → tier default (fixes accidental **1/day** from `Math.max(1, 0)`).
3. **`mergeTenantWorkspaceLimits` / `applyTenantPlanRowToBase`** — already treat hourly `0` as unlimited; daily UI merge updated in **`mergeXchatPromptLimitsForWorkspace`** for non-positive `userChatLimit`.
4. Unit tests: **`tests/unit/xchat-usage-limits-enforcement.test.ts`** (+ plan-limits integration case).
5. Integration test: *optional follow-up* — live Mongo harness for first ask (current suite mocks ask route limiter where needed).
6. Deploy hotfix + monitor **`xchat_limit_exceeded_total`** (Phase 2) for 24 h.

### Phase 2: Observability & Hardening (4–6 hrs) ✅ *delivered v3.18.7*
1. **Structured logging** — `console.info(JSON.stringify({ msg: "[xchat/limit]", ... }))` on every ask after the limit check: `src/modules/xchat/xchat-limit-observability.ts` (`logXchatAskLimitDecision`). Fields: `correlationId` (header `x-correlation-id` / `x-request-id` / UUID), tenant, user, plan, `decision`, effective caps, observed bucket counts, `latencyMs`, `adminSession`, `limiterDegraded`. Documented in **`atx-docs/xchat/xchat-debug-logging.md`**.
2. **In-process metrics** (this Node instance; Cloud Logging can aggregate `[xchat/limit]` for multi-instance):
   - Counters + limit-check duration stats via `recordXchatLimitDecisionMetric` / `recordXchatLimitCheckDurationMs`; snapshot **`getXchatLimitMetricsSnapshot()`** on **`GET /api/admin/xchat/usage`**.
   - Maps approximate `xchat_asks_total` / `xchat_limit_exceeded_total` / duration until OTLP wiring exists.
3. **Circuit breaker** — After **3** consecutive Mongo/limiter exceptions, allow the ask (`limiter_degraded_allow`), `console.warn`, reset streak on next successful limit check.
4. **429 JSON** — `resetAt` (ISO8601), `contactAdmin: true`, `correlationId`; friendlier `error` strings. **`503`** limiter failures include `correlationId` when still failing before circuit opens.
5. **UI** — `xchat-conversation.tsx`: when `contactAdmin`, friendly headings + **Next window** / retry hint + billing link (no raw error codes in the title).
6. **Admin** — **`GET /api/admin/xchat/usage?userId={hex}&tenantId={hex}`** (`global_admin`): live `peekXchatAskUsageCounts`, merged workspace limits, merged prompt caps, limit metrics snapshot.

**Tests:** `tests/unit/xchat-limit-observability.test.ts`, `tests/integration/admin-xchat-usage-route.test.ts`.

### Phase 3: Abuse & Security Hardening (3 hrs)
1. Vision paste: enforce EXIF strip, max 8 MB JSON / 4 MB decoded, optional virus scan (ClamAV or external) before xAI vision call.
2. Burst protection: separate per-minute counter (already partially there) with tighter defaults (e.g. 10 asks/min per user).
3. Multi-agent tool loop: cap max turns (already 10 recent messages) + per-tool timeout + kill switch via feature flag.
4. RAG collection isolation: verify `resolveXchatPersonaDeclaredCollectionIds` never leaks across tenants.
5. History privacy: enforce `keepXchatHistory: false` default for new users (ephemeral) unless opted in.

### Phase 4: Feature-Flag Integration & Rollout (2 hrs)
1. Register new flags in `/admin/tenant-preferences` Feature Flags section:
   - `xchatRateLimitHardening` (default true after bugfix)
   - `xchatGracefulDegradation` (default true)
   - `xchatShowFriendlyLimitErrors` (default true)
2. Gate limiter changes behind the flag for safe canary.
3. Update `current-state-features.md` and `PLAN.md` with hardening status.
4. Add to pre-release checklist (`xchat/pre-release-check.md`).

## Success Criteria
- First prompt from new user **always succeeds** (no false hourly/daily limit).
- Hourly rollover accurate within ±5 s of UTC :00.
- p99 limit-check latency < 10 ms.
- 0 production 5xx or incorrect 429s in 7-day window post-deploy.
- Admin can view live usage for any user via new debug endpoint.
- All new flags manageable via unified tenant-preferences page (no env vars).

## Rollout Plan (Conservative, HNWI-Safe)
1. **Today**: Phase 1 bugfix + unit/integration tests → staging smoke → prod deploy (min-instances=1 on backend).
2. **+24 h**: Enable observability dashboards + alert on `xchat_limit_exceeded_total > 5/min`.
3. **+48 h**: Phase 2+3 hardening behind feature flag `xchatRateLimitHardening=true` (default on for core tenant).
4. **+1 week**: Full rollout, update release notes, close related PLAN.md items.

**This hardening ensures xChat remains the trusted, always-available advisor for your clients' options income and portfolio decisions — no more surprise throttles on their first question.**

---
*Cursor: implement Phase 1 immediately, then full plan. Run `npm run ci:gate` before any prod deploy. Escalate any edge-case (multi-replica counter sync, Redis failover, etc.) to Architect.*