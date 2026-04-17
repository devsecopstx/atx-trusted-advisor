# Roadmap (outstanding)

Living backlog for atx app, xChat, admin, and BFF. **Shipped stack, features, CI/test matrix, and doc/test gap index:** [design-system/current-state-features.md](./design-system/current-state-features.md). Shipped slices are also recorded in release tags, [release-notes.md](./sre-ops/release-notes.md), and topic docs. **Scheduled scanners Phase 3** (tenant categories + shared option-chain cache / circuit breaker + `**rebalance`** handler, app **≥2.9.0**) is **complete** for product job implementation — see [scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md); there are **no Phase 3 scanner job rows** on this roadmap (optional SRE follow-up: cache-hit observability under aligned crons, same plan § success criteria). This file lists **open backlog**; [Design and UX roadmap](#design-and-ux-roadmap) adds **open UX items** plus a short **multi-agent usage policy** (guidance, not a dated deliverable).

**Docs index:** [README.md](./README.md) · **Current state:** [design-system/current-state-features.md](./design-system/current-state-features.md) · **Tenant UX (`tenant_ux`):** [design-system/tenant-ux-plan.md](./design-system/tenant-ux-plan.md) · **xChat Hardcore** (Phase 1 multi-agent): [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · Deploy / secrets / desk SMTP: [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) · NL / strategy preflight: [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · OptionsStrategyEngine: [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · **IBKR:** [design-system/ibkr-automation.md](./design-system/ibkr-automation.md) · Charts: [design-system/charts-apex.md](./design-system/charts-apex.md) · Redis: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md) · Auth: [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) · Audit: [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) · **Phase 3 scanners (shipped):** [design-system/scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md)

---

## Product backlog


| Priority | Item                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **11**   | **Tenant UX (`tenant_ux`) — per-role routes & landing**   | **Plan:** [design-system/tenant-ux-plan.md](./design-system/tenant-ux-plan.md). **Shipped:** `data/platform/app-user-route-catalog.json`, `getAppUserRouteCatalog()`, **`GET /api/admin/platform/route-catalog`** (`global_admin`). **Open:** Mongo per-tenant overrides, admin **`tenant_roles`** UI, `PUT/PATCH` admin API, **`proxy`/layout/API enforcement**, nav hiding for disallowed routes. Aligns with **`APP_USER_PRODUCT_PATH_PREFIXES`** / **`surface-policy.ts`**. |
| **10**   | **Multi-tenant — provisioning + per-tenant branding**      | **Phase 1 (shipped in repo):** **`tenant-specs/*.yaml`** is the **provisioning contract** for net-new tenants: `tenant` block plus optional **`initialTenantAdmin`** (email, optional X `xUserId`, `platformRole` `advisor` \| `operator` \| `viewer` with default **`operator`** so the user can sign in — `tenant_admin` is membership-only), optional **`tenantPreferences`** (`xchat_brandname`, `xstrategybuilder_brandname`, **`xf_ui_theme`**), **`workspaceLimits`**. **`npm run seed:tenant -- --file …`** idempotently upserts **`core_tenants`** (never sets `isDefault`; default tenant stays **`seed:admin`**), merges **`tenantPreferences`** keys without wiping other flags, upserts **`core_users`** / optional **`xAccount`**, upserts **`core_tenant_memberships`** as **`tenant_admin`**; by default **`setAsDefaultSessionTenant: true`** clears other defaults for that user so the new tenant is the session default (opt out if the user must keep another default). **App 3.3.19+:** signed-in **Next** shell applies **`tenantPreferences.xf_ui_theme`** when set (overrides stale browser theme storage); **`/xchat`** / **`/xoptions`** approved headers show **`core_tenants.name`** under the brand (shared resolver with **`/portfolios`**). **Phase 2+:** admin UI / HTTP API mirror of the same contract; optional default portfolio/watchlist bootstrap parity with access-approved flows if product requires it. |
| **100**  | **Email validation + delivery test + welcome emails**        | **Partial (app 3.3.15+):** admin **`/admin/delivery-channels`** **Send test** for **email** + optional **`DESK_DELIVERY_CHANNEL_TEST_TO`** / **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`** (see **`deploy-and-ops.md`**); unit + integration tests. **Post-approve credential invite + forgot/reset** ship with desk SMTP (**3.6.17+** Next; **3.6.18+** Spring **`CredentialInviteService`** when BFF approves). **Open:** entry-point **verify-email** validation, access-approved **welcome** mail (beyond set-password invite), broader integration around validation failures. |
| **200**  | **IBKR — Client Portal integration & execution path**        | **Full spec + phased plan:** [ibkr-automation.md](./design-system/ibkr-automation.md). **Goal:** user-authorized IBKR (read balances/positions/orders/executions; later manual orders + rules/automation); paper before live; audit every API call/order; rate limits + circuit breakers; no credentials in client bundles (`src/modules/ibkr-integration/README.md`). **Shipped (app 3.2.x):** consent (`ibkr_user_consents`), sealed httpOnly CP session, `GET /api/integrations/ibkr/accounts`, `/account/integrations/ibkr`. **Open next:** operator paper-account test harness; CP session **refresh / re-auth UX** (token/OAuth-style SSO still future). **Then (per spec phases):** live portfolio sync + pacing-safe caching; contract/market-data helpers; order builder + `/iserver/order/confirm` preview; automation rule engine + kill switches; pre-trade risk dashboard + notifications; tests/monitoring + production hardening/rollout. **Blocks** custodian-automated execution narrative alongside **900** until this path matures. |
| **900**  | **Automated trades w/ verify**                               | Ship only after **ETRADE** and **IBKR** execution/custodian path; until then alerts / manual execution only.                                                                                                                                                                                                                                                                                                                                   |
| **703**  | **xChat — voice input (short prompts)**                      | **Voice capture** for brief utterances (e.g. *“add NVDA to my watchlist”*): browser **Web Speech API** and/or STT provider; **intent routing** into existing NL / tool paths (`watchlist` mutations, etc.) with explicit **confirm-before-mutate** for destructive or multi-symbol actions.                                                                                                                                                    |
| **704**  | **Billing — accept xMoney via xAI API (exploratory)**       | **Lower priority.** Evaluate whether xAI billing surfaces can support xMoney settlement; if not, integrate xMoney as a separate provider behind checkout/webhook abstraction. Define plan mapping parity with Stripe, webhook lifecycle contract, and failover/rollback posture before implementation.                                                                                                                                    |


### Multi-tenant (priority **10**) — locked decisions (pre–Phase 2)

- **Platform role for tenant admins:** **`operator`** (recommended default) or **`advisor`**, plus **`tenant_admin` on `core_tenant_memberships`**. Do **not** grant **`global_admin`** unless that person must use platform **`/admin`**.
- **Pre-seeded X id + real email:** Provision **`core_users.email`** (canonical) and **`xAccount`** plus login-eligible **`roles`** so X OAuth hits **`getCoreUserByXOAuthIdentity`** (API user id or username/handle match) and completes without placeholder / **`email_link_required`** when X omits email. Integration coverage: **`tests/integration/x-oauth-provisioned-tenant-admin.test.ts`**.
- **Branding vs compliance:** White-label **display names** only (`tenantPreferences` / YAML **`xchat_brandname`**, **`xstrategybuilder_brandname`** — product surfaces use **xChat** / **xStrategyBuilder** internally). Do **not** copy or imply **different regulatory posture** per tenant unless legal explicitly approves.
- **Naming contract:** **`tenant.slug`** and **`tenant.name`** are **required** in specs; branding keys stay **`xchat_brandname`**, **`xstrategybuilder_brandname`** (v1). Logos / theme colors: **placeholders** until a later phase.
- **Entry point:** **CLI + YAML** remains the supported provisioning surface for v1 (**`npm run seed:tenant`**).
- **Google vs X for tenant admins (v1):** **`initialTenantAdmin.email` is required** (canonical row). **`xUserId` is optional** — when set, Sign in with X resolves by id without placeholder flow. **Google:** first successful Google OAuth with a **verified email matching that row** links **`googleAccount`** to the **same** `core_users` document (no separate `googleSub` in YAML for v1). **Do not require `xUserId`** if admins are Google-only.

### NL and strategy preflight

**Deep spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

### Deferred product TODOs

- **Older shipped slices (3.0.x–3.6.x):** debug gating, vision paste, privacy-first xChat history, proxy edge, soft theme, watchlist/xOptions polish, BFF toggles, PWA install prompt, etc. — see [release-notes.md](./sre-ops/release-notes.md) and [current-state-features.md](./design-system/current-state-features.md); do not duplicate here.
- **Email + password auth (shipped 3.6.17–3.6.18):** `/login` (OAuth-first + email/password), set-password / forgot / reset routes, `POST /api/auth/email/*`, post-approve invite on **Next**; **Spring** **`CredentialInviteService`** when BFF proxies approve — see [auth-and-access.md](./guides/auth-and-access.md). **Open product:** `/xchat` guest CTA ordering (email vs OAuth prominence) behind env/tenant flag TBD; optional **`/register`** alias; pre-login **email verification** flow not shipped — track under **100** / tenant narrative.
- **xChat vision paste — still open:** virus scan policy, optional max dimensions, EXIF strip, batch/admin harness parity.
- Watchlist quote freshness: background refresh cadence + last-updated + stale badge on `/watchlist` and related tables.
- **Edit Account → automated scanner / price-alert thresholds (backlog, not a regression):** Consolidated holdings already exposes **Avg cost** vs **Last** and a **Desk** flow that **`POST /api/portfolios/{portfolioId}/alerts`** (portfolio row + optional desk channels). **Still backlog:** row-level binding to **`price-alert-service`**, scheduled scanner thresholds from those fields, and **option mark** quotes when chain data is wired per `yahooRef` — [portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md).

### Desk email & delivery (ops / PR review)

- **Reviewer / infra:** Desk SMTP on **Next** for portfolio `email`, **`POST /api/admin/delivery-channels/.../test`**, and related paths (`src/lib/desk-smtp.ts`) — tenant delivery-channels are **not** BFF-proxied; see [deploy-and-ops.md](./guides/deploy-and-ops.md) (`gcp-runtime-secrets.inc.sh`, `verify-gcp-runtime-secrets.sh`, sync `ops:secrets:sync-desk-smtp:*`). **Current behavior:** [design-system/current-state-features.md](./design-system/current-state-features.md).
- **Outstanding:** Portfolio `**sms`** / `**push`** channel kinds (still skipped). **Credential invite + password reset** use desk SMTP when configured (**Next** always; **Spring** when BFF handles approve — mount **`PUBLIC_APP_BASE_URL`** + SMTP on JVM).
- ZenBusiness hosted mailbox: SMTP host `**mail.b.hostedemail.com`**; [client setup](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F).

---

## Design and UX roadmap

**Audience:** High-frequency workflows and RIAs with appropriate licensing — polish that supports trust and operator scan speed.

### Open UX work

- **Wheel strategy visual** — Subtle, accessible motion for the wheel / income-cycle story on marketing and in-product surfaces (e.g. pitch hero motif, optional branded flow diagram). Respect `prefers-reduced-motion`; keep loops slow and non-distracting.
- **Onboarding workflows** — Stagger or transition steps in admin xPersona onboarding and related core-admin flows (directory load, filter changes, empty states) so progress feels guided without hurting scan speed for operators.

### Native multi-agent — when it still helps (Phase 2+ policy)

Only consider switching to **`grok-4.20-multi-agent`** for these narrow cases:

- Very open-ended synthesis after inputs are complete (e.g. “brainstorm five wildly different strategies given the same inputs”).
- Creative ideation phase before structured collection.
- When you want Grok to invent new question types dynamically (risky).

For the **core xStrategyBuilder loop** (collect → validate → synthesize → recommend), the **server-driven** approach stays superior: more reliable, cheaper, safer, and easier to audit. See [xChat Hardcore](#xchat-hardcore) and [atx-multi-agent.md](./xchat/atx-multi-agent.md).

---

## xChat Hardcore

**Phase 1 — shipped.** Strategy jobs, Spring **StrategyJobService**, Next BFF proxy, Redis/Mongo caps — [atx-multi-agent.md](./xchat/atx-multi-agent.md), [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md), release notes.

**Outstanding:** Observability hardening, audit/doc parity, strict JSON Schema artifact v2 — [Deferred (larger lifts)](#deferred-larger-lifts). Vision paste follow-ups — [Deferred product TODOs](#deferred-product-todos).


---

## TEAM-only xAI (legacy path removal)

**Goal:** Drop `userBootstrapCollectionId` and per-user bootstrap where policy is TEAM-only; anchor on `XAI_TEAM_ID` for team KB.

**Remaining:** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Stripe billing

**Closed for product MVP** (Checkout + entitlements + self-serve portal). Setup and ops: [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) · limits matrix: [atx-limits.txt.tsv](./resouces/atx-limits.txt.tsv).

**Shipped (app 2.10.22+):** Stripe webhooks, Checkout, Customer Portal, `stripeCustomerId`, plan gating via `getPlanLimits()` — see [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) and release notes.

**Deferred (not billing-blockers):** In-product usage meter / soft-limit banner on xChat — [current-state-features.md](./design-system/current-state-features.md).

---

## SRE / platform gaps

**Baseline:** BFF registry `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` + `tests/unit/bff-proxy-registry-next-handlers.test.ts`; JVM `./gradlew test` in `services/atxfinance-backend`; deploy: `.github/workflows/deploy-cloud-run.yml`, `AGENTS.md`.

### Deploy reliability (GH-first)

- Async `gcloud builds submit` + `gcloud builds describe` polling (avoid log-stream permission false failures).
- Fail only on terminal non-success; always print Build id + log URL.
- Post-deploy: staging custom domain + Cloud Run `status.url` must match app version (catch routing/cache drift).
- Fallback: `scripts/ops/deploy-cloud-run-from-env.sh`; prefer immutable image promotion when skipping rebuild.

### Test / doc follow-ups (conscious)

- `**POST /api/import/broker/clean`:** Documented in `**api-endpoints.md`** and [app-user import](./design-system/portfolio/app-user-import-activity.md); no dedicated route integration test yet (destructive — mock `**deleteAllPositionsForPortfolio`** + job/task deletes if added). **Partial `mappings` / row toggles:** covered by unit tests on `**validateBrokerImportMappings**` in `**app-broker-import-job.test.ts**`; full apply path remains integration-heavy (job + scheduled task).
- **Email/password:** unit tests **`password-crypto`**, **`auth-token-hash`**; approve-route integration uses mocks for invite/SMTP; audit actions **`credential_invite_email_failed`**, **`bootstrap_enqueue_failed`** documented in **`auth-and-access.md`** / **`current-state-features.md`** — no CI E2E against live SMTP.
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

