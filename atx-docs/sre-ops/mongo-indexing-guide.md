# MongoDB indexing — core principles (atxfinance)

Apply these **before** adding or dropping indexes. This repo spreads indexes across **Next.js** (`ensure*Indexes` in `src/modules/**`) and **atxfinance-backend** (Spring `MongoTemplate`).

## 1. Query patterns first, indexes second

- Copy the **exact** filter, sort, projection, and limit from application code (or `mongosh` trace).
- Run `db.<collection>.find(<filter>).sort(<sort>).limit(<n>).explain("executionStats")`.
- Accept an index only when `executionStats.totalDocsExamined` is in line with the limit (ideally **close to `nReturned`**) and `stage` is not a full `COLLSCAN` on hot paths.

## 2. Compound indexes win

- Prefer **equality fields first**, then **sort/range** fields (e.g. `tenantId` + `userId` + `createdAt` desc).
- Finance-style paths (portfolio / tenant / user / time) almost always need **multi-key** compounds, not single-field indexes alone.

## 3. Covering indexes (optional win)

- If the query’s projection is a subset of index keys, Mongo can satisfy the query from the index alone (`COVERED` or `PROJECTION_COVERED` in explain).
- Don’t force covering at the cost of many redundant indexes.

## 4. Write penalty

- Rule of thumb: each extra index costs roughly **10–20%** more work on inserts/updates to that collection.
- atxfinance has **moderate** write volume on book data; keep book indexes **tight** and justified by real queries.

## 5. Partial and sparse indexes

- Use **partial** indexes when a subset of documents drives a hot path (e.g. rows with `xaiResponseId` set, or `idempotencyKey` present).
- **Sparse** helps when the field is missing on many documents and you index that field alone.

## 6. TTL

- **`xchat_logs`**: TTL on `retentionExpiresAt` with `expireAfterSeconds: 0` — see `createXchatLogIndexes` in `src/modules/xchat/repository.ts`. Do **not** add a second TTL on `createdAt` unless product retires per-row retention (would double-delete or fight the TTL monitor).
- **`strategy_jobs`**: TTL on `expiresAt` when `app.atxfinance.strategy-jobs-ttl-days > 0` — see `StrategyJobMongoIndexes` + `StrategyJobService` in the backend. Set to **`0`** to disable TTL and omit `expiresAt` on new jobs.

## Workspace snapshot hot path (xChat / `atx_function`)

`workspaceContentRev` lives on **`tenant_portfolio`** only (bumped on book writes); child collections do **not** store `contentRev`. Snapshot queries are portfolio- and user-scoped:

| Collection | Index (ensured in `createPortfolioIndexes`) | Matches |
|------------|---------------------------------------------|---------|
| `portfolio_positions` | `idx_positions_snapshot_portfolio_account_user_tenant_created` `{ portfolioId, accountId, userId, tenantId, createdAt }` | `listPortfolioPositionsByAccount` + `createdAt` sort |
| `portfolio_accounts` | `idx_accounts_snapshot_portfolio_user_default_created` `{ portfolioId, userId, isDefault, createdAt }` | `listPortfolioAccounts` sort |
| `portfolio_watchlists` | `idx_watchlists_snapshot_portfolio_user` `{ portfolioId, userId }` | `getPortfolioWatchlist` |

Default portfolio resolution uses **`uniq_default_portfolio_per_user`** (`tenantId`, `userId`, `isDefault` partial) — no extra `_id` + `ownerUserId` index (schema uses `userId`, and `_id` is already indexed).

## Inventory (high level)

| Area | Where indexes are ensured | Notes |
|------|---------------------------|--------|
| Identity / tenants | `ensureIdentityIndexes` | Unique email, sparse X/Google ids, partial default tenant |
| Portfolios / book | `createPortfolioIndexes` in `core-admin/repository` | Compound + partial uniques (`isDefault`, `yahooRef`) |
| xChat personas / logs | `createPersonaIndexes`, `createXchatLogIndexes` | Personas: unique `nameNormalized`. Logs: history compounds, pending xAI sync, TTL on `retentionExpiresAt`, partial index for rows with `xaiResponseId` (latest-response id path) |
| Strategy jobs | `StrategyJobMongoIndexes` (backend) | `idx_strategy_jobs_scope_created_desc`, `idx_strategy_jobs_scope_status_created_desc`, partial idempotency, optional TTL on `expiresAt` (`STRATEGY_JOBS_TTL_DAYS`, **0** = off) |
| Usage / cache | `ask-usage-limits`, `feature-daily-usage`, scanner cache | TTL on ephemeral keys |

