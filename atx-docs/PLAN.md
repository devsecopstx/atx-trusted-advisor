# Roadmap (outstanding)

Living backlog for atx app, xChat, admin, and BFF. Shipped slices are recorded in release tags, [release-notes.md](./sre-ops/release-notes.md), and topic docs. **Scheduled scanners Phase 3** (tenant categories + shared option-chain cache / circuit breaker + `**rebalance`** handler, app **≥2.9.0**) is **complete** for product job implementation — see [scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md); there are **no Phase 3 scanner job rows** on this roadmap (optional SRE follow-up: cache-hit observability under aligned crons, same plan § success criteria). This file lists **only open work**.

**Docs index:** [README.md](./README.md) · **xChat Hardcore** (Phase 1 multi-agent): [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · Deploy / secrets / desk SMTP: [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) · NL / strategy preflight: [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · OptionsStrategyEngine: [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · Charts: [design-system/charts-apex.md](./design-system/charts-apex.md) · Redis: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md) · Auth: [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) · Audit: [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) · **Phase 3 scanners (shipped):** [design-system/scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md)

---

## Product backlog


| Priority | Item                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **100**  | **Email validation + delivery test + welcome emails**        | Add email validation on user/admin email entry points, add a delivery-channel **test action** for email verification in admin delivery settings, and send access-approved **welcome emails** to users when access is granted. Include integration coverage for validation failures, test-action success/failure, and welcome-email trigger behavior. |
| **485a** | **Google-link duplicate-user admin merge tooling**           | Remaining work from Google-linking slice: add admin/support merge flow for legacy duplicate `core_users` rows with audit trail and safety checks.                                                                                                                        |
| **486n** | **Auth: email + password**                                   | Register / login / reset without X or Google; hash + rate limits + audit; SMTP/transactional email for reset. UI on guest panel and/or `/login`/`/register` (today `/login` → `/xchat` — align when this ships).                                                                                                                                                                                                                               |
| **900**  | **Automated trades w/ verify**                               | Ship only after **ETRADE** and **IBKR** execution/custodian path; until then alerts / manual execution only.                                                                                                                                                                                                                                                                                                                                   |
| **701**  | **xChat — privacy-first history policy (locked for MVP)**    | App user only: **default ephemeral** continuity (send recent 5–10 messages in each ask) with optional opt-in toggle **“Keep last 10 messages.”** Persist only when user consents, encrypt in transit/at rest, rolling cap = 10, TTL = 60 days, and immediate hard-delete on user delete action. Remove/disable xChat history sync/write into any xAI/team collection for MVP; keep persona/team RAG grounding unchanged. |
| **702**  | **xChat — paste screenshots (clipboard)**                    | Support **paste from desktop** (clipboard `image/*`) into the chat composer; same persistence + safety pipeline as **701** (virus scan policy TBD, max dimensions/bytes, strip EXIF if required).                                                                                                                                                                                                                                              |
| **703**  | **xChat — voice input (short prompts)**                      | **Voice capture** for brief utterances (e.g. *“add NVDA to my watchlist”*): browser **Web Speech API** and/or STT provider; **intent routing** into existing NL / tool paths (`watchlist` mutations, etc.) with explicit **confirm-before-mutate** for destructive or multi-symbol actions.                                                                                                                                                    |
| **704**  | **Billing — accept xMoney via xAI API (exploratory)**       | **Lower priority (after 702).** Evaluate whether xAI billing surfaces can support xMoney settlement; if not, integrate xMoney as a separate provider behind checkout/webhook abstraction. Define plan mapping parity with Stripe, webhook lifecycle contract, and failover/rollback posture before implementation.                                                                                                                                    |


### NL and strategy preflight

**Deep spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

### Deferred product TODOs

- Shipped in app **3.0.16:** soft-theme polish for xChat composer + xOptions (page surface token, chain/CTA/chart readability); **`/xoptions`** layout loads **`portfolios-dashboard.css`** with workspace rail so sidebar Lucide glyphs stay 1rem-class sized.
- Shipped in app **3.0.6:** portfolios compact watchlist shows top five IV/OI scan rows (`watchlist-hot`) plus watchlist manage link; xOptions step 3 strategy cards show **Requires** (cash vs stock) and dropped verbose bullets / Learn more; xOptions step 4 payoff chart is optional via sidebar **Payoff preview** (default off), with position review reflow under the chain when the chart is hidden.
- Shipped in app 3.0.3: increased dark-rail icon contrast for shared app-user + portfolio workspace sidebars so section glyphs remain readable in xOptions/xChat left-rail surfaces.
- Shipped in app 3.0.2: BFF proxy controls now include dedicated route toggles for admin access requests and xOptions strategy-options APIs (`ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS`, `ATXFINANCE_BACKEND_PROXY_STRATEGY_OPTIONS`), plus deploy-script env pass-through and `ops:db:probe` for fast staging/prod Mongo parity checks before paid deploys.
- Shipped in app 3.0.1: xOptions Step 4 now auto-selects expiration dates using a default **2-week (14d)** horizon (mobile-safe first load), and browser favicon now matches the left-rail swirl mark (`/branding/aTx.png`) for dark-tab visibility.
- Shipped in app 3.0.0: Account rail **Install App** prompt (manifest + service worker + iOS Add to Home Screen fallback steps).
- `/login` deprecated (redirect → `/xchat`); fold plan tiers into guest panel or access-request flow.
- Watchlist quote freshness: background refresh cadence + last-updated + stale badge on `/watchlist` and related tables.

### Desk email & delivery (ops / PR review)

- **Reviewer / infra:** Desk SMTP + BFF split (Next vs JVM when `ATXFINANCE_BACKEND_ORIGIN` is set) — [deploy-and-ops.md](./guides/deploy-and-ops.md) (`gcp-runtime-secrets.inc.sh`, `verify-gcp-runtime-secrets.sh`, sync `ops:secrets:sync-desk-smtp:*`). **Current behavior** (portfolio `email`, platform `/admin/delivery-channels` `**email`**, task summaries): [design-system/current-state-features.md](./design-system/current-state-features.md).
- **Outstanding:** Portfolio `**sms`** / `**push`** channel kinds (still skipped). **486n** auth password-reset mail is separate product work.
- ZenBusiness hosted mailbox: SMTP host `**mail.b.hostedemail.com`**; [client setup](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F).

---

## xChat Hardcore

**Phase 1 — xChat → xStrategyBuilder multi-agent (completed).**

**Canonical:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md)

**Phase 1 baseline is complete** for the current product scope (preflight + create/handoff + xStrategyBuilder thin handoff), and native xChat continuation into strategy-job turns is complete.

**Shipped today (backend + contract surface):** Spring `**StrategyJobService`** — `POST` / `GET /api/strategy-jobs`, `POST …/turns` through `**slots_complete`**; stable `**jobId**` + `**correlationId**`; hourly job cap with **Redis** when `**REDIS_URL`** is set (else Mongo count); Next **BFF** proxy routes + `**tests/smoke/backend-http-api-parity.test.ts`** needles + `**atxfinance-backend-http-api.md`** strategy-jobs section + `**CURRENT_STATE_ROUTES**` entries.

**Next / outstanding (tracked here or below):** Observability hardening (correlation/job/persona/model), audit/doc parity, and strict JSON Schema artifact v2 under [Deferred (larger lifts)](#deferred-larger-lifts).

**Open question:** Attachment ingestion policy for 701/702 while keeping ephemeral-by-default privacy posture.

---

## TEAM-only xAI (legacy path removal)

**Goal:** Drop `userBootstrapCollectionId` and per-user bootstrap where policy is TEAM-only; anchor on `XAI_TEAM_ID` for team KB.

**Remaining:** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Stripe & billing

**Shipped (app 2.10.22):** `POST /api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`; updates `core_users.subscriptionPlan`; structured webhook logs for received/handled/ignored/error paths; deploy/runtime secret plumbing for `STRIPE_WEBHOOK_SECRET` (verify + Cloud Run mount + sync scripts + docs); guest access-request route (`POST /api/access-requests/public`) now stays Next-local even when `ATXFINANCE_BACKEND_ORIGIN` is set (prevents backend-only 404 regression).

**Remaining:** Customer portal deep link and `getPlanLimits()` paid-tier gating polish. Setup: [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) · limits matrix: [atx-limits.txt.tsv](./resouces/atx-limits.txt.tsv).

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
- **Stripe / webhook closure (app 2.10.22):** Added integration coverage for webhook handling and public access-request non-proxy behavior under backend-origin mode (`tests/integration/stripe-webhook-route.test.ts`, `tests/integration/access-requests-public-rate-limit.test.ts`); deploy/runtime docs synced for `STRIPE_WEBHOOK_SECRET`.

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

