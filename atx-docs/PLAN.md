# Roadmap (outstanding)

Living backlog for atx app, xChat, admin, and BFF. **Architecture, baseline contracts, and “what exists today”** live in [design-system/current-state-features.md](./design-system/current-state-features.md) (including § **What's next** → this file). **Semver release history:** [release-notes.md](./sre-ops/release-notes.md). Tenant roadmap narrative: [.cursor/skills/skill-tenant-roadmap/SKILL.md](../.cursor/skills/skill-tenant-roadmap/SKILL.md).

**Near-term focus:** Product backlog rows **11** (tenant UX soak), **41** (rental billing), **10** (multi-tenant provisioning), **705**/**706** (tasks + automations), plus **xChat Hardcore** (meter + vision + JVM ask) below.

**Docs index:** [README.md](./README.md) · **Current state:** [design-system/current-state-features.md](./design-system/current-state-features.md) · **Tenant UX (`tenant_ux`):** [design-system/tenant-ux-plan.md](./design-system/tenant-ux-plan.md) · [sre-ops/tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md) · **xChat Hardcore** (Phase 1 multi-agent): [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · Deploy / secrets / desk SMTP: [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) · NL / strategy preflight: [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · OptionsStrategyEngine: [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · **IBKR:** [design-system/ibkr-automation.md](./design-system/ibkr-automation.md) · Charts: [design-system/charts-apex.md](./design-system/charts-apex.md) · Redis: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md) · Auth: [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) · Audit: [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) · **Phase 3 scanners:** [design-system/scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md)

[Design and UX roadmap](#design-and-ux-roadmap) adds **open UX items** plus a short **multi-agent usage policy** (guidance, not a dated deliverable).

---

## Product backlog

| Priority | Item                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **11**   | **Tenant UX (`tenant_ux`) — V2 soak + observability**         | Enable `**TENANT_UX_ENFORCEMENT_V2`** staging→prod (fail-open log `**tenant_ux_policy_fetch_error`**; optional `**TENANT_UX_POLICY_FAIL_CLOSED**`). **Shipped:** structured **`tenant_ux_metric`** logs + Redis **`tenant-ux:policy:v2:*`** (**60s** TTL, active with **`REDIS_URL`** in dev/prod). **Remaining:** metrics/alerts dashboards, `/api/*` map audit, PWA manifest, optional explicit Redis bust on roles/catalog **`PATCH`**. [tenant-ux-plan.md](./design-system/tenant-ux-plan.md) · [tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md) · [redis-cache-next.md](./sre-ops/redis-cache-next.md)                                                                                                                                                                                                      |
| **41**   | **AI Rental Platform — billing & admin delivery**             | **Shipped:** Admin **`GET`/`POST /api/admin/tenants/{tenantId}/rental-api-keys`**, **`DELETE …/{keyId}`**, **`POST …/{keyId}/rotate`** (plaintext once; **`revokedAt`**); Stripe webhook rental SKU → **`rentalExpiresAt`** / **`rentalStripeSubscription*`** / **`rentalProfile.expiresAt`** (metadata **`atx_rental_tenant_id`** or **`atx_tenant_id`**, or tenant **`rentalStripeSubscriptionId`** lookup); optional **Redis** rental inflight counter when **`REDIS_URL`** is healthy (else in-process **8**/tenant). **Remain:** Stripe Checkout wiring for rental SKU in product UI (**`ENABLE_RENTAL_AI_BILLING`**); optional **CORS** / embed allow-list for partner iframes. [rental-ai-platform.md](./sre-ops/rental-ai-platform.md), [release-notes.md](./sre-ops/release-notes.md). |
| **10**   | **Multi-tenant — provisioning follow-ups**                    | **Open:** Admin Bootstrap log / replay UX; Spring `**DefaultPortfolioProvisionService**` parity for new preference fields; richer Admin **YAML preview** on tenant create/edit. `**tenant-specs/README.md`** · `**auth-and-access.md`**.                                                                                                                                                                                                                                                                                                                          |
| **200**  | **IBKR — Client Portal integration & execution path**         | **Open next:** operator paper-account test harness; CP session **refresh / re-auth UX** (token/OAuth-style SSO still future). **Then:** live portfolio sync + pacing-safe caching; contract/market-data helpers; order builder + `/iserver/order/confirm` preview; automation rule engine + kill switches; pre-trade risk dashboard + notifications; tests/monitoring + production hardening/rollout. **Blocks** custodian-automated execution narrative alongside **900** until this path matures.                                                                   |
| **900**  | **Automated trades w/ verify**                                | Ship only after **ETRADE** and **IBKR** execution/custodian path; until then alerts / manual execution only.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **704**  | **Billing — xMoney parallel checkout + crypto book (phased)** | **Production-grade roadmap:** [xMoney & crypto portfolio (704)](#xmoney-crypto-portfolio-704-technical-integration-roadmap) — Phase 0 (billing), Phase 1 (crypto book + quotes), **Phase 2** (xAI strategies / alerts / xOptions payoff), **Phase 3** (optional X Money wallet sync + settlement). **Today:** Stripe-only; no multi-provider adapter yet. **External API:** [docs.xmoney.com/api/reference](https://docs.xmoney.com/api/reference).                                                                                                                   |
| **705**  | **App_user Tasks — strategy handoff (Phase 2)**               | Hook `**strategy`** / `**scan`** / `**report**` to OptionsStrategyEngine / strategy jobs; richer edit UX; optional Spring poller parity.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **706**  | **Tenant workspace automations — follow-ups**                 | NL schedule (“plain English”) via Grok; JVM `**TASK_QUEUE_CONCURRENCY_PER_TENANT`** fairness; extra safe categories; `**workspaceLimits.planOverrides`** for `**maxTenantUserTasks**`. Doc: `[scheduled-task/user-tasks.md](./design-system/scheduled-task/user-tasks.md)`.                                                                                                                                                                                                                                                                                           |


- **White-label branding backlog:** matrix **preview pane** + **dynamic PWA manifest** per tenant (display keys today: `**tenantPreferences`** + **§ Tenant UX** in [current-state-features.md](./design-system/current-state-features.md)).

### Multi-tenant (priority **10**)

Open follow-ups stay in the backlog table: Admin bootstrap visibility/replay, Spring read-path parity, and optional create/edit form preview.

### NL and strategy preflight

**Deep spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

Open follow-ups: scanner threshold tuning + richer alert ergonomics across `watchlist_price_scanner`, `user_alert_manager`, and `/portfolio/alerts` workflows.

### Deferred product TODOs

- **xChat vision paste — still open:** virus scan policy, optional max dimensions, EXIF strip, batch/admin harness parity.
- Watchlist quote freshness: background refresh cadence + last-updated + stale badge on `/watchlist` and related tables.
- **Options action scan share/report hardening:** watermark/recipient banner controls for `/reports/scan/{token}`, optional signed-download audit trail, and configurable expiry beyond the default 24h token TTL.
- **Edit Account → automated scanner / price-alert thresholds (backlog, not a regression):** Consolidated holdings already exposes **Avg cost** vs **Last** and a **Desk** flow that `**POST /api/portfolios/{portfolioId}/alerts`** (portfolio row + optional desk channels). **Still backlog:** row-level binding to `**price-alert-service`**, scheduled scanner thresholds from those fields, and **option mark** quotes when chain data is wired per `yahooRef` — [portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md).

### Desk email & delivery (ops / PR review)

- **Reviewer / infra:** Desk SMTP on **Next** for portfolio `email`, `**POST /api/admin/delivery-channels/.../test`**, and related paths (`src/lib/desk-smtp.ts`) — tenant delivery-channels are **not** BFF-proxied; see [deploy-and-ops.md](./guides/deploy-and-ops.md) (`gcp-runtime-secrets.inc.sh`, `verify-gcp-runtime-secrets.sh`, sync `ops:secrets:sync-desk-smtp:*`). **Reference:** [design-system/current-state-features.md](./design-system/current-state-features.md).
- **Outstanding:** Portfolio `**sms`** / `**push`** channel kinds (still skipped). **Credential invite + password reset** use desk SMTP when configured (**Next** always; **Spring** when BFF handles approve — mount `**PUBLIC_APP_BASE_URL`** + SMTP on JVM).
- ZenBusiness hosted mailbox: SMTP host `**mail.b.hostedemail.com`**; [client setup](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F).

---

## Design and UX roadmap

**Audience:** High-frequency workflows and RIAs with appropriate licensing — polish that supports trust and operator scan speed.

### Open UX work

- **Wheel strategy visual** — Subtle, accessible motion for the wheel / income-cycle story on marketing and in-product surfaces (e.g. pitch hero motif, optional branded flow diagram). Respect `prefers-reduced-motion`; keep loops slow and non-distracting.
- **Onboarding workflows** — Stagger or transition steps in admin xPersona onboarding and related core-admin flows (directory load, filter changes, empty states) so progress feels guided without hurting scan speed for operators.
- **xChat thread expansion** — Short assistant replies: move handoff actions outside the bubble into a fixed toolbar; collapse prior turns; sticky current prompt — TanStack Virtual–friendly; optional persisted **`collapsedPrevious`** in user prefs (schema TBD).
- **Light-theme token pass** — Extend **`atxfinance-brand-kit.css`** for resolved **`xf_ui_theme`** / soft density: surfaces, text, tenant-accent hover states for workspace library + composer (Lighthouse note on `/xchat`; no backend change if themes stay client-only).

### Native multi-agent — when it still helps (Phase 2+ policy)

Only consider switching to `**grok-4.20-multi-agent`** for these narrow cases:

- Very open-ended synthesis after inputs are complete (e.g. “brainstorm five wildly different strategies given the same inputs”).
- Creative ideation phase before structured collection.
- When you want Grok to invent new question types dynamically (risky).

For the **core xStrategyBuilder loop** (collect → validate → synthesize → recommend), the **server-driven** approach stays superior: more reliable, cheaper, safer, and easier to audit. See [xChat Hardcore](#xchat-hardcore) and [atx-multi-agent.md](./xchat/atx-multi-agent.md).

---

## xChat Hardcore

**Next (prioritized engineering):**

1. **Plan limits in-product** — **Shipped:** **`XchatUsageMeter`**, **`GET /api/app-user/xchat/prompt-usage`**, **`mergeXchatPromptLimitsForWorkspace`**, 429 thread markdown + billing CTA. **Remain:** drive **`/xchat`** plans landing bullets from **`getPlanLimits()`** if desired ([Stripe billing](#stripe-billing)).
2. **Vision paste hardening** — Policy for scans, max dimensions, EXIF strip, batch harness — [Deferred product TODOs](#deferred-product-todos).
3. **JVM-authoritative ask + tool loop** — Full consolidation vs Next-first SSE — [Deferred (larger lifts)](#deferred-larger-lifts) · [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
4. **Strategy artifacts** — Strict JSON Schema **v2** (`atx-multi-agent.md`); observability + audit parity on multi-agent paths.
5. **Regression guardrails** — Advisor workspace layout, working overlay, scan meta strip, dynamic scan + lazy Prism boundaries — single reference table in [current-state-features.md](./design-system/current-state-features.md) § **xChat workspace — baseline contract**; OpenAPI tags **`xchat`** / **`reports`** + **`GET /api/app-user/xchat/token-stats`** + **`GET /api/app-user/xchat/prompt-usage`** in **`src/lib/openapi/current-state.ts`**.

---

## TEAM-only xAI (legacy path removal)

**Goal:** Drop `userBootstrapCollectionId` and per-user bootstrap where policy is TEAM-only; anchor on `XAI_TEAM_ID` for team KB.

**Remaining:** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Stripe billing

**Open:** In-product usage meter / soft-limit banner on xChat and X Money as a **second** settlement path — see [xMoney & crypto portfolio (704)](#xmoney-crypto-portfolio-704-technical-integration-roadmap). Stripe remains default for existing customers until product opts users into X Money checkout.

**Gaps:** No hermetic CI test yet for the full **`POST /api/access-requests/public`** Mongo happy path; no component/E2E for **`BillingGuestExperience`** (plan pills, scroll-to-form, OAuth **`next`**).

---

## xMoney & crypto portfolio (704) — technical integration roadmap

Phased, production-grade delivery with **zero downtime** for existing Stripe subscribers: ship X Money **additively** (new routes + env + optional UI), keep `**POST /api/webhooks/stripe`** unchanged, gate net-new X Money flows behind config/tenant flags until verified in staging, and avoid rewriting in-flight Checkout sessions.

### Phase 0 — Billing via X Money (~1 week target; depends on API access)

**Goal:** X Money as a **parallel** checkout provider alongside Stripe (conceptually the same boundaries as [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md): hosted checkout → webhook → `core_users.subscriptionPlan` + customer reference).


| Workstream               | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Provider abstraction** | Today, billing is **Stripe-concrete** (`src/app/api/billing/checkout-session/route.ts`, `portal-session`, `webhooks/stripe`). Introduce a small **internal** interface (e.g. `createSubscriptionCheckout`, `verifyWebhook`, `mapExternalPlanToAtxTier`) with Stripe as first implementation; add X Money implementation calling public API patterns (payment links, recurring subscriptions per [docs.xmoney.com/api/reference](https://docs.xmoney.com/api/reference)). |
| **Webhooks**             | New route e.g. `POST /api/webhooks/xmoney` with signature verification, idempotency store (event id or order id → processed), handlers aligned to product lifecycle: `**order.completed`**, `**subscription.updated`** / cancelled analogs — map to same `updateCoreUserSubscriptionPlan` / entitlement paths as Stripe.                                                                                                                                                 |
| **Mongo / `core_users`** | Add `**payment_provider**`: `stripe`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **UI**                   | `**/account/billing`**: second CTA **Fund with X Money** (or product copy) next to existing Stripe button; only render when X Money is configured. Deep-link or API flow for **X-linked wallet** per X Money docs.                                                                                                                                                                                                                                                       |
| **Portal parity**        | Stripe uses **Customer Portal**; X Money may differ — document whether users manage payment method / cancel in X Money hub vs in-app; do not remove Stripe portal for mixed-provider tenants until parity is explicit.                                                                                                                                                                                                                                                   |


**Zero-downtime notes:** No migration of existing `stripeCustomerId` rows required for launch; new checkouts pick provider; admin override of `subscriptionPlan` stays valid; feature flag env (e.g. `XMONEY_BILLING_ENABLED`) + allowlist tenant id optional.

### Phase 1 — Crypto asset support in portfolio DB & UI (~2–3 weeks after Phase 0)

**Goal:** Crypto alongside equity/options in the same book model and consolidated holdings story.


| Workstream | Detail                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema** | Extend `**tenant_portfolio`**, `**portfolio_accounts`**, `**portfolio_positions**` (and any serializers): `**asset_type**`: `"equity"`                                                                                                                                          |
| **Quotes** | `**find-options`** / `**market/workspace-pulse`** (and related): surface crypto quotes + chain metadata via **Yahoo** + **IBKR** where account has consent.                                                                                                                     |
| **IBKR**   | Existing consent + `**GET /api/integrations/ibkr/accounts`** path; extend snapshot ingestion for **crypto balances** when CP/API exposes them (product assumption: IBKR EEA crypto rollout — validate against live paper). No new custodian required for that slice.            |
| **UI**     | Consolidated holdings table ([portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md)): unified **% exposure** and risk columns where applicable (theta/gamma N/A for spot crypto — show **—** or hide per row type). |


### Phase 2 — xAI-powered crypto strategies & alerts (~3–4 weeks after Phase 1)

**Goal:** Treat crypto as a first-class **strategy and risk** surface alongside options, reusing schedulers and narrative patterns you already ship.


| Workstream                           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OptionsStrategyEngine + scanners** | Reuse **OptionsStrategyEngine** and **scanner / scheduled jobs** ([strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md), [scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md) patterns): add **crypto-specific** rule templates (e.g. *BTC 30-day covered call*, *ETH strangle for volatility crush*), validation, and desk-safe defaults consistent with equity/options jobs. |
| **Alert modal (portfolio)**          | Extend the alert UX you are speccing for consolidated holdings: **Crypto** severity or category **pills**; **xAI narrative** block with **conservative / balanced / aggressive** outlook copy (grounded on positions + quotes; same guardrails as other xChat/xOptions disclosures).                                                                                                                                            |
| **xOptions — crypto payoff**         | New or extended **xOptions** flow: **Step 4 payoff charts** include **BTC / ETH** (and other supported) **options chains** — primary path **IBKR** where entitled; optional **Coinbase Derivatives** nano futures / listed crypto derivatives for advanced tiers only if product + compliance sign off (feature-flagged).                                                                                                       |
| **Cross-asset portfolio alerts**     | `**POST /api/portfolios/{id}/alerts`** (and/or scanner-derived alerts): flag **concentration across asset classes** — e.g. *“Your 18% BTC exposure is 2.4× your equity book delta”* — using Phase 1 position marks + optional Greek/delta proxies where defined.                                                                                                                                                                |


**Dependencies:** Phase 1 **schema + quotes** stable enough for jobs to read crypto rows; entitlements unchanged unless you tier crypto strategies separately.

### Phase 3 — Full X Money wallet sync (ongoing; optional / aggressive)

**Goal:** Optional **read/write** X Money integration for balances and, when custodians allow, **settlement** — same **audit and containment** bar as IBKR.


| Workstream             | Detail                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Read path**          | Pull **X Money balance** (and optionally recent activity) into **portfolio summary** / workspace pulse — read-only first; cache + rate limits; no hot-path blocking on wallet API failures (degrade gracefully).                                                                            |
| **Write / settlement** | **Direct settlement** of options/crypto trades from **X Money wallet** only when **IBKR** (or chosen executor) exposes a supported flow — treat as **opt-in** per tenant/user; kill switch + feature flag.                                                                                  |
| **Audit**              | **Every** wallet pull, link, and settlement attempt: `**correlationId`** end-to-end + `**admin_audit_events`** (and structured app logs), mirroring [ibkr-automation.md](./design-system/ibkr-automation.md) / existing IBKR correlation discipline — no silent cross-asset money movement. |


**Posture:** Phase 3 is **not** required for Phases 0–2; ship only after billing (0) and book (1) are proven in prod, and legal/ops sign off on read/write money-movement scope.

### Tests — current coverage vs gaps

**Existing (Stripe / billing UI):** `tests/unit/atx-billing-plans.test.ts`, `billing-plan-workspace-display.test.ts`, `billing-workspace-limit-labels.test.ts`, `stripe-price-resolve.test.ts`, `tenant-plan-overrides-stripe.test.ts`; integration: `billing-checkout-session-route.test.ts`, `billing-portal-session-route.test.ts`, `stripe-webhook-route.test.ts`.

**Gaps to close when implementing 704:**

- **Checkout success path:** Integration tests today mostly assert **401/503** branches on `checkout-session`; add a **mocked provider** happy path that returns a redirect URL and validates metadata (`atx_user_id`, `atx_plan_id`) round-trip contract.
- **Portal session:** Same pattern — assert behavior when external customer id exists vs missing (Stripe today; X Money TBD).
- **X Money webhooks:** Contract tests from **fixture payloads** (signature + body) → `subscriptionPlan` + `payment_provider` updates; **duplicate delivery** idempotency.
- **Dual provider:** Matrix test — user on Stripe cannot be downgraded by unrelated X Money event; user on X Money not altered by Stripe `customer.subscription.deleted` if subscription ids are disjoint.
- **E2E (optional / staging):** One manual or Playwright path: billing page → X Money checkout sandbox → webhook → entitled UI (conscious gap today; [payment-audit-checklist.md](./sre-ops/payment-audit-checklist.md) is Stripe-only).
- **Phase 2:** Unit/integration coverage for **crypto scanner rules** (job payload → intended symbols/legs), **alert create** payloads with crypto severity + narrative fields, and **payoff / chain** helpers (mocked market data — no mandatory live IBKR/Coinbase in CI).
- **Phase 3:** Contract tests for **wallet read** client (fixtures); **no** default CI against live X Money — assert **audit rows** + `correlationId` propagation on mocked success/failure paths; settlement behind flag with dry-run mode tests if exposed.

### Docs — current coverage vs gaps

**Existing:** [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md), [payment-audit-checklist.md](./sre-ops/payment-audit-checklist.md) (Stripe), [api-endpoints.md](./guides/api-endpoints.md) billing rows, [deploy-and-ops.md](./guides/deploy-and-ops.md) Stripe secrets.

**Gaps to close when implementing 704:**

- `**api-endpoints.md`:** Document `POST /api/billing/checkout-session` provider parameter or parallel `**POST /api/billing/xmoney/...`** once routes are stable; add webhook path and env var table for X Money secrets (API key, webhook secret, optional publishable client id).
- `**deploy-and-ops.md` + Secret Manager scripts:** Mirror Stripe pattern for X Money credentials; verify job lists (`gcp-runtime-secrets.inc.sh` / `verify-gcp-runtime-secrets.sh`) when vars are finalized.
- `**payment-audit-checklist.md`:** Add an **X Money** subsection (Dashboard/log checks + `core_users.payment_provider` + external ids).
- **Data model:** Document new `core_users` fields in [auth-and-access.md](./guides/auth-and-access.md) or a short `**atx-docs/sre-ops/billing-data-model.md`** (subscription + provider ids, migration notes).
- **OpenAPI / `CURRENT_STATE_ROUTES`:** Register new routes for inventory tests when implemented.
- **Phase 1:** Portfolio schema doc + `ibkr-automation.md` note on crypto snapshot fields; extend consolidated-holdings semantics table for crypto row rules.
- **Phase 2:** Spec the **alert modal** crypto pills + xAI narrative contract (request/response or UI props); document new **scanner / strategy job** types and xOptions **Step 4** crypto chain sources (IBKR vs optional Coinbase Derivatives) in [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) and [portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md) (or linked xOptions doc).
- **Phase 3:** Runbook: X Money **OAuth / API keys**, refresh, incident response, and **audit evidence** pack (align with [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md)); explicit **kill switch** env and operator checklist before enabling write/settlement.

---

## SRE / platform gaps

**Baseline:** BFF registry `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` + `tests/unit/bff-proxy-registry-next-handlers.test.ts`; JVM `./gradlew test` in `services/atxfinance-backend`; deploy: `.github/workflows/deploy-cloud-run.yml`, `AGENTS.md`.

### Deploy reliability (GH-first)

- Async `gcloud builds submit` + `gcloud builds describe` polling (avoid log-stream permission false failures).
- Fail only on terminal non-success; always print Build id + log URL.
- Post-deploy: staging custom domain + Cloud Run `status.url` must match app version (catch routing/cache drift).
- Fallback: `scripts/ops/deploy-cloud-run-from-env.sh`; prefer immutable image promotion when skipping rebuild.

### Test / doc follow-ups (conscious)

- `**POST /api/import/broker/clean`:** Documented in `**api-endpoints.md`** and [app-user import](./design-system/portfolio/app-user-import-activity.md); no dedicated route integration test yet (destructive — mock `**deleteAllPositionsForPortfolio`** + job/task deletes if added). **Partial `mappings` / row toggles:** covered by unit tests on `**validateBrokerImportMappings`** in `**app-broker-import-job.test.ts`**; full apply path remains integration-heavy (job + scheduled task). **Dry-run preview payload:** `**app-import-broker-route.test.ts`** asserts **`brokerImportDryRunResponseSchema`** (`**csvStats`**, **`sampleRows`**, **`previewWarnings`**); **`broker-import-dry-run-preview.test.ts`** covers sample-row shaping and warnings.
- **Email/password:** unit tests `**password-crypto`**, `**auth-token-hash`**, **`admin-user-credential-invite`** (eligibility for admin resend); approve-route + **`admin-user-resend-credential-invite-route`** integration tests use mocks for SMTP; audit actions `**credential_invite_*`** / `**bootstrap_enqueue_failed**` documented in `**auth-and-access.md**` / `**current-state-features.md**` — no CI E2E against live SMTP. **Guest register:** see [Stripe billing](#stripe-billing) (**Gaps** for remaining test coverage).
- **X Money / multi-provider billing (704):** No automated coverage yet — follow the gap list under [xMoney & crypto portfolio (704)](#xmoney-crypto-portfolio-704-technical-integration-roadmap) § Tests.

### BFF / consolidation (intentionally Next-only for now)

- **Portfolio workspace snapshots — JVM fast-path:** Next materializes `portfolio_workspace_snapshots` in Mongo (read order: local Redis `xf:wsnap:v1:*` → optional **JVM** `GET /api/portfolios/{id}/snapshot` when **`ATXFINANCE_BACKEND_ORIGIN`** is set → materialized row → live build). Spring uses the **same Redis key prefix** with market-window TTL (60s open / 300s closed ET), returns **`data.preload`** + **`data.structured`** + **`data.cache`**, and purges snapshot keys on app-user position/account/watchlist mutations and **portfolio rename**. Scanner tasks still warm rows after success on Next (audit/task-runner path).
- xChat `/api/xchat/`* — deferred per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- Persona governance extensions (publish, archive, rollback, versions, xAI collection helpers) — Next until moved to Spring.
- Admin `PATCH/DELETE …/positions/{positionId}` — Next until registry + Kotlin parity.
- Most auth routes Next; optional Google callback proxy for dual-run.

**Ops:** With Spring enabled, set `**ATXFINANCE_BACKEND_ORIGIN`** to the backend **HTTPS** origin (no `:8080` on public hostnames; see `.cursor/agents/sre.md` / deploy workflows). Unset ⇒ Next-only (avoid split-brain writes). **Reviewer:** infra PRs that touch desk SMTP or BFF — cross-check [deploy-and-ops.md](./guides/deploy-and-ops.md) and `.cursor/agents/reviewer.md` (Secret Manager + `gcp-runtime-secrets.inc.sh` alignment).

---

## Deferred (larger lifts)

- **xChat ask on Spring / JVM-authoritative tool loop:** Live streaming is **Next-first** today; JVM **`POST /api/xchat/ask/stream`** remains an optional BFF passthrough when **`XCHAT_SSE_PROXY_BACKEND`** is set — full consolidation per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- Strict JSON Schema for strategy artifacts **v2** (`atx-multi-agent.md`) — **deferred**; v1 Markdown + fenced JSON remains canonical until schema work lands.