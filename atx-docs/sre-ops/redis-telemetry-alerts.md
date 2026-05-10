# Redis telemetry + alerts (control/cache planes)

This runbook defines minimum observability for production Redis reliability on atxFinance.

## Scope

- **Control plane Redis**: auth, PKCE, distributed rate limiting, strategy quota
- **Cache plane Redis**: market quote cache, workspace snapshots, option-chain cache, lexical cache

Run each plane on a dedicated Redis instance (preferred) or at minimum isolated DB + ACL users.

## Mandatory dashboards

Create two dashboards (one per plane) with these charts:

1. **Connected clients**
2. **Blocked clients**
3. **Rejected connections**
4. **Used memory** (% and bytes)
5. **Command latency p95/p99** (GET, SET, INCR, EVAL)
6. **Ops/sec** (reads, writes, keyspace hits/misses)
7. **Evicted keys**

## Mandatory alert thresholds

Use the same policy for both planes:

- `connected_clients >= 80% maxclients` for 5m -> **warning**
- `connected_clients >= 90% maxclients` for 2m -> **critical**
- `blocked_clients > 0` for 2m -> **critical**
- `rejected_connections > 0` for 1m -> **critical**
- `used_memory / maxmemory >= 85%` for 5m -> **warning**
- `used_memory / maxmemory >= 92%` for 2m -> **critical**
- `p99 command latency > 20ms` for control plane -> **critical**
- `p99 command latency > 50ms` for cache plane -> **warning**

## Application-side signals (required)

### Next.js

- `x-atx-ratelimit-source` ratio (`redis` vs `memory`) must stay >95% Redis in steady-state.
- Log and count:
  - `[redis/control] connect failed`
  - `[redis/cache] connect failed`
  - `[rental-ai/concurrency] redis acquire failed; using in-process map`

### Spring

Track:

- strategy quota fallback-to-Mongo count
- auth filter Redis fail-open count
- Redis error counts by feature:
  - auth
  - strategy quota
  - workspace snapshot cache
  - option-chain cache

## On-call triage checklist

1. Verify which plane is degraded (control or cache).
2. If **control plane** degraded:
   - reduce Cloud Run max instances immediately
   - fail open on auth rate-limit path (already implemented)
   - verify strategy quota is falling back to Mongo
3. If **cache plane** degraded:
   - keep trading/control flows running
   - disable non-critical cache writes if needed
4. Confirm `connected_clients` falls below 70% after mitigation.

## 10-minute emergency actions

1. Cap Cloud Run max instances to connection budget.
2. Move Next cache plane to dedicated Redis if shared with control.
3. Confirm both health endpoints:
   - `GET /api/health` (Next)
   - `GET /api/backend/health` (Spring)
4. Validate strategy-job create path remains available.
