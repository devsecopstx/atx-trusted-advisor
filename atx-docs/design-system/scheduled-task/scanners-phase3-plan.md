# Scheduled scanners — Phase 3 plan (foundation + roll vertical)

**Intent:** One shared platform for option-chain workloads (cache + circuit breaker), a **single user-visible output shape** (no greek dumps in the primary row), and **one vertical in active scope**: **`options_expiration_roll_manager`**. Other scanner stubs stay in `/atx-docs/design-system/scheduled-task/` but are **out of Phase 3 delivery** until reprioritized.

**Code anchors:** `src/modules/scanner/` (cache, circuit, env), `fetchYahooOptionChainForScanner`, `task-runner.ts`, `src/lib/scheduled-task-category-schema.ts`, Kotlin `ALLOWED_CATEGORIES` in `AdminScheduledTasksService.kt`. Admin contract: [schedule-tasks-admin.md](./schedule-tasks-admin.md). Options scanner backlog: [options-scanner.md](./options-scanner.md). Roll job stub header: [options-expiration-roll-manager.md](./options-expiration-roll-manager.md).

**Note:** Mongo **`scanner_option_chain_cache`** + **`scanner_circuit_state`** and wiring into the options scanner landed in app **≥2.9.0**. This doc is the **target contract** for output/scoring and the **trimmed phase plan**; close any gaps (freshness, breaker visibility, Yahoo storm avoidance) against **3a**, then align **3c** behavior and UI-facing rows with the sections below.

---

## 1. Scanner output format — one position, one glance

Primary row (what the user sees first). **No 12-line greeks dump** in the main surface; deep greeks live in **expandable “details”** or **admin / task logs**.

| Column | Content |
|--------|---------|
| **Action** | e.g. Sell, Buy, Roll, Hold (product vocabulary TBD per job) |
| **Contract** | Human-readable leg, e.g. `AAPL 225C May 16` |
| **DTE** | Days to expiration (integer) |
| **Portfolio score** | `0–100` (weighted model below) |
| **Rationale** | **Max 3 bullets** — short sentences only |

**Example (covered call on existing holding):**

- **Sell** | **AAPL 225C May 16 (DTE 38)** | **Score 87**
  - DTE 38 lands in prime theta-decay window (21–45 days) → targets 1.8–2.5% monthly credit on capital at risk.
  - Portfolio fit high: reduces concentration in tech, delta 0.28 keeps assignment risk under 30%, IV rank 62% favors sellers.
  - Tax note: premium treated as short-term gain; pairs well with qualified dividends (consult your CPA).

**Principle:** User sees **what to do**, **why DTE matters**, and **how it scores against their book** (concentration, net delta, cash-flow goal, liquidity minimums). Everything else is secondary.

---

## 2. Scoring factors — transparent, weighted (HNWI-tuned defaults)

| Factor | Weight | Meaning |
|--------|--------|---------|
| **Income / theta efficiency** | **35%** | DTE sweet spot **21–45** (theta-decay window aligned with monthly credit targets) |
| **Risk-adjusted edge** | **30%** | Delta, IV rank, POP / ROI-style edge (job-specific sub-metrics) |
| **Portfolio synergy** | **25%** | Concentration relief, book-level greeks, cash-flow alignment |
| **Liquidity & assignment realism** | **10%** | OI/volume / assignability — conservative defaults |

**Default guardrails (conservative HNWI — overridable per account):**

- Covered / short premium: **delta ≤ 0.30** (where applicable)
- **Credit ≥ ~1.5% monthly** (policy text; implement as configured thresholds)
- **Liquidity floor** — e.g. **over $500k notional** equivalent where the chain supports it (tune per product)

User/account overrides apply on top of tenant defaults; document overrides in admin or prefs — **no new job-template collection** in Phase 3.

---

## 3. Admin & configuration (unchanged mechanics)