## Ops checklist when changing queries

1. Update the repository query (filter/sort).
2. `explain("executionStats")` in staging with production-like data shape.
3. Add or adjust **one** compound or partial index.
4. Re-run explain; watch `totalDocsExamined` and `rejectedPlans` in `allPlansExecution`.

---

## 7. Advanced tactics (after basics are stable)

### 7.1 Covered-query / index-only verification

After adding or changing an index, re-run the same `.find(...).project(...)` with `.explain("executionStats")`.

- **`executionStats.totalDocsExamined`**: For a true **covered** read, this is often **`0`** (all data from the index). More commonly you first aim for **`totalDocsExamined` ≈ `nReturned`** (no extra doc fetches beyond what the plan needs).
- **Plan shape**: Look for a winning path that stays on **`IXSCAN`** without a **`FETCH`** that re-reads the collection for fields not in the index. Older drivers reported **`indexOnly: true`**; newer plans may show **`PROJECTION_COVERED`** / covered projection stages — treat those as the same intent.
- Full snapshots (e.g. workspace preload) **usually are not** covered queries because the app projects many fields; don’t chase `totalDocsExamined: 0` at the cost of huge compound indexes.

### 7.2 Collation on `symbol` (this repo)

**`portfolio_positions`** and watchlist symbols are **normalized to uppercase** on write (`trim` + `toUpperCase` in `src/modules/core-admin/repository.ts` and related paths). Matching queries should use the same normalization.

- **Do not** add `{ locale: "en", strength: 2 }` collation to symbol indexes **unless** you introduce case-insensitive lookups **without** normalizing input first (legacy mixed-case rows would be the other reason).
- If you add collation to an index, **every** query using that index must pass the **same** `collation` option or Mongo may ignore the index.

### 7.3 Wildcard indexes

Use **`$**`** / wildcard indexes **only** as a last resort (dynamic metadata bags, unknown keys). They are **expensive** on writes and storage. This codebase does not rely on them; prefer explicit compounds + partials tied to real filters.

### 7.4 Sharding (long-term, very large tenants)

When a **single** book collection approaches **~500k+** documents **and** Atlas/self-hosted sharding is in play:

- Prefer a **high-cardinality** shard key that matches tenant isolation: e.g. **`tenantId` + `userId`** (or **`portfolioId`** where the collection is already portfolio-scoped).
- Avoid monotonically increasing shard keys on **every** insert unless you understand hot-shard risk.

Sharding is **not** configured in-repo today; treat this as architecture guidance when scaling HNWI / multi-tenant load.

### 7.5 Redis workspace snapshot cache (write-through pattern)

Implementation: **`src/modules/xchat/workspace-snapshot-cache.ts`** + **`loadWorkspaceSnapshotPreload`** in **`src/modules/xchat/workspace-snapshot-for-prompt.ts`**.

| Concept | In this repo |
|--------|----------------|
| Key idea | `workspace:<portfolioId>:<rev>` (conceptual) |
| Actual key | **`buildWorkspaceSnapshotCacheKey`**: `xf:wsnap:v1:<tenantId|_>:<userId>:<portfolioHex>:<workspaceContentRev>` — includes **tenant + user** so two users never share one portfolio key by accident. |
| Value | Full serialized snapshot JSON (same payload used for xChat system prompt / tool preload). |
| TTL | **`REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS`** — clamped **30–900**, default **120**. For aggressive Mongo offload on hot paths, set **30–60** in env (see `.env.example`). |
| Invalidation | **Write-through / bump**: **`bumpPortfolioWorkspaceContentRev`** on the portfolio increments **`workspaceContentRev`**, so cache keys **miss** after positions, accounts, watchlist, or relevant portfolio writes — Mongo remains source of truth; Redis is an optional layer. |
| Fallback | If **`REDIS_URL`** is unset, an **in-process** LRU-style map is used (same TTL semantics; not shared across instances). |

