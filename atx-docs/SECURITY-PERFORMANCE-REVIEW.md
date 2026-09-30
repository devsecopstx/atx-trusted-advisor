# Security and Performance Review — ATX Trusted Advisor

**Review Date:** August 2026  
**Reviewer:** Automated Security Review (read-only)  
**Scope:** Application code (`src/`), services (`services/`), scripts, tests, deploy configuration, Docker/CI, agent guidance  

---

## Executive Summary

This read-only security and performance review of the ATX Trusted Advisor fintech application identified **5 high-severity**, **8 medium-severity**, and **4 low-severity** security findings, along with **6 performance** concerns. The codebase demonstrates generally strong security practices—proper session signing with HMAC-SHA256 and timing-safe comparison, scrypt password hashing, Stripe webhook signature verification, and fail-closed multi-tenancy patterns. However, several gaps require attention before scaling to a broader user base, particularly around secrets fallback behavior, rate limiting distribution, and in-memory cache bounds.

### Top 3 Priorities

1. **S-001 (HIGH):** Session signing secret fallback to OAuth client secret creates key-sharing risk
2. **S-002 (HIGH):** `ALLOW_ANY_X_USER_LOGIN` environment flag bypasses access-request gate if misconfigured
3. **P-001 (HIGH):** In-memory rate-limit/policy caches have unbounded growth potential per-instance

---

## Security Findings

### S-001: Session Signing Secret Fallback to OAuth Client Secret

**Severity:** HIGH  
**Location:** `src/lib/auth.ts`, lines 68–71

**Evidence:**
```typescript
function getSigningSecret(): string {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
}
```

**Impact:** When `AUTH_SECRET` is unset, the session cookie signing falls back to `X_OAUTH_CLIENT_SECRET`. This creates key reuse between two distinct security domains (session integrity vs OAuth client authentication). Compromise of either secret compromises both. In multi-service deployments where the OAuth secret may be shared, this increases the attack surface for session forgery.

**Recommended Fix:**
- Make `AUTH_SECRET` a required environment variable (remove the fallback)
- Add startup validation that fails if `AUTH_SECRET` is missing or shorter than 32 characters
- Update deploy workflows to verify `AUTH_SECRET` exists in Secret Manager before deploy

---

### S-002: ALLOW_ANY_X_USER_LOGIN Environment Flag Bypass Risk

**Severity:** HIGH  
**Location:** `src/lib/env.ts` (line 84), `src/modules/identity/repository.ts` (OAuth callback flows)

**Evidence:**
```typescript
ALLOW_ANY_X_USER_LOGIN: z.union([z.string(), z.boolean()]).optional(),
```
The flag is documented in `SECURITY.md` as requiring `false` in production, but no runtime enforcement prevents accidental enablement.

**Impact:** If `ALLOW_ANY_X_USER_LOGIN=true` is set in production, any authenticated X user can access the platform without going through the access-request approval workflow. This bypasses the tenant access gate entirely—critical for a fintech app with compliance requirements.

**Recommended Fix:**
- Add a startup warning/error in production (`NODE_ENV=production`) if this flag is true
- Consider removing this flag entirely or gating it behind an additional "I know what I'm doing" flag
- Add CI check that verifies this is `false` or unset in production deploy configs

---

### S-003: In-Memory Rate-Limit Fallback Not Distributed

**Severity:** HIGH  
**Location:** `src/lib/distributed-rate-limit.ts`, `src/lib/rate-limit.ts`

**Evidence:**
```typescript
// distributed-rate-limit.ts lines 135-152
const fallback = checkRateLimit({
  key,
  windowMs,
  max
});
```

**Impact:** When Redis is unavailable, rate limiting falls back to per-process in-memory buckets. In a Cloud Run deployment with multiple instances, each instance maintains independent counters. An attacker can bypass rate limits by distributing requests across instances (via DNS round-robin or load balancer behavior). The strict rate limits (6 req/min for auth routes) become effectively 6×N where N is the instance count.

