# Backlog & migration notes

Living backlog for atx app, xChat, admin, and BFF. **Frontend marketing details** that are still open live under **§ Stripe & billing**; shipped UI chrome is noted only by reference.

**Docs index:** [README.md](./README.md) · Phase 1 multi-agent: [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · **NL / strategy preflight:** [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · **OptionsStrategyEngine (245):** [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md)

**Release note (bookkeeping):** `2.5.0` — app `package.json` / lockfile version; reviewer pre-production gate adds explicit version alignment check. Prior: `4.2.0` — branding/UI polish (icon-edit controls, native `<select>`, xChat header tagline). Production: GitHub **Deploy Cloud Run** → `production` with required approvals.

---

## Priorities (pick from here)

_Completed slices are rolled off this section; only active backlog stays listed._

| Priority | Item                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 230n     | **ApexCharts migration (desktop-first user surfaces)** | Next priority. Replace Chart.js usage in user product surfaces with ApexCharts (MIT), starting with `xStrategyBuilder` payoff chart (`OptionsPayoffChart`). Follow-on: portfolio analytics charts and shared chart wrapper defaults for desktop-first UX (xChat remains mobile-first). |
| 240n     | **Price alerts (follow-on)**       | User thresholds / dedupe on top of shipped `PriceAlertService` v1 (`src/modules/watchlist/price-alert-service.ts`).                                                                                                                                                                                                                                                                                    |
| 245n     | **OptionsStrategyEngine (core)**   | Kotlin `@Component` scoring pipeline for **`daily_options_scanner`**: context → chains → filter → fit score → legs → risk/reward → rationale → ranked recommendations. **Spec + diagram:** [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · [StrategyEngine.svg](./design-system/xStrategyBuilder/StrategyEngine.svg). **Team plan:** `.cursor/agents/reviewer.md` § OptionsStrategyEngine. Ship before **250** (notifications follow-on). |
| 250n     | **Notifications (follow-on)**      | Email / SMS / push / in-app feed / retries beyond shipped Slack v1 (`src/modules/notifications/portfolio-notification-service.ts`).                                                                                                                                                                                                                                                              |
| 270n     | **Options scanner (follow-on)**    | Chain scan, prefs filters, ranked output per `atx-docs/design-system/scheduled-task/options-scanner.md`.                                                                                                                                                                                                                                                                                               |
| 280      | **StrategyEngine (product umbrella)** | Same initiative as **245** (engine + scanner job). Product goals: score/rank classic strategies with real-time data + portfolio constraints; capital preservation, tax efficiency, income over speculation. Implementation detail lives in [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md).                                                                                                                                           |
| 301n     | **Core scanner audit (follow-on)** | Richer diff payloads, retention caps on `logCoreScannerRunAudit` (`src/modules/scanner/core-scanner-service.ts`).                                                                                                                                                                                                                                                                                      |
| 500      | **Automated Trades w/verify**      | Look-no-hands integrated real-time price alerts (aligns with notification + alert follow-ons).                                                                                                                                                                                                                                                                                                         |
| 600      | **Redis / platform (next)**        | Spring Memorystore, rate limits, PKCE store (`Chunk 1.3`), strategy-job caps in Kotlin. Next.js Redis v1: `atx-docs/sre-ops/redis-cache-next.md`.                                                                                                                                                                                                                                                       |
| 601      | **Admin portfolio audit**          | Log create/update/delete (optional CSV) via `admin_audit_events` / audit pipeline.                                                                                                                                                                                                                                                                                                                     |
| 700      | **NL + strategy job tool (xChat)** | Wire **nl** slots to `/api/strategy-jobs` (BFF) when product-ready; tool schema + persona copy. **Themes:** [§ NL and strategy preflight](#nl-and-strategy-preflight-backlog-themes) · [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md).                                                                                                                                                           |

### NL and strategy preflight (backlog themes)

**Deep spec** (examples, component sketches, copy patterns): [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

- **Assistant rendering:** Markdown in chat via ReactMarkdown + GFM + rehype; optional fenced-code highlighting; small pre-cleanup (e.g. double-bold, "Key: value" → headings, extra newlines); wrapper typography (e.g. card + prose) aligned with dark UI.
- **Tools & personas:** Avoid implicit "model picks tools"; keep explicit tool lists + hosted baseline merge so web/search stay available when policy requires (see deep spec for `mergeXchatHostedToolBaseline` intent).
- **Admin guardrails:** Warn or block saves for empty-tool personas with hosted search off; explain hallucination/API risk; optional "save anyway"; keep validation on persona forms.
- **Prompt assembly:** One session/tool instruction surface and one short user-prompt augmenter for the **ask** path; fixed stack order: persona → RAG → snapshot → instructions; **batch** stays a separate execution path (no forced unification).
- **NL preflight:** If required slots are missing, respond with **one** clarifying question (numbered choices when it helps); handle obvious NL intents where safe (e.g. watchlist add); persist answers per team/RAG policy; **only then** call Grok.
- **Strategy / xStrategyBuilder:** Guided multi-step choices → structured prompt → ship toward `/api/xchat/ask` and/or `/api/strategy-jobs` when wired; wizard UX and prompt templates stay in the deep spec.
- **Tool observability (optional):** Pattern in deep spec for recording tool success/failure and surfacing stats—map to this repo's storage (Mongo/audit) rather than copying external stack verbatim.

### Deferred product TODOs

- `/login` is deprecated (`permanentRedirect` → `/xchat`); fold plan tiers into `/xchat` guest panel or access-request flow.
- Watchlist quote freshness: add background refresh cadence + visible last-updated timestamp + stale badge (`/watchlist` and related portfolio/watchlist tables) so Yahoo-backed prices are clearly live vs cached.

---

## Phase 1 — xChat → xStrategyBuilder multi-agent

**Canonical:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md)

Order: **Backend orchestrator** → **LLM + artifact** → **SRE** → **Frontend** → **Reviewer**.

### Chunk 1 — Orchestrator

| Step | Deliverable                                      | Status                                       |
| ---- | ------------------------------------------------ | -------------------------------------------- |
| 1.3  | Redis hot keys / RL counters                     | **Open** (optional; caps work without Redis) |

Initial strategy-job Mongo + Spring + BFF + JVM tests are in-repo; see `services/atxfinance-backend` and `bff-proxy-routes.ts`.

### Chunk 2 — LLM tier + artifact v1


| Step    | Deliverable                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2.1–2.4 | Context bundle, async xAI path, artifact v1 validation + error codes, BFF route parity docs + `backend-http-api-parity` smoke |


**Exit:** Validated handoff payload + stable `jobId` / `correlationId`; documented failure codes.

### Chunk 3 — SRE / platform

Env matrix, observability (`correlationId`, `jobId`, `personaId`, `effectiveModel`, no raw PII), queue if p95 > SLO, per-tenant RL at orchestrator edge.

### Chunk 4 — Frontend

xStrategyBuilder: poll/push job status, render artifact, deep link `jobId`. Optional xChat entry to start/resume job without client-side orchestration state. Error UX ↔ backend codes. **NL preflight + strategy wizard themes:** [§ NL and strategy preflight](#nl-and-strategy-preflight-backlog-themes); examples in [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md).

### Chunk 5 — Reviewer / governance

OpenAPI parity, `atxdesign-review-audit` gaps, product doc parity (`xchat-tools-guide.md`, `context-routing-multi-agent-policy.md`).

**Open question:** [Phase: user_history_agent](#phase-xchat-chat_history-xai-collection-user_history_agent) vs TEAM-only `XAI_TEAM_ID` policy — reconcile before per-user collection writes.

---

## SRE status


| Area                 | Status             | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BFF frontend→backend | Verified           | Canonical list: `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` + `proxyRequestToBackend` on matching Next `route.ts` handlers. **Registry ↔ Next:** `tests/unit/bff-proxy-registry-next-handlers.test.ts`. **Kotlin ↔ docs:** `tests/smoke/backend-http-api-parity.test.ts`. **JVM:** `./gradlew test` in `services/atxfinance-backend` when backend changes. |
| Auth / OAuth         | Next authoritative | See [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md). `/api/auth/x/callback` may proxy to Spring when origin set; most auth routes stay Next-only.                                                                                                                                                                                             |
| Deploy               | GitHub Actions     | `AGENTS.md` + `.github/workflows/deploy-cloud-run.yml` (unified `workflow_dispatch` with `target` staging/production). `ATXFINANCE_BACKEND_ORIGIN` wired from GitHub vars on Cloud Run — see workflow.                                                                                                                                                                 |
| CI gate              | Pass               | `npm run ci:gate` — lint, typecheck, tests.                                                                                                                                                                                                                                                                                                                            |


### Deploy reliability TODOs (GH-first, CLI fallback)

- **GH-first build path:** Keep `gcloud builds submit --async` + explicit `gcloud builds describe` polling in both deploy workflows to avoid false failures from log-stream permission limits on default build buckets.
- **Terminal-state contract:** Workflow must fail only on terminal non-success statuses (`FAILURE`, `INTERNAL_ERROR`, `TIMEOUT`, `CANCELLED`, `EXPIRED`), and always print Cloud Build id + log URL for operator triage.
- **Version verification gate:** After deploy, verify both URLs return the same footer/app version: custom staging domain (`STAGING_BASE_URL`) and Cloud Run service URL (`status.url`). Treat mismatch as routing/cache drift.
- **Fallback runbook:** If GH deploy stalls or permission-drifts, use `scripts/ops/deploy-cloud-run-from-env.sh --staging` (or `--production` with approvals) as documented operator fallback.
- **Promotion discipline:** Prefer immutable image promotion (`image_ref` with digest) when rebuilding is unnecessary; use branch SHA tags only for build provenance.

### BFF completion status (rolling)

Major app-user and admin domains are proxied when `ATXFINANCE_BACKEND_ORIGIN` is set; registry ↔ Next wiring is enforced by `tests/unit/bff-proxy-registry-next-handlers.test.ts`. **Deferred:** xChat `/api/xchat/*` stays Next-authoritative.

### BFF routing gaps (SRE report)

**Source of truth:** `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` — every `{ method, path }` there should have a Next handler that calls `proxyRequestToBackend(request)` first (return if non-null), then local fallback. CI enforces file presence + minimum `await proxyRequestToBackend(` count per route file via `**tests/unit/bff-proxy-registry-next-handlers.test.ts`**. `**ATXFINANCE_BACKEND_ORIGIN` unset** ⇒ proxy is a no-op and Next always serves locally.

**Proxied when origin is set (registry + implementation aligned):** app-user portfolios (`/api/portfolios/...` including default, current, by id, accounts, watchlist), `/api/positions`, `/api/recommendations` (+ by id, portfolio-scoped), `/api/strategy-options` (+ expirations), `/api/strategy-jobs` (+ by id, turns), `/api/user-feedback`, `/api/personas` (+ by id), `POST /api/access-requests`, admin access-requests/users/tasks/scheduler/deploy-notes/import/broker/bootstrap-status/audit, **admin portfolio** routes including `…/watchlist`, `…/accounts/{accountId}/positions`, `…/recommendations`, `…/alerts`, `…/delivery-channels`, `…/tasks`, `/api/rag/files` (+ readiness). `**GET /api/auth/x/callback`** is listed in `bff-proxy-routes.ts` but Next only forwards when `**AUTH_CALLBACK_USE_SPRING=true**` in addition to `ATXFINANCE_BACKEND_ORIGIN` (see callback route); default remains Next OAuth completion.

**Intentionally Next-only (not in BFF registry — expected):**

- **xChat / streaming:** `/api/xchat/*` (ask, batch, history, collections, etc.) — deferred per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- **Persona governance extensions:** publish, archive, rollback, versions, sync-from-xai, collection create/link-files, verify-collection, `GET /api/personas/collections` — richer than core CRUD; remain Next until product moves them to Spring.
- **Admin portfolio position by id:** `PATCH/DELETE …/accounts/{accountId}/positions/{positionId}` — Next until listed in `bff-proxy-routes.ts` with Kotlin parity (collection GET/POST is proxied).
- **Auth surface (mostly):** `/api/auth/x/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/link-email`, Google OAuth login — Next; optional `auth/google/callback` proxy exists for dual-run but path is not in `BFF_PROXY_ROUTES`.
- **Ops / docs:** `/api/health`, `/api/openapi`, `/admin/api-docs` — Next.
- **Other admin:** `/api/admin/brokers`, `/api/admin/xchat/settings` — Next.

**Operator checklist:** Staging/prod with Spring enabled must set `**ATXFINANCE_BACKEND_ORIGIN`** to the Cloud Run (or internal) base URL for the Kotlin service so BFF routes hit Spring; unset ⇒ full Next fallback (split-brain risk for data mutated on both tiers — prefer single writer per domain).

---

## TEAM-only xAI: remove legacy collection paths

**Goal:** Remove `userBootstrapCollectionId` and per-user bootstrap xAI flows where policy says TEAM-only. **Anchor:** `XAI_TEAM_ID` for team KB append/retrieval.

**Acceptance (remaining):** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Phase: xChat chat_history → XAI collection (`user_history_agent`)

**Goal:** Scheduled `user_history_agent` syncs `xchat_logs` → user xAI collection for retrieval.

**Remaining:** Align implementation with TEAM-only policy; task runner + admin category; tests with mocked xAI append. See table in prior plans for touch files.

**Audit gaps:** Full inference lineage on `xchat_logs`, tamper-evident chain, optional `admin_audit_events` per task run — see [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md).

---

## Stripe & billing (from frontend plan)

**Shipped (slice 1):** Account → **Billing** (`/account/billing`), ATX plans (Basic $9/mo with limits; Premium $29/mo complex portfolios + per-hour caps on xChat/xStrategyBuilder; Premium+ $99/mo dedicated instance / no training use; limited-time full-access trial), `POST /api/billing/checkout-session` (Stripe Checkout subscription). Env + ops: `atx-docs/sre-ops/stripe-billing-setup.md`. List pricing matrix: `atx-docs/resouces/atx-limits.txt.tsv`.

**Remaining:** Customer portal deep link, `POST /api/webhooks/stripe`, Mongo subscription / plan fields, `getPlanLimits()` gating from paid tier.

---

## Deferred

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).

## Worktree hygiene

- **2026-03-26:** Audited registered git worktrees (`git worktree list`) plus `~/.cursor/worktrees/atxfinance__Workspace_/{acu,apa,cho,eba,fmz,tfe,vjw,wgd,xcy}` — all **clean** (`git status` empty). Stale dirs (**dzn**, **egh**, **fvr**, **sdi**, **vjl**, etc.) may still contain a `.git` file pointing at removed worktree metadata; from the main repo run `git worktree prune` after deleting those folders if `git status` errors there.

