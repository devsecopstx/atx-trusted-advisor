# Backlog & migration notes

Living backlog for atx app, xChat, admin, and BFF. **Frontend marketing details** that are still open live under **§ Stripe & billing**; shipped UI chrome is noted only by reference.

**Docs index:** [README.md](./README.md) · Phase 1 multi-agent: [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · **NL / strategy preflight:** [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · **OptionsStrategyEngine (245):** [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md)

**Release note (bookkeeping):** `2.10.7` — **Idempotent provision must not reset names:** `provisionDefaultPortfolioForUser` / JVM `DefaultPortfolioProvisionService.provision` no longer overwrite portfolio, account, or watchlist **display names** (or default-account **cash**) on existing rows — fixes names reverting to “Default Portfolio” / “defaultaccount” on every Google/X login because OAuth calls provision each session. Prior: `2.10.6` — **Access approval portfolio tenant:** provisioning on approve uses the **applicant’s** default tenant (or `atxfinance-core`), not the admin’s session tenant — fixes “renamed portfolio/account resets after Google re-login” when book rows were invisible to the user session. JVM: `DefaultPortfolioProvisionService.provisionForAccessRequestApprovedUser`. Prior: `2.10.5` — **Guest registration + OAuth hotfix:** X/Google callbacks **always** relink provider identity to the `core_users` row for the **verified/normalized email** (even while access is still pending), so admin approval applies to the same document the user signs into. Spring `OAuthIdentityService` aligned. Docs: `atx-docs/guides/auth-and-access.md`. Prior: `2.10.4` — Next **OAuth identity unification (`485n`)**: `core_users.googleAccount` (sparse unique `googleAccount.sub`); Google callback resolves **verified email first**, then Google sub; migrates legacy `xAccount.xUserId` of form `google:*` into `googleAccount`; **`/api/auth/link-email`** merges X placeholder user into an existing email account (e.g. Google-first) via `mergePlaceholderXUserIntoEmailUser` + scaffolding purge — one portfolio path for the same person. Prior: `2.10.3` — Spring **Memorystore-ready Redis** — **`600n`** ([spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md)); `2.10.2` — **`601n`** admin portfolio audit. Production: GitHub **Deploy Cloud Run** → `production` with required approvals.

---

## Priorities (pick from here)

_Completed slices are rolled off this section; only active backlog stays listed._

### Shipped (reference)

| Priority | Item | Notes |
| -------- | ---- | ----- |
| **230n** | **ApexCharts (desktop-first charts)** | `OptionsPayoffChart`, xOptions panels use ApexCharts; unused Chart.js deps removed. See [design-system/charts-apex.md](./design-system/charts-apex.md). |
| **240n** | **Price alerts follow-on** | Per-row `priceAlertMinAbsMovePercent` on watchlist symbols; cooldown dedupe via `portfolio_alerts` (`adminHasRecentPriceAlertForSymbol`); optional env `PRICE_ALERT_COOLDOWN_MS` (default 4h). `PATCH …/watchlist` `addEntries` accepts the field. |
| **245n** | **OptionsStrategyEngine (core)** | Kotlin `OptionsStrategyEngine` (`services/atxfinance-backend/.../strategy/OptionsStrategyEngine.kt`): weighted fit score, ranked recommendations, `scheduledTaskDryRunOutput` wired to JVM `daily_options_scanner` tick. Spec: [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md). Next.js scanner job unchanged for full chain + portfolio IO. |
| **250n** | **Notifications (follow-on)** | `dispatchPortfolioDeskEvents` — Slack webhooks with retries (`DESK_NOTIFICATION_SLACK_RETRIES`, `DESK_NOTIFICATION_RETRY_BASE_MS`); email/SMS/push channels counted as deferred (`skipped`) until providers ship. See `src/modules/notifications/portfolio-notification-service.ts`. |
| **270n** | **Options scanner (follow-on)** | Merged **`options_strategy.filters`** (`mergeOptionsStrategyFilters` / `options-scanner-prefs-filter.ts`), prefs-filtered scan targets, **`chain_batches`** + **`rankedSignals`** / `rank_top` in task output (`options-scanner-engine.ts`, `options-strategy-scanner-job.ts`). See [options-scanner.md](./design-system/scheduled-task/options-scanner.md). |
| **280** | **StrategyEngine (product umbrella)** | Umbrella section in [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) — ties Kotlin engine, Next scanner, xOptions/xStrategyBuilder goals (capital preservation, tax efficiency, income vs speculation). |
| **301n** | **Core scanner audit (follow-on)** | `logCoreScannerRunAudit`: **`summaryForDiff`**, **`outputFingerprint`** / **`auditDetailsFingerprint`**, truncated **`output`** + merged JSON size guard (`auditDetailsOversize` + `auditDetailKeys`), capped alert CSV rows. Env: `CORE_SCANNER_AUDIT_*` in `.env.example`. |
| **601n** | **Admin portfolio audit**          | Spring `AuditEventService` on global-admin portfolio routes: shell, accounts, watchlist (optional **`symbolsAddedCsv` / `symbolsRemovedCsv` / `addEntriesSymbolsCsv`**), recommendations, alerts, delivery-channels (destination length only), positions. Filter in admin audit UI: `entityType=admin_portfolio`. See [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md). |
| **600n** | **Spring Redis (Memorystore path)**  | Optional **`REDIS_URL`**: Lettuce + PKCE (`OAuthPkceRedisStore`), **`GET /api/auth/x/login`**, **`AuthPathRateLimitFilter`**, **`StrategyJobRedisQuota`**, health probes. Doc: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md). Chunk **1.3** partial (orchestrator hot keys / global RL beyond OAuth still open). |
| **485n** | **OAuth identity (X ↔ Google)** | **Shipped in app `2.10.4`.** `googleAccount` on `core_users`; Google callback email-first + `getCoreUserByGoogleSub`; link-email merges placeholder X user into existing email account; `resolveAuthContext` unions X + Google display. **Remaining (optional):** explicit “link Google while signed in with X” UI; admin merge tool for legacy duplicate rows. See [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md). |

### Active backlog

| Priority | Item                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **486n** | **Auth: email + password (register / login / reset)** | **Registration and access without X or Google:** sign up with **email only**, set password (on registration or first successful verification — product choice), **login** with email+password, **forgot password** flow (token + expiry, secure reset page). Enables local/dev recovery when OAuth-only users are deleted from Mongo and matches users who do not use X/Google. **UI:** flows can live on `/xchat` guest panel and/or revived `/login`/`/register` routes (today `/login` redirects to `/xchat` per [Deferred product TODOs](#deferred-product-todos) — align routing when this ships). **Backend:** password hash storage on `core_users` (or dedicated credentials collection), rate limits, audit/login events consistent with existing `appendLoginAuditRecord`. **Env:** SMTP or transactional email provider for reset links (document in `.env.example` + SRE doc). |
| 500      | **Automated Trades w/verify**      | **Gate:** ship only once **E\*TRADE** and **IBKR** are onboarded as execution/custodian integrations (brokers + sync path) — look-no-hands real-time alerts + verify loop; aligns with notifications. Until then, manual execution / alerts-only flows stay in scope.                                                                                                                                   |
| 600      | **Redis / platform (follow-on)**   | **Shipped slices:** Next quote cache — [redis-cache-next.md](./sre-ops/redis-cache-next.md); Spring PKCE + OAuth RL + strategy quota — [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md). **Remaining:** VPC Memorystore cutover per env, broader API RL at BFF edge, orchestrator hot keys / non-OAuth RL (Chunk **1.3**).                                                                                                                                 |
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

### Email & delivery channel setup (ops)

- **In-app:** Global admin **portfolio delivery channels** (`email`, `slack_webhook`, `sms`, `push`) — ties to desk/notification work (see shipped **`250n`**).
- **ZenBusiness hosted business email:** For MX mailboxes, Zen recommends **IMAP** on phones/tablets for server-side sync. **Incoming and outgoing mail server:** host **`mail.b.hostedemail.com`**; **username** = full email address; **password** = mailbox password (required for SMTP, not optional in their UI). Client setup index: [How Do I Set Up My Email on My Phone, Computer, Tablet, or Other Device?](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F)

---

## Phase 1 — xChat → xStrategyBuilder multi-agent

**Canonical:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md)

Order: **Backend orchestrator** → **LLM + artifact** → **SRE** → **Frontend** → **Reviewer**.

### Chunk 1 — Orchestrator

| Step | Deliverable                                      | Status                                       |
| ---- | ------------------------------------------------ | -------------------------------------------- |
| 1.3  | Redis hot keys / RL counters                     | **Partial** — Spring: OAuth + strategy-job quota when `REDIS_URL` set ([spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md)); global API RL / hot keys still open. |

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

**Proxied when origin is set (registry + implementation aligned):** app-user portfolios (`/api/portfolios/...` including default, current, by id, accounts, watchlist), `/api/positions`, `/api/recommendations` (+ by id, portfolio-scoped), `/api/strategy-options` (+ expirations), `/api/strategy-jobs` (+ by id, turns), `/api/user-feedback`, `/api/personas` (+ by id), `POST /api/access-requests`, admin access-requests/users/tasks/scheduler/deploy-notes/import/broker/bootstrap-status/audit, **admin portfolio** routes including `…/watchlist`, `…/accounts/{accountId}/positions`, `…/recommendations`, `…/alerts`, `…/delivery-channels`, `/api/rag/files` (+ readiness). `**GET /api/auth/x/callback`** is listed in `bff-proxy-routes.ts` but Next only forwards when `**AUTH_CALLBACK_USE_SPRING=true**` in addition to `ATXFINANCE_BACKEND_ORIGIN` (see callback route); default remains Next OAuth completion.

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

**Shipped (slice 1):** Account → **Billing** (`/account/billing`), ATX plans (Basic $9/mo with limits; Premium $99/mo complex portfolios + per-hour caps on xChat/xStrategyBuilder; Premium+ $299/mo dedicated instance / no training use; limited-time full-access trial), `POST /api/billing/checkout-session` (Stripe Checkout subscription). Billing cards show **tenant-resolved** workspace caps per tier (`src/lib/billing-plan-workspace-display.ts`) for signed-in users; guests see catalog caps. Env + ops: `atx-docs/sre-ops/stripe-billing-setup.md`. List pricing matrix: `atx-docs/resouces/atx-limits.txt.tsv`.

**Remaining:** Customer portal deep link, `POST /api/webhooks/stripe`, Mongo subscription / plan fields, `getPlanLimits()` gating from paid tier.

---

## Deferred

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).

## Worktree hygiene

- **2026-03-26:** Audited registered git worktrees (`git worktree list`) plus `~/.cursor/worktrees/atxfinance__Workspace_/{acu,apa,cho,eba,fmz,tfe,vjw,wgd,xcy}` — all **clean** (`git status` empty). Stale dirs (**dzn**, **egh**, **fvr**, **sdi**, **vjl**, etc.) may still contain a `.git` file pointing at removed worktree metadata; from the main repo run `git worktree prune` after deleting those folders if `git status` errors there.