**Recommended Fix:**
- Implement fail-closed behavior for critical auth routes when Redis is unavailable (return 503)
- Add monitoring/alerting for Redis rate-limit fallback events
- Consider a token-bucket algorithm with shared state or request signature deduplication

---

### S-004: Proxy Policy Cache Unbounded Growth

**Severity:** HIGH  
**Location:** `src/proxy.ts`, lines 56–66

**Evidence:**
```typescript
const tenantUxProxyCache = new Map<string, { allowed: boolean; redirectPath: string; expiresAt: number }>();
// ...
if (tenantUxProxyCache.size > 500) {
  const first = tenantUxProxyCache.keys().next();
  if (!first.done) {
    tenantUxProxyCache.delete(first.value);
  }
}
```

**Impact:** The cache size check only fires after 500 entries and removes only one entry at a time. Under high concurrent load with diverse session cookies, the cache can grow well beyond 500 entries before the eviction catches up. Similar patterns exist for `sessionGroundingCache` and `billingProxyCache`. This can lead to memory exhaustion in long-running processes.

**Recommended Fix:**
- Implement proper LRU cache with bounded size (use a library like `lru-cache`)
- Set cache bounds based on expected concurrent user sessions per instance
- Add memory monitoring and alerting for the Next.js process

---

### S-005: BFF Proxy Cookie Forwarding Without Re-validation

**Severity:** HIGH  
**Location:** `src/lib/backend-bff.ts`, lines 369–372

**Evidence:**
```typescript
const cookie = request.headers.get("cookie");
if (cookie) {
  headers.set("cookie", cookie);
}
```

**Impact:** The BFF proxy forwards all cookies (including the session cookie) to the Spring backend without additional validation at the proxy layer. While both services share the same signing secret (via Secret Manager), if the backend has a different session parsing implementation or vulnerability, the proxy becomes an amplification vector. The `shouldSkipPersonasBffProxyForPersonasListGet` comment explicitly notes session cookie parsing differences between Next and Spring.

**Recommended Fix:**
- Validate session signature in the proxy before forwarding (not just presence)
- Add correlation ID tracking between Next and Spring for audit trails
- Document the session cookie contract between services

---

### S-006: Stripe Webhook Missing Idempotency Key Handling

**Severity:** MEDIUM  
**Location:** `src/app/api/webhooks/stripe/route.ts`

**Evidence:** The webhook handler processes events but does not check for duplicate event IDs before processing:
```typescript
console.info("[webhooks/stripe] received", { id: event.id, type: event.type });
// ... processes event without checking if event.id was already handled
```

**Impact:** Stripe may redeliver webhooks (network issues, retries). Without idempotency tracking, the same subscription update could be processed multiple times, potentially causing race conditions in plan upgrades/downgrades or double-crediting trial periods.

**Recommended Fix:**
- Store processed `event.id` values in MongoDB or Redis with TTL
- Return 200 early for already-processed events
- Add idempotency check before any Mongo writes

---

### S-007: Session Grounding Fail-Open on Errors

**Severity:** MEDIUM  
**Location:** `src/proxy.ts`, lines 131–149, 163–170

**Evidence:**
```typescript
// Fail-open on transient origin errors
if (res.status >= 500 || res.status === 429) {
  return true;
}
// ...
} catch (err) {
  return true; // fail-open
}
```

**Impact:** Session grounding checks fail-open on network errors, timeouts, or 5xx responses. While this prevents service disruption from transient failures, a sustained attack or DDoS on the grounding endpoint could allow stale/revoked sessions to remain valid. The 401 code path for explicit denial is correct, but operational failures bypass enforcement.

**Recommended Fix:**
- Add circuit breaker pattern with configurable fail-closed threshold
- Track consecutive failures and fail-closed after N consecutive errors
- Add alerting on elevated session-grounding error rates

---

### S-008: OAuth State/Verifier Stored as Separate Cookies

**Severity:** MEDIUM  
**Location:** `src/lib/auth.ts`, lines 210–224

**Evidence:**
```typescript
response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, baseCookie);
response.cookies.set(OAUTH_VERIFIER_COOKIE_NAME, verifier, baseCookie);
```

