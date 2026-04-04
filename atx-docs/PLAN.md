# Roadmap (outstanding)

Living backlog for atx app, xChat, admin, and BFF. Shipped slices are recorded in release tags, [release-notes.md](./sre-ops/release-notes.md), and topic docs. **Scheduled scanners Phase 3** (tenant categories + shared option-chain cache / circuit breaker + `**rebalance`** handler, app **≥2.9.0**) is **complete** for product job implementation — see [scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md); there are **no Phase 3 scanner job rows** on this roadmap (optional SRE follow-up: cache-hit observability under aligned crons, same plan § success criteria). This file lists **only open work**.

**Docs index:** [README.md](./README.md) · **xChat Hardcore** (Phase 1 multi-agent): [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · Deploy / secrets / desk SMTP: [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) · NL / strategy preflight: [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · OptionsStrategyEngine: [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · Charts: [design-system/charts-apex.md](./design-system/charts-apex.md) · Redis: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md) · Auth: [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) · Audit: [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) · **Phase 3 scanners (shipped):** [design-system/scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md)

---

## Product backlog


| Priority | Item                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **100**  | **Phase 1 — xChat → xStrategyBuilder multi-agent (done)**    | **Completed:** Spring strategy-jobs surface + BFF proxy + xChat strategy intent preflight + create/handoff + xStrategyBuilder thin handoff card. Follow-on enhancements move to **[200](#product-backlog)**. Canonical: [atx-multi-agent.md](./xchat/atx-multi-agent.md) · routing: [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md). |
| **200**  | **xChat native continuation → strategy-jobs turns**          | Follow-on after create + handoff: keep users in xChat while sending structured replies to `POST /api/strategy-jobs/{jobId}/turns`, then route to artifact/review in xStrategyBuilder. Scope includes turn-state UX, status polling, compliance-heavy copy/disclaimers, advisor/operator gate alignment, and no raw prompt/PII expansion in payloads. Rolls up under **[100](#product-backlog)** / [xChat Hardcore](#xchat-hardcore). |
| **486n** | **Auth: email + password**                                   | Register / login / reset without X or Google; hash + rate limits + audit; SMTP/transactional email for reset. UI on guest panel and/or `/login`/`/register` (today `/login` → `/xchat` — align when this ships).                                                                                                                                                                                                                               |
| **600**  | **Redis / platform**                                         | VPC Memorystore cutover per env; broader API RL at BFF edge; orchestrator hot keys / non-OAuth RL (chunk **1.3**). **In progress (app 2.10.18):** Redis-backed (memory fallback) BFF rate-limit guards added with a central per-route policy map (`strict`/`standard`/`light`) for strategy-jobs (`POST /api/strategy-jobs`, `GET /api/strategy-jobs`, `GET /api/strategy-jobs/{jobId}`, `GET /api/strategy-jobs/{jobId}/artifact`, `POST /api/strategy-jobs/{jobId}/turns`), guest `POST /api/access-requests/public`, recommendations (`GET/POST /api/recommendations`, `GET /api/recommendations/{recommendationId}`), positions (`GET/POST /api/positions`, `DELETE /api/positions/{positionId}`), and admin audit reads (`GET /api/admin/audit`, `GET /api/admin/login-audit`) — client-IP keyed where applicable. |
| **900**  | **Automated trades w/ verify**                               | Ship only after **ETRADE** and **IBKR** execution/custodian path; until then alerts / manual execution only.                                                                                                                                                                                                                                                                                                                                   |
| **701**  | **xChat — user file attachments**                            | Allow app_user to **attach** a file from the composer; **persist in Mongo** (metadata + storage ref / GridFS or object store per existing patterns), cap size/types; thread attachment to `xchat_logs` (or successor). **Later:** treat as **attachments** under the per-user **xChat history** handoff — align with [Phase: `user_history_agent](#phase-xchat-chat_history-xai-collection-user_history_agent)` (sync path + retrieval scope). |
| **702**  | **xChat — paste screenshots (clipboard)**                    | Support **paste from desktop** (clipboard `image/*`) into the chat composer; same persistence + safety pipeline as **701** (virus scan policy TBD, max dimensions/bytes, strip EXIF if required).                                                                                                                                                                                                                                              |
| **703**  | **xChat — voice input (short prompts)**                      | **Voice capture** for brief utterances (e.g. *“add NVDA to my watchlist”*): browser **Web Speech API** and/or STT provider; **intent routing** into existing NL / tool paths (`watchlist` mutations, etc.) with explicit **confirm-before-mutate** for destructive or multi-symbol actions.                                                                                                                                                    |


### 485n — Link Google while signed in with X (optional slice — shipped)

**Shipped:** Google callback **without PKCE cookies** but with an existing session redirects safely (`consumeOAuthReturnPathCookie` + `isSafeOAuthReturnPath`, fallback `/xchat` or `/admin`). **Email match guard** for signed-in users with a real (non-placeholder) profile email: wrong Google account → `?error=google_link_email_mismatch` (no `linkGoogleAccountToUser`). **Link Google** in the xChat workspace account rail when Google OAuth is configured (`/api/auth/google/login?next=/xchat`). **Tests:** `tests/integration/google-oauth-email-canonical.test.ts`.

**Still open (not this slice):** **admin merge** for legacy duplicate `core_users` rows (support playbook or Hub tool).

### 710 — App-user broker activity import (shipped)

**Shipped (app ≥2.10.14):** Signed-in app users import Merrill/Fidelity **holdings** CSV without the admin Hub. **Not on the open backlog table** above — this section is the canonical shipped summary.

**Tests (app ≥2.10.15):** Vitest `**tests/integration/app-import-broker-route.test.ts`** — dry-run + auth + portfolio ownership; **apply** path (job + `executeScheduledTask`) still covered by `**tests/unit/app-broker-import-job.test.ts`** and manual smoke — optional future integration for full apply if regressions appear.

- **Entry:** `**/portfolios`** → **Import activities** → `**/import-activity`**.
- **UI:** Portfolio picker, account **ext ref** table, broker select, file + textarea CSV, **Preview (dry run)** then **Run import now** (import disabled until preview succeeds).
- **API:** `**POST /api/import/broker`** (`[api-endpoints.md](./guides/api-endpoints.md)`) — same payload shape as admin where applicable (`dryRun`, `mappings`, `fidelityHoldingsDefaultAccountRef`); `**requireApprovedAppUserSession`**; portfolio must belong to session user.
- **Execution:** Staging doc in Mongo `**app_broker_import_jobs`** (CSV capped **1 MiB** chars), ephemeral `**admin_scheduled_tasks`** row `**category: sync-broker`** + `**appBrokerImportJobId**`, `**nextRunAt` now**; `**executeScheduledTask`** runs `**runScheduledAppBrokerImportTask`** in Next (`task-runner.ts`); task row deleted after run (`**admin_task_runs**` retained). Kotlin **stub** `sync-broker` unchanged for tasks without `appBrokerImportJobId`.
- **Admin path unchanged:** `**POST /api/admin/import/broker`**, `**/admin/broker-import`**.

### NL and strategy preflight

**Deep spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

### 700 — NL + strategy job tool (xChat) (shipped)

**Shipped:** xChat now detects strategy intent, returns a compliance-heavy preflight prompt, confirms handoff (`"launch strategy job"` / `"yes"`), creates a strategy job through `POST /api/strategy-jobs` (BFF), and routes to `/xstrategybuilder` with the active `jobId`. xStrategyBuilder provides a thin handoff card (active jobs + status + view artifact). Backend create gate enforces **advisor/operator** only.

**Tests:** `tests/integration/xchat-ask-route.test.ts` (strategy preflight path) and `tests/integration/strategy-jobs-route.test.ts` (advisor/operator gate + proxy behavior).

- Assistant rendering: Markdown/GFM, code fences, small pre-cleanup, prose aligned with dark UI.
- Tools & personas: explicit tool lists + hosted baseline merge (see spec for `mergeXchatHostedToolBaseline`).
- Admin guardrails: empty-tool personas + hosted search off — warn/block with override.
- Prompt assembly: single instruction surface + short user augmenter for **ask**; order: persona → RAG → snapshot → instructions; **batch** stays separate.
- NL preflight: one clarifying question when slots missing; persist per policy; then call Grok.
- Strategy / xStrategyBuilder: guided choices → structured prompt → `/api/xchat/ask` and/or `/api/strategy-jobs` when wired.
- Tool observability (optional): record success/failure → Mongo/audit per repo patterns.

### Deferred product TODOs

- `/login` deprecated (redirect → `/xchat`); fold plan tiers into guest panel or access-request flow.
- Watchlist quote freshness: background refresh cadence + last-updated + stale badge on `/watchlist` and related tables.

### Desk email & delivery (ops / PR review)

- **Reviewer / infra:** Desk SMTP + BFF split (Next vs JVM when `ATXFINANCE_BACKEND_ORIGIN` is set) — [deploy-and-ops.md](./guides/deploy-and-ops.md) (`gcp-runtime-secrets.inc.sh`, `verify-gcp-runtime-secrets.sh`, sync `ops:secrets:sync-desk-smtp:*`). **Current behavior** (portfolio `email`, platform `/admin/delivery-channels` `**email`**, task summaries): [design-system/current-state-features.md](./design-system/current-state-features.md).
- **Outstanding:** Portfolio `**sms`** / `**push`** channel kinds (still skipped). **486n** auth password-reset mail is separate product work.
- ZenBusiness hosted mailbox: SMTP host `**mail.b.hostedemail.com`**; [client setup](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F).

---

## xChat Hardcore

**Phase 1 — xChat → xStrategyBuilder multi-agent (completed baseline).** Product backlog priority **[100](#product-backlog)**.

**Canonical:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md)

**Phase 1 baseline is complete** for the current product scope (preflight + create/handoff + xStrategyBuilder thin handoff). Next evolution is tracked under **[200](#product-backlog)** (native xChat continuation into strategy-job turns).

**Shipped today (backend + contract surface):** Spring `**StrategyJobService`** — `POST` / `GET /api/strategy-jobs`, `POST …/turns` through `**slots_complete`**; stable `**jobId**` + `**correlationId**`; hourly job cap with **Redis** when `**REDIS_URL`** is set (else Mongo count); Next **BFF** proxy routes + `**tests/smoke/backend-http-api-parity.test.ts`** needles + `**atxfinance-backend-http-api.md`** strategy-jobs section + `**CURRENT_STATE_ROUTES**` entries.

**Next / outstanding (tracked here or below):** **[200](#product-backlog)** native xChat continuation into strategy-job turns. Platform/SRE follow-ups remain: **[600](#product-backlog)** VPC Memorystore + broader orchestrator/API rate limits, observability hardening (correlation/job/persona/model), audit/doc parity, and strict JSON Schema artifact v2 under [Deferred (larger lifts)](#deferred-larger-lifts).

**Open question:** [Phase: user_history_agent](#phase-xchat-chat_history-xai-collection-user_history_agent) vs TEAM-only `XAI_TEAM_ID` — reconcile before per-user collection writes.

---

## TEAM-only xAI (legacy path removal)

**Goal:** Drop `userBootstrapCollectionId` and per-user bootstrap where policy is TEAM-only; anchor on `XAI_TEAM_ID` for team KB.

**Remaining:** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Phase: xChat chat_history → XAI collection (`user_history_agent`)

**Goal:** Scheduled sync `xchat_logs` → user xAI collection for retrieval.

**Remaining:** Align with TEAM-only policy; task runner + admin category; tests with mocked xAI append.

**Product tie-in (backlog):** User-uploaded files and pasted images (**[701](#product-backlog)** / **[702](#product-backlog)**) should land in a consistent **attachment** model so the same job can index or copy blobs into the user’s **history** folder/collection alongside text turns (schema + retention policy to be specified with this phase).

**Audit:** Inference lineage on `xchat_logs`, tamper-evident chain, optional `admin_audit_events` per run — [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md).

---

## Stripe & billing

**Remaining:** Customer portal deep link, `POST /api/webhooks/stripe`, Mongo subscription / plan fields, `getPlanLimits()` gating from paid tier. Setup: [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) · limits matrix: [atx-limits.txt.tsv](./resouces/atx-limits.txt.tsv).

---

## SRE / platform gaps

**Baseline:** BFF registry `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` + `tests/unit/bff-proxy-registry-next-handlers.test.ts`; JVM `./gradlew test` in `services/atxfinance-backend`; deploy: `.github/workflows/deploy-cloud-run.yml`, `AGENTS.md`.

### Deploy reliability (GH-first)

- Async `gcloud builds submit` + `gcloud builds describe` polling (avoid log-stream permission false failures).
- Fail only on terminal non-success; always print Build id + log URL.
- Post-deploy: staging custom domain + Cloud Run `status.url` must match app version (catch routing/cache drift).
- Fallback: `scripts/ops/deploy-cloud-run-from-env.sh`; prefer immutable image promotion when skipping rebuild.

### Test / doc follow-ups (conscious)

- `**POST /api/import/broker/clean`:** Documented in `**api-endpoints.md`** and [app-user import](./design-system/portfolio/app-user-import-activity.md); no dedicated route integration test yet (destructive — mock `**deleteAllPositionsForPortfolio`** + job/task deletes if added).

### BFF / consolidation (intentionally Next-only for now)

- xChat `/api/xchat/*` — deferred per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- Persona governance extensions (publish, archive, rollback, versions, xAI collection helpers) — Next until moved to Spring.
- Admin `PATCH/DELETE …/positions/{positionId}` — Next until registry + Kotlin parity.
- Most auth routes Next; optional Google callback proxy for dual-run.

**Ops:** With Spring enabled, set `**ATXFINANCE_BACKEND_ORIGIN`** to the backend **HTTPS** origin (no `:8080` on public hostnames; see `.cursor/agents/sre.md` / deploy workflows). Unset ⇒ Next-only (avoid split-brain writes). **Reviewer:** infra PRs that touch desk SMTP or BFF — cross-check [deploy-and-ops.md](./guides/deploy-and-ops.md) and `.cursor/agents/reviewer.md` (Secret Manager + `gcp-runtime-secrets.inc.sh` alignment).

---

## Deferred (larger lifts)

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).