TLS / connection notes: **`atx-docs/sre-ops/redis-cache-next.md`** (`REDIS_TLS`, `rediss://` vs plain).

---

## 8. Monitoring & validation (post-change)

### 8.1 MongoDB profiler & hosted tools

- **Atlas:** Use **Performance Advisor**, **Query Profiler**, and **Real-Time Performance Panel** to catch regressions after index or query changes. Prefer fixing slow queries with compounds/partials (this guide) over raising cluster tier first.
- **Self-hosted / Ops Manager:** Enable the **profiler** at a sane threshold, e.g. `db.setProfilingLevel(1, { slowms: 50 })` (level **1** = operations slower than `slowms`; adjust to your baseline). Inspect **`system.profile`** or your monitoring UI equivalent.
- **Legacy / enterprise:** MongoDB **Cloud Manager** / **Ops Manager** can surface top slow ops if you run managed agents against the deployment.

Turn **off** or tighten profiling after the investigation window — sustained level **2** (all ops) is heavy on busy clusters.

### 8.2 xChat debug: workspace snapshot timing

With **`ENABLE_XCHAT_DEBUG=true`** and/or **Admin → Tenant workspace → xChat debug** (see **`atx-docs/xchat/xchat-debug-logging.md`**), **`src/modules/xchat/workspace-snapshot-for-prompt.ts`** logs:

| `type` | Meaning |
|--------|---------|
| `workspace_snapshot_load` | End-to-end **`loadWorkspaceSnapshotPreload`**: `elapsedMs`, `source` (`cache` \| `mongo` \| `null`), optional `portfolioId` / `workspaceContentRev`. |
| `workspace_snapshot_build` | Mongo-only **build** inside `buildPreloadFromPortfolio`: `elapsedMs`, `positionCount`, `source: "mongo"`. |

**Targets (operator SLOs, not enforced in code):**

- **`workspace_snapshot_load`** with **`source: "cache"`** — aim **&lt; 50 ms** (Redis + JSON parse + validation).
- **`source: "mongo"`** (cold miss or rev bump) — depends on region and book size; with snapshot indexes + a small book (e.g. **~8 positions**), expect **well under** a few hundred ms before other stack latency.
- Compare **before/after** index or Redis TLS fixes using the **same** portfolio and persona so `elapsedMs` is apples-to-apples.

Filter in Cloud Logging / local console: `textPayload=~"\[xchat/debug\]"` and JSON `type` = `workspace_snapshot_load` (or substring `workspace_snapshot_`).

### 8.3 Regression test checklist (xChat ask)

1. Use a **known portfolio** (e.g. your usual **~8 positions** smoke book) so position/account/watchlist counts are stable.
2. Use the **persona you care about for that role**: approved app users typically resolve to the **Advisor** / trusted-advisor stack; **`global_admin`** sessions often default to **Super-Agent** — match **`AGENTS.md`** / seed defaults.
3. Send a short **`POST /api/xchat/ask`** twice in a row: first warms Mongo + fills snapshot cache; second should show **`workspace_snapshot_load`** with **`source: "cache"`** if **`REDIS_URL`** is healthy (or in-process fallback on a single instance).
4. Confirm **`xchat_ask_pre_request`** still appears (proves you reached pre-provider wiring); provider RTT is **separate** from snapshot time.

### 8.4 End-to-end latency expectation (aspirational)

Under **warm** snapshot cache, correct **Redis TLS** (`rediss://` vs plain — see **`redis-cache-next.md`**), and tight book queries, operators have observed **server-side work before the xAI `/v1/responses` call** dropping on the order of **hundreds of ms → tens of ms** for the snapshot slice alone. A headline like **“~525 ms → &lt;80 ms total pre-provider”** is a **stretch goal** that also depends on RAG, persona resolution, usage limits, and network — treat it as a **validation target** in staging, not a guaranteed SLA. Model latency remains the dominant term once the server has handed off to xAI.