**Impact:** PKCE state and verifier are stored in separate cookies. While both are httpOnly and secure, an attacker who can read one cookie (via XSS in a subdomain) might attempt timing attacks to correlate requests. Additionally, the 30-minute TTL (`OAUTH_FLOW_TTL_SECONDS = 60 * 30`) is generous for a redirect flow.

**Recommended Fix:**
- Reduce OAuth flow TTL to 5–10 minutes
- Consider combining state and verifier into a single signed cookie payload
- Add additional binding (e.g., client IP hash) to the state parameter

---

### S-009: PII in Debug Logs May Leak Under Tenant Debug Flag

**Severity:** MEDIUM  
**Location:** `src/lib/xchat-debug.ts` (referenced in `.cursor/rules/xfinance-chat-expert.mdc`)

**Evidence:** From the chat expert rule:
```
Opt-in structured logs: tenant Admin → Tenant workspace xChat debug 
(tenantPreferences.xchat_debug_enabled) → src/lib/xchat-debug.ts
...full prompts only in xchat_ask_full when enabled.
```

**Impact:** When a tenant admin enables xChat debug, full prompts (which may contain PII from the user's question or portfolio data) are logged. If Cloud Logging is accessible to operators without need-to-know, this creates a PII exposure vector. The rule mentions "masked ids" but full prompts are explicitly not masked.

**Recommended Fix:**
- Add PII detection/redaction to full prompt logging
- Gate `xchat_ask_full` logging behind an additional flag requiring SRE approval
- Add audit log entry when debug mode is enabled/disabled

---

### S-010: Admin Portfolio List-All Flag Has No Audit Trail

**Severity:** MEDIUM  
**Location:** `src/lib/env.ts`, line 144

**Evidence:**
```typescript
ADMIN_PORTFOLIOS_LIST_ALL: z.preprocess(
  (v) => { /* ... */ },
  z.boolean().optional().default(false)
)
```

**Impact:** When `ADMIN_PORTFOLIOS_LIST_ALL=true`, global admins can access any user's portfolio data across all tenants. This is documented as "support / break-glass" but there's no audit event specifically for cross-tenant portfolio access. Compliance requirements (especially for advisor workflows) may require explicit logging of who accessed whose data.

**Recommended Fix:**
- Add audit event when a global_admin accesses a portfolio outside their tenant
- Consider requiring a reason/ticket number for cross-tenant access
- Add alerting on elevated cross-tenant access patterns

---

### S-011: Email Credential Invite Token Entropy

**Severity:** MEDIUM  
**Location:** `src/lib/admin-user-credential-invite.ts` (referenced), `src/modules/identity/email-credentials-repository.ts`

**Evidence:** Token generation pattern not directly reviewed, but credential invite flows exist and are used for password setup.

**Impact:** If credential invite tokens have insufficient entropy or predictable generation, an attacker could brute-force valid tokens to hijack account setup. Standard is 256-bit entropy minimum for password reset tokens.

**Recommended Fix:**
- Verify token generation uses `crypto.randomBytes(32)` minimum
- Implement token usage limits (single use, short TTL)
- Add rate limiting on token verification endpoint

---

### S-012: MongoDB Connection String Logged on Parse Error

**Severity:** LOW  
**Location:** `src/lib/env.ts`, lines 322–338

**Evidence:**
```typescript
throw new Error("MONGODB_URI is not a valid MongoDB URI or base64 thereof");
```
The error message doesn't log the URI, but stack traces in production logging might capture the calling context.

**Impact:** Low risk—the actual URI is not in the error message, but verbose logging configurations could capture partial connection string data.

**Recommended Fix:**
- Ensure error logging configuration excludes environment variables from stack traces
- Use structured logging that explicitly omits sensitive fields

---

### S-013: Docker Image Runs as Non-Root (Positive) but EXPOSE 8080

**Severity:** LOW  
**Location:** `Dockerfile`, lines 19–32

**Evidence:**
```dockerfile
USER nextjs
EXPOSE 8080
```

**Impact:** The image correctly runs as non-root user `nextjs`. The EXPOSE directive is documentation only and doesn't create a security issue. Cloud Run maps to 8080 as expected.

**Recommended Fix:** None required—this is well-implemented.

---

### S-014: Script Environment Variable Handling in Seed Scripts

**Severity:** LOW  
**Location:** `scripts/seed-admin-user.mjs`, various sync scripts

**Evidence:** Scripts use `--env-file=.env` pattern and shell spawning for child processes.

**Impact:** Low risk—scripts run in controlled environments (local dev, CI), but ensure `.env` files are never committed and `.gitignore` covers all env variants.

**Recommended Fix:**
- Verify `.gitignore` includes `.env*` patterns (currently does)
- Add pre-commit hook to reject `.env` file commits

---

### S-015: Tenant Membership Grounding Includes Legacy Null Tenant Support

**Severity:** LOW  
**Location:** `src/lib/mongo-tenant-scope.ts`, lines 61–82

**Evidence:**
```typescript
$or: [
  { tenantId: oid },
  { tenantId: { $type: "null" } },
  { tenantId: { $exists: false } }
]
```

**Impact:** Legacy data migration patterns allow null/missing `tenantId` to match tenant-scoped queries. While necessary for backward compatibility, this could mask data isolation bugs where new documents are accidentally created without tenantId.

**Recommended Fix:**
- Add monitoring for documents created without tenantId in tenant-scoped collections
- Plan migration to strict tenant enforcement once legacy data is backfilled
- Add validation on write paths to reject missing tenantId

---

## Performance Findings

### P-001: In-Memory Cache Eviction Under Load

**Severity:** HIGH  
**Location:** `src/proxy.ts` (all three policy caches), `src/lib/rate-limit.ts`

**Evidence:** Cache size checks use FIFO eviction of a single entry when size exceeds 500:
```typescript
if (tenantUxProxyCache.size > 500) {
  const first = tenantUxProxyCache.keys().next();
  // ...
}
```

**Impact:** Under burst traffic with many unique sessions, caches can grow significantly beyond the nominal 500-entry limit before eviction keeps pace. This applies to `tenantUxProxyCache`, `billingProxyCache`, `sessionGroundingCache`, and the rate-limit `buckets` map. Memory pressure in long-running Next.js processes can cause GC pauses or OOM.

**Recommended Fix:**
- Replace with `lru-cache` library with hard max size
- Consider TTL-based eviction in addition to size limits
- Add process memory monitoring to Cloud Run health checks

---

### P-002: Triple Validation Fetch on Protected Routes

**Severity:** MEDIUM  
**Location:** `src/proxy.ts`, `proxy()` function lines 639–665

**Evidence:**
```typescript
const grounding = await enforceSessionGrounding(request, pathname);
const billingEnforced = await enforceBillingAccess(request, pathname);
if (isTenantUxEnforcementV2Enabled()) {
  const enforced = await enforceTenantUxV2(request, pathname);
}
```

**Impact:** Every protected page/API request makes up to 3 internal fetch calls (session grounding, billing access, tenant UX policy). While caches mitigate repeat calls, cache misses on cold starts or after TTL expiration create latency spikes. The `PROXY_INTERNAL_ORIGIN_FETCH_TIMEOUT_MS = 10_000` timeout means worst-case 30 seconds of validation before serving content.

**Recommended Fix:**
- Combine validation checks into a single internal endpoint
- Implement request coalescing for concurrent validations of the same session
- Reduce individual fetch timeout and add circuit breaker

---

### P-003: MongoDB Connection Pool Size Fixed at 20

**Severity:** MEDIUM  
**Location:** `src/lib/mongodb.ts`, line 26

**Evidence:**
```typescript
const client = new MongoClient(mongoUri, {
  maxPoolSize: 20
});
```

**Impact:** Cloud Run instances can serve many concurrent requests. With 20 connections and potentially hundreds of concurrent requests during traffic spikes, MongoDB operations queue behind the pool limit. This is particularly impactful for the complex xChat ask flow which performs multiple DB operations.

**Recommended Fix:**
- Make `maxPoolSize` configurable via environment variable
- Size pool based on expected instance concurrency (Cloud Run max concurrent requests)
- Add connection pool monitoring and alerts

---

### P-004: xChat Ask Route Multi-Turn Context Loading

**Severity:** MEDIUM  
**Location:** `src/app/api/xchat/ask/route.ts`

**Evidence:** The route performs extensive context loading:
- Load session user
- Load persona (cached)
- Load user settings
- Load default portfolio
- Build workspace snapshot
- Load recent chat history (up to 10 messages)
- Perform RAG search (if collections configured)
- Check usage limits (Redis)
- Build tool definitions
- Execute xAI tool loop

**Impact:** Cold-path latency for xChat can be significant. The documented baseline is "~51s total ask" with tool_loop_total dominating. While xAI response time is external, the local context building adds measurable overhead.

**Recommended Fix:**
- Pre-warm workspace snapshots on session start
- Parallelize independent context fetches (settings, portfolio, history)
- Cache RAG results for recently-used symbols/topics
- Consider background precomputation of common context combinations

---

### P-005: Yahoo Quote Batch Caching TTL

**Severity:** LOW  
**Location:** `src/lib/redis-client.ts`, lines 136–159

**Evidence:**
```typescript
export function getRedisQuoteCacheTtlSeconds(): number {
  // Default 30s, max 3600s
}
export function getRedisQuoteCacheTtlClosedSeconds(): number {
  // Default 300s (5min) for closed market
}
```

**Impact:** The 30-second TTL during market hours creates frequent cache misses and Yahoo API calls. For multiple concurrent users viewing similar symbols, this is suboptimal. The closed-market 300s TTL is more reasonable.

**Recommended Fix:**
- Consider increasing market-hours cache to 60s (quotes are typically ~15min delayed anyway)
- Implement read-through caching for batch symbol requests
- Add Yahoo API call rate monitoring

---

### P-006: Redis Connection Retry Backoff

**Severity:** LOW  
**Location:** `src/lib/redis-client.ts`, lines 181–185

**Evidence:**
```typescript
function resolveBackoffMs(consecutiveFailures: number): number {
  const exp = Math.max(0, Math.min(8, consecutiveFailures));
  return Math.min(60_000, 250 * 2 ** exp);
}
```

**Impact:** The backoff caps at 60 seconds, which is reasonable. However, during extended Redis outages, all instances will retry simultaneously after the backoff expires, creating a thundering herd effect.

**Recommended Fix:**
- Add jitter to the backoff calculation
- Consider per-instance random offset to stagger reconnection attempts

---

## Prioritized Next-Step Sequence

### Immediate (Before Next Production Deploy)

1. **S-001:** Enforce `AUTH_SECRET` as required (remove OAuth secret fallback)
2. **S-002:** Add production guard for `ALLOW_ANY_X_USER_LOGIN`
3. **P-001:** Replace in-memory caches with bounded LRU implementations

### Short-Term (Next 2–4 Weeks)

4. **S-003:** Implement fail-closed rate limiting for auth routes when Redis is unavailable
5. **S-004:** Address proxy policy cache unbounded growth (related to P-001)
6. **S-006:** Add Stripe webhook idempotency tracking
7. **P-002:** Combine proxy validation fetches into single endpoint
8. **P-003:** Make MongoDB pool size configurable, tune for Cloud Run concurrency

### Medium-Term (1–2 Months)

9. **S-007:** Implement circuit breaker for session grounding
10. **S-009:** Add PII redaction to xChat debug logs
11. **S-010:** Add audit trail for cross-tenant portfolio access
12. **P-004:** Optimize xChat context loading with parallelization and pre-warming

### Backlog

13. **S-005:** Document session cookie contract between Next and Spring BFF
14. **S-008:** Reduce OAuth flow TTL and consider state/verifier consolidation
15. **S-011:** Verify credential invite token entropy
16. **S-015:** Plan migration to strict tenant enforcement
17. **P-005/P-006:** Fine-tune cache TTLs and Redis reconnection jitter

---

## Non-Goals / Items Verified as Acceptable

The following areas were reviewed and found to be well-implemented:

### Authentication & Session Management
- ✅ Session cookies use HMAC-SHA256 with `timingSafeEqual` for signature verification
- ✅ Session payload includes `exp` timestamp with 12-hour TTL and sliding window refresh
- ✅ Cookie security attributes properly set (`httpOnly`, `secure` in production, `sameSite: lax`)
- ✅ PKCE (Proof Key for Code Exchange) implemented for OAuth flows

### Password Security
- ✅ Scrypt parameters are strong: N=32768, r=8, p=1, keylen=64
- ✅ 16-byte random salt per password
- ✅ Timing-safe comparison for password verification

### Stripe Integration
- ✅ Webhook signature validation using `stripe.webhooks.constructEvent`
- ✅ Secret key never exposed to client (server-only)
- ✅ Proper handling of subscription lifecycle events

### Multi-Tenancy
- ✅ `mongoMatchNothingFilter()` provides fail-closed default for missing tenant context
- ✅ `parseTenantObjectId()` validates tenant IDs before use
- ✅ Tenant-scoped queries use proper `$or` patterns for legacy data

### Authorization
- ✅ Role-based access control with clear role hierarchy (`global_admin`, `advisor`, `operator`, `viewer`)
- ✅ `requireAdminSession` and `requireSessionUser` helpers enforce authentication
- ✅ Persona governance includes draft/published/archived status workflow

### Secrets Management
- ✅ All production secrets via GCP Secret Manager (not GitHub Actions secrets)
- ✅ Dedicated Cloud Run runtime service accounts (not default compute)
- ✅ Workload Identity Federation for GitHub Actions authentication

### Docker & Deployment
- ✅ Multi-stage build minimizes final image size
- ✅ Non-root user in production image
- ✅ `NEXT_TELEMETRY_DISABLED=1` set

### CI/CD
- ✅ Manual confirmation gate for deploys (`confirm_manual_approval`)
- ✅ Concurrency control prevents overlapping deploys to same target
- ✅ Health check verification post-deploy
- ✅ Secret existence validation before deploy

### Agent/Skills Guidance
- ✅ `.cursor/rules/xfinance-chat-expert.mdc` includes security checklist
- ✅ Skills documentation emphasizes non-destructive operations
- ✅ PII masking guidance in debug logging rules

---

## Appendix: Files Reviewed

### Core Security
- `src/lib/auth.ts` — Session management, PKCE, cookie handling
- `src/lib/env.ts` — Environment validation, secrets parsing
- `src/lib/password-crypto.ts` — Password hashing (scrypt)
- `src/modules/identity/authorization.ts` — Role-based access control
- `src/proxy.ts` — Edge middleware, session grounding, policy enforcement

### API Security
- `src/app/api/webhooks/stripe/route.ts` — Payment webhook handling
- `src/app/api/admin/users/route.ts` — Admin user management
- `src/app/api/xchat/ask/route.ts` — AI chat endpoint
- `src/app/api/internal/authz/session-grounding/route.ts` — Session validation

### Multi-Tenancy
- `src/lib/mongo-tenant-scope.ts` — Tenant isolation patterns
- `src/lib/mongodb.ts` — Database connection

### Rate Limiting
- `src/lib/rate-limit.ts` — In-memory rate limiting
- `src/lib/distributed-rate-limit.ts` — Redis-backed rate limiting

### BFF/Proxy
- `src/lib/backend-bff.ts` — Spring backend proxy

### Configuration
- `Dockerfile` — Container build
- `.github/workflows/deploy-cloud-run.yml` — CI/CD pipeline
- `SECURITY.md` — Security policy
- `AGENTS.md` — Operational runbook

### Agent Guidance
- `.cursor/rules/xfinance-chat-expert.mdc` — Chat development rules
- `.cursor/rules/xfinance-branding.mdc` — Branding rules
- `.cursor/skills/` — Project-local skills

---

*This document is a plan only. No application code, tests, configuration, or infrastructure has been modified.*