| Mechanism | Location / notes |
|-----------|------------------|
| **Task rows** | Mongo `admin_scheduled_tasks` — tenant-scoped; **`/admin/tasks`** only. |
| **Execution** | `executeScheduledTask` → `runScheduledCategory` → handler (`task-runner.ts`). |
| **Category allowlist** | Zod **`SCHEDULED_TASK_CATEGORIES`** + Kotlin **`ALLOWED_CATEGORIES`** — **must stay in sync**. |
| **Default crons** | **`SCHEDULED_TASK_CATEGORY_DEFAULT_CRON`** in `scheduled-task-category-schema.ts` + **this doc** — no extra UI for “templates.” |
| **Explicitly out of scope** | Separate **job-template** collection — **not** in Phase 3. |

---

## 4. Phase 3a — platform (non-negotiable foundation)

**Do this first and keep it tight.** Everything downstream assumes it.

1. **Mongo-backed ~15m option chain cache** with **tenant-safe keys** (shared across instances — same idea as `scanner_option_chain_cache` + TTL env e.g. `OPTIONS_CHAIN_CACHE_TTL_SEC`).
2. **Circuit breaker** — **per tenant + global** policy, **~15m cooldown**, state visible in **`admin_task_runs.output`** (and structured logs) when open / half-open.
3. **Wire the existing options scanner** to **cache + breaker immediately** — no duplicate Yahoo fan-out when tasks align; **15m freshness** as the single TTL story.

**Goal:** Zero duplicate Yahoo storms, reliable freshness, predictable failure mode when upstream is bad.

---

## 5. Phase 3b — category plumbing (minimal)

1. Add **new category strings** to **Zod** schema + **Kotlin** allowlist (parity).
2. **Stub handlers** in `task-runner.ts`: return **`success` + short delay / no-op summary** until real logic ships (no fake chain data).
3. **Document default cron presets** only (schema + this doc / `schedule-tasks-admin.md` as needed) — **no new admin UI surface** for templates.

**That’s all for 3b.** No job-template collection.

---

## 6. Phase 3c — single vertical (priority order)

**Only active product vertical for Phase 3c:**

### `options_expiration_roll_manager` (highest immediate value)

- **Inputs:** Shared **chain cache** (3a); tenant positions (options legs).
- **Flags:** Every position **≤ 7 DTE** or **> 45 DTE** (stale / roll window vs too far — tune constants in code + env).
- **Ranking:** **3–5 roll candidates** per flagged leg using the **same DTE + portfolio scoring model** as §1–2 (not a separate black box).
- **Output shape:** Matches **§1** — e.g.  
  `Roll AAPL 225C to Jun 20 (DTE 73) — Score 91 — better credit + tax deferral.`  
  (Implement as structured fields + display string; rationale ≤ 3 bullets.)

**Cut for now:** Corporate events, income projector, rebalance enhancements, risk/concentration, tax-loss harvest — **not** part of Phase 3c. Revisit when roll + output contract are stable.

---

## 7. Success criteria (exit for this revision)

- [ ] **3a:** Options scanner path uses **cache + breaker**; task output shows **circuit** / **suppressed calls** when relevant; **no thundering herd** on Yahoo for the same underlying|expiry within TTL.
- [ ] **§1–2:** At least **one** user-facing or admin summary path emits the **one-glance row** + **≤3 bullet** rationale + **0–100** score from the **weighted factors** (roll manager and/or options scanner — specify in PR).
- [ ] **3b:** Any **new** category id is in **Zod + Kotlin** and has a **stub** until implemented.
- [ ] **3c:** **`options_expiration_roll_manager`** implements **≤ 7 DTE** and **> 45 DTE** flags, **3–5** ranked roll candidates, output aligned with §1–2.

---

## 8. References

- `src/modules/core-admin/task-runner.ts`
- `src/lib/scheduled-task-category-schema.ts`
- `src/modules/scanner/scanner-platform-env.ts`, `scanner-collection-names.ts`
- Backend: `services/atxfinance-backend/.../AdminScheduledTasksService.kt` (`ALLOWED_CATEGORIES`)
