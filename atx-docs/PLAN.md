# Roadmap (forward work)

Living backlog for product, xChat, portfolio, JVM engine, and ops. **What is implemented today** (contracts, routes, shipped slices): [design-system/current-state-features.md](./design-system/current-state-features.md). **Release history:** [release-notes.md](./sre-ops/release-notes.md). Tenant provisioning narrative: [skill-tenant-roadmap](../.cursor/skills/skill-tenant-roadmap/SKILL.md), [tenant-specs/README.md](../tenant-specs/README.md).

**Docs index:** [README.md](./README.md) · **Product briefs:** [product/README.md](./product/README.md) · **GTM assets:** [xfinance-branding-review.md](./xchat/xfinance-branding-review.md) §9 · **Tenant UX:** [tenant-ux-plan.md](./design-system/tenant-ux-plan.md) · [tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md) · **xChat / multi-agent:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · **BFF / Spring:** [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · [mongo-next-write-boundary.md](./sre-ops/mongo-next-write-boundary.md) · [spring-read-plane-and-mongo-exit.md](./sre-ops/spring-read-plane-and-mongo-exit.md) · [bff-read-facade-latency-measurement.md](./sre-ops/bff-read-facade-latency-measurement.md) · [architecture/adr-002-read-facade-and-next-mongo-reads.md](./architecture/adr-002-read-facade-and-next-mongo-reads.md) · [staging-hnwi-soak-checklist.md](./sre-ops/staging-hnwi-soak-checklist.md) · **Strategy engine:** [xoptions/strategy-engine.md](./design-system/xoptions/strategy-engine.md) · **Scanners (Phase 3):** [scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md) · **IBKR:** [ibkr-automation.md](./design-system/ibkr-automation.md) · **NL workflows:** [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · **Deploy / secrets:** [guides/deploy-and-ops.md](./guides/deploy-and-ops.md)

---

## GTM

Visual asset refresh **v2** shipped with scanner tightening — proof captures indexed under **`public/marketing-screenshots/`** ([`xfinance-branding-review.md`](./xchat/xfinance-branding-review.md) §9).

---

<a id="shipped-platform-may-2026"></a>

## Shipped (May 2026 — platform / SRE)

- **Guest landing + 30-day trial (blast):** Role-aware **`/`** / **`/home`** (**`?for=hnwi|advisor`**) with **Start 30-Day Free Trial** → OAuth + **`xf_guest_trial_intent`**. First sign-in provisions **`operator`** + **`basic`** + **`trialEndsAt`** (30d) on **`core_users`**; limits = **basic** **`getPlanLimits()`** + tenant workspace row; post-trial **`trial_expired`** billing gate. **`src/modules/identity/guest-trial.ts`**, **`src/lib/marketing/guest-trial-auth.ts`**, **`src/proxy.ts`**. Docs: **`tenant-ux-plan.md`**, **`tenant-workspace-limits.md`**.

- **Hot Picks (portfolios workspace — track 12):** **`/portfolios/hot-picks`** — forward **7–21 DTE** scanner UI (bias, edge score, Greeks/IV skew toggles, glass cards, xOptions/alert/watchlist actions). **`GET /api/portfolios/hot-picks`** → Spring **`HotPicksService`** + **`OptionsStrategyEngine`** (conservative POP gate, no naked aggressive without **`optionsTradingEnabled`**); **60m** Redis cache; Next BFF + fallback. See **`current-state-features.md`** · **`release-notes.md`** **3.25.8**.

- **JVM internal scheduler daemon observability:** **`GET /api/backend/health`** returns a **`scheduler`** object (`lastPollAt`, `lastSuccessfulRun`, `tasksEnqueuedLastPoll`, `status`, …) so operators can confirm the admin-scheduler poller / Quartz path without relying on logs alone — [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md). (Earlier “today’s delivery focus” notes for the Spring internal admin scheduler lived in [release-notes.md](./sre-ops/release-notes.md) around **3.5.2**; capability is **shipped** in current worker images.)

### Hotfixes / incidents (May 2026)

- **Portfolio alerts + xAI narrative:** After adding a desk alert (example: **TSLA above $420** in a **Roth IRA** book), **`POST /api/portfolios/{portfolioId}/alerts/{alertId}/narrative`** may fail against **xAI Responses** with **`404 Not Found`** and an HTML body mentioning **`nginx`** or **Cloudflare challenge** scripts (upstream edge / bot interstitial, not our in-app “route missing” 404). **Mitigation:** treat as transient provider or egress/WAF behavior; retry narrative or surface **`503`** `narrative_unavailable`; verify **`XAI_API_KEY`** and that server-side calls reach **`api.x.ai`** without an HTML challenge page in the server path.

---

## Priority tracks

| ID | Track | Priority | Pointer / contract |
| -- | ----- | -------- | ------------------- |
| **10** | Multi-tenant provisioning & exports | Low | Bootstrap audit/replay, export jobs (`tenant_admin_export_jobs`, `tenant_export_worker`), YAML/CSV artifacts — details in [current-state-features.md](./design-system/current-state-features.md); ops: [tenant-specs/README.md](../tenant-specs/README.md) |
| **41** | AI Rental Platform | Medium | Admin rental keys + Stripe webhook paths: [rental-ai-platform.md](./sre-ops/rental-ai-platform.md); product UI checkout/embed flags |
| **200** | IBKR Client Portal | High | [ibkr-automation.md](./design-system/ibkr-automation.md); execution path before automated trades (**900**) |
| **704** | xMoney / crypto book (phased) | Medium | Full phased spec below: [xMoney & crypto portfolio (704)](#xmoney-crypto-704-roadmap) |
| **705** | App_user tasks — strategy handoff | Medium | Engine + scheduled jobs: [scheduled-task/user-tasks.md](./design-system/scheduled-task/user-tasks.md) |
| **706** | Tenant workspace automations | Medium | NL schedules, queue fairness, workspace limits — same user-tasks doc |
| **707** | **xChat harden** | High | Vision paste policy, metering refinements, artifacts/schema parity: [#xchat-harden](#xchat-harden) |
| **709** | **HNWI prompt_templates (admin)** | Low | Tenant-visible editor + audit for Mongo **`prompt_templates`** overrides (bodies ship via seed/API today): [#xchat-harden](#xchat-harden) |
| **708** | **Monte Carlo tail-risk** (`MonteCarloTailRiskEngine`) | High | **Open** — fat-tail sims, VaR/CVaR/drawdown stress, **`UserOptionsContext`** tier gates, Redis cache + quote circuit-break; companion to **`OptionsStrategyEngine`**: [#monte-carlo-tail-risk](#monte-carlo-tail-risk) · [strategy-engine.md](./design-system/xoptions/strategy-engine.md) |
| **710** | **Advisor compliance program** | High | **Phase 1 shipped** — advisor profile + AI disclosure ack + client profiles + API gates: [#advisor-compliance-program](#advisor-compliance-program) |
| **12** | **Portfolios Hot Picks** | High | **Shipped (May 2026)** — **`/portfolios/hot-picks`**, **`GET /api/portfolios/hot-picks`**, Kotlin **`HotPicksService`** — see [Shipped (May 2026 — platform / SRE)](#shipped-platform-may-2026) |
| **15** | **Quant Trader surface (xOptions)** | High | **Shipped (May 2026)** — `/xoptions?tab=quant`, `/xoptions/quant-trader`, step-4 sidebar toggle **Enable Quant Trader**, APIs **`GET /api/app-user/xoptions/quant-trader/context`** + **`POST …/run`**, strategy jobs **`jobType: monte-carlo-run`**, xChat handoff to **`quant-trader`** persona: [product-ux-spec.md](./design-system/xoptions/product-ux-spec.md) § Quant Trader · [xoptions-product-brief.md](./product/xoptions-product-brief.md) |
| **900** | Automated trades w/ verify | Low | After **200** + custodian execution maturity; until then alerts / manual |

**White-label / branding debt:** admin tenant branding preview, PWA manifest behavior — see [current-state-features.md](./design-system/current-state-features.md) (Tenant UX section). **Tenant UX (`tenant_ux`) V2:** removed from this backlog table after **May 2026** multi-role soak (global admin, tenant admin, app user); ongoing ops metrics/alerts remain in [tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md).

---

<a id="xchat-harden"></a>

## xChat harden

**Track:** **707**. Reliability, grounding, and parity across Next xChat modules and the JVM strategy pipeline. Ask latency follow-ups: [#xchat-latency-perf](#xchat-latency-perf).

**Shipped (May 2026):** canonical shared **Finance** xAI collection for all tenants (`XAI_FINANCE_COLLECTION_ID`); single-collection RAG on finance/options turns; admin **`POST /api/admin/rag/refresh-finance`** + **`npm run seed:finance-xai-collection`**; no per-persona Mongo **`xchat_rag_chunks`** duplication for options narratives. **Long-term xAI memory:** **`PUT /api/xchat/preferences`** persists **`enableLongTermXaiMemory`**; ask wires capped thread history into the Responses tool loop and optional **`store_messages` / `previous_response_id`** continuity. **BFF / JVM ask stream:** Spring **`POST /api/xchat/ask/stream`** — direct **`options_action_scan`** / **`watchlist_snapshot`**, xAI Responses tool loop, distributed usage limits, persona + RAG context, audit hooks, and Next-shaped SSE; Next BFF-forwards when the product gate is on (same as other portfolio/admin BFF routes); **`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** opts out to Next-only streaming — [xchat-bffparity.md](./sre-ops/xchat-bffparity.md), [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md). **HNWI Desk Report v2.1:** Mongo **`prompt_templates`**, **`GET /api/app-user/xchat/prompt-template-v21/{slug}`**, composer quick actions, optional **`hnwiPromptTemplateV21Slug`** on **`POST /api/xchat/ask`** — [hnwi-options-prompts-v2.1.md](./xchat/hnwi-options-prompts-v2.1.md) · [prompt-templates-schema.md](./sre-ops/prompt-templates-schema.md) (**≥3.19.6**).

- **Vision paste:** **Phase 2 complete (≥3.19.7)** — `sharp` pipeline, dual SHA-256, optional ClamAV, Mongo **`xchat_image_attachments`**, multi-image + auto-caption + HNWI directive + composer UX — [xchat-vision-paste.md](./xchat/xchat-vision-paste.md). **Remaining:** batch/admin harness parity; object-store retention for binaries (metadata-only today).
- **Limits & metering:** Optional plans-copy alignment with `getPlanLimits()` (meter + caps contract: [current-state-features.md](./design-system/current-state-features.md)).
- **Artifacts & audit:** Strict JSON Schema **v2** for strategy artifacts where multi-agent paths need parity ([atx-multi-agent.md](./xchat/atx-multi-agent.md)); regression guardrails + OpenAPI **`xchat`** inventory in `src/lib/openapi/current-state.ts`.

<a id="xchat-latency-perf"></a>

### xChat ask latency (Wheel / CC template — May 2026)

Shipped P0–P5 slices (eager workspace preload, outlook desk cache, session-tool copy, options_scan caches/guards, SSE default, plan tool-loop caps): [release-notes.md](./sre-ops/release-notes.md) **3.18.8**.

**Shipped (May 2026):** Options markdown for the shared Finance xAI KB is split **`atx-docs/rag-collection/options-strategy-core/**`** (lean) vs **`options-strategy-advanced/**`** (full playbooks), with **`atx-response-guidelines/**`** also uploaded on the same refresh. Persona disk scope: **`finance-advisor`** → core **`always_include` only**; **`advisor`** → advanced **`always_include` only** (core + advanced + response-guidelines segments upload on **`refresh-finance`** into one collection). Nested **`options-strategy/**`** remains Mongo seed for **`options_strategy`** — see [`atx-docs/README.md`](./README.md) § Options.

**Remaining work (priority score — higher = sooner):**

| Score | Item |
| ----- | ---- |
| **50** | **Monte Carlo tail-risk on preload** — env-gated skip or defer (`WORKSPACE_TAIL_RISK_*`, `workspace-snapshot-for-prompt.ts`). |

**Baseline (local):** ~51 s total ask; `tool_loop_total` ~51 s; local tools + Mongo **<4%** — xAI multi-turn dominates; re-profile after each slice.

---

<a id="engine-xai-conversational-layer"></a>

## Engine × xAI conversational layer (xChat / recommendations)

**Goal:** Every conversational turn can cite engine scores and RAG (e.g. `options-strategy-core` / `options-strategy-advanced` slug) instead of inventing structure.

| Area | Work |
| ---- | ---- |
| **Tool loop** | Feed Spring **`OptionsStrategyEngine.generateRecommendations()`** payload into `StrategyJobFinalizerService.kt` before artifact narration (xChat **`atx_function.strategy_recommendations`** + **`POST /api/strategy-recommendations/generate`** shipped — [release-notes.md](./sre-ops/release-notes.md) **3.18.8**). |
| **Rationale** | Enhance **`generateRationale()`** to call xAI for a personalized narrative grounded on engine facts, e.g. risk tolerance, portfolio delta, symbol outlook, theta/POP, and **RAG-sourced** macro context (FOMC / filings collections). |
| **Investment outlook model** | Add **`InvestmentOutlook`** (Java `recommendation/` package + Mongo): per-portfolio / per-account **bull / bear / neutral + conviction**; persist **thesis hash** for audit. Scanner jobs refresh outlook on earnings/material events. |
| **Tail-risk overlay** | **`MonteCarloTailRiskEngine`** outputs (VaR/CVaR, drawdown probabilities, stress paths) attached to **`StrategyRecommendation`** and xChat tool payloads — see [Monte Carlo tail-risk module](#monte-carlo-tail-risk). |
| **Validation** | Replay with existing demo chain + real positions (e.g. Fidelity CSV flows) to confirm engine + RAG citations dominate the reply skeleton. |

---

<a id="monte-carlo-tail-risk"></a>

## Monte Carlo tail-risk module (OptionsStrategyEngine companion)

**Track:** **708** (open). **Priority:** High — pairs with deterministic **`OptionsStrategyEngine`** and **[Investment outlook](#engine-xai-conversational-layer)** so scanners answer “what’s my book-level tail exposure?” not only “which structure fits?”

**Today:** JVM engine is **deterministic / rule-based** (speed + explainability) — [strategy-engine.md](./design-system/xoptions/strategy-engine.md).

**Add:** **`MonteCarloTailRiskEngine`** (new `@Component` under `services/atxfinance-backend/.../strategy/`) as a **companion** to **`OptionsStrategyEngine`**, driven off the same **`OptionChainSnapshot`** plus **portfolio holdings** (multi-leg aware).

| Area | Work |
| ---- | ---- |
| **Simulation** | **10k–50k paths** per run; prefer **fat-tail models** (**Student’s t** returns and/or **jump-diffusion**) over plain GBM so concentrated high-beta books (e.g. **RDW / CIFR / TSLA**-heavy portfolios) show realistic tail mass. |
| **Outputs** | **1D / 10D VaR**, **CVaR**, **P(drawdown > 20%)**, named **stress scenarios** (e.g. **2020 vol spike**, **correlation crush**). Serialize into engine DTOs for UI, jobs, and LLM grounding. |
| **Consumption** | Feed metrics into **`StrategyRecommendation.rationale`** (structured fields + text), **`generateRationale()`**, and xChat tool responses so narratives cite **quantified tail risk**, not vibes. |
| **Risk tier gates** | Integrate with existing **`UserOptionsContext`** risk tier: e.g. **conservative** caps **CVaR at 8%**; **aggressive** allows **~18%** when **hedge overlays** are present in the ranked recommendation set. |
| **Product story** | Scanner output becomes: **book-level tail exposure** + **concrete overlay** (conservative/balanced) that **materially reduces CVaR** (e.g. ~35% reduction) **while** still collecting defined premium — overlays ranked with the same fit-score discipline. |
| **Production** | **Cache** simulation summaries (or path seeds + aggregated stats) in **Redis** with **~5 min TTL** (reuse existing Redis wiring). **Circuit-break** Monte Carlo when **Yahoo** (or chain provider) latency/errors exceed thresholds so scheduled scans degrade gracefully. |

**Cross-links:** Portfolio **[`investment_outlook`](#portfolio-schema-multi-book-outlook)** and **`outlook_impact`** inform scenario weights; **[Scheduling / Yahoo](#scheduling-market-data-compliance-harness)** covers quote resilience.

---

<a id="portfolio-schema-multi-book-outlook"></a>

## Portfolio schema & multi-book outlook

**Goal:** Harden `portfolio_positions` / `tenant_portfolio` for HNWI multi-book tenants and engine hints.

| Area | Work |
| ---- | ---- |
| **`investment_outlook`** | Embedded doc per **account**: outlook enum, confidence, **thesis hash** (audit). Informs Monte Carlo scenario priors / correlation assumptions — [Monte Carlo tail-risk module](#monte-carlo-tail-risk). |
| **Risk parity** | Optional **weights across books** (e.g. 40% conservative wheel, 35% balanced iron condor, 25% aggressive event) — feeds aggregation + UI. |
| **`outlook_impact`** | Position-level score: **delta × IV rank × thesis alignment** (engine-consumable). |
| **Indexes** | Extend **`StrategyJobMongoIndexes.kt`** pattern: compound indexes for **`portfolioId`**, **`riskTier`**, outlook-led queries — target **50+ portfolios per tenant** without table scans. |
| **CSV import** | Next **`portfolio-import`** (Fidelity/Merrill): robust **short vs long** detection (e.g. VELO put misclassification), **`side: SHORT`**, **premium collected YTD** tags → **`portfolioDeltaHint`** into engine context. |
| **Service** | **`PortfolioOutlookService`** (JVM or Next domain layer): aggregate outlook across accounts; inject into **`/portfolios`** workspace rail + xChat workspace preload. |

---

<a id="advisor-compliance-program"></a>

## Advisor compliance program (IA / advisor role)

**Track:** **710**. **Goal:** Technology-provider posture for licensed Investment Advisors — collect suitability context, disclose AI limitations, and maintain auditable records before advice-like outputs. ATX remains **not** a registered investment adviser; the advisor/firm retains suitability and client disclosure obligations.

**Positioning:** Each **tenant = one IA firm** (`core_tenants.name`). Tenant users are **`operator`** or **`advisor`** (a tenant may have zero advisors). **Only `advisor`** completes disclosure gates before **`POST /api/xchat/ask`** and Quant Trader run. **FINRA/SEC credential upload** is gated by tenant feature flag **`credential-sec`** (default **off** — no regulatory UI until productized; see `.cursor/rules/xfinance-branding.mdc`).

### Shipped — Phase 1 (foundation & gates)

| Area | Detail |
| ---- | ------ |
| **IA firm** | Firm identity = **tenant name** (one IA firm per tenant). |
| **Advisor acks** | Mongo **`core_users.advisorComplianceProfile`**: optional CCO email, attestation + versioned AI disclosure ack. |
| **FINRA CRUD** | Mongo **`advisor_finra_registrations`**: CRD, license type, jurisdiction, evidence URL, status — **`GET|POST /api/app-user/compliance/finra-registrations`**, **`PATCH|DELETE …/{id}`**. |
| **APIs** | **`GET /api/app-user/compliance/status`**, **`…/disclosures`**, **`PUT …/advisor-profile`** (acks). |
| **UI** | **`/account/workspace-preferences`** (profile menu) — appearance + advisor FINRA/disclosure; **`/account/compliance`** redirects. |
| **Gates** | Incomplete advisor compliance → **403** `advisor_compliance_required` (advisor role only). |
| **Audit** | `advisor_compliance_ack_updated`, `advisor_finra_registration_*`. |
| **Advice archive (advisor role)** | Mongo **`advisor_advice_events`** — compliance copy of system-generated advice/rationale/reports/alerts/narratives for **`advisor`** users only (not `operator`/`viewer`; `global_admin` excluded). Module: **`src/modules/compliance/advisor-advice-events.ts`**. Wired surfaces: **`POST /api/xchat/ask`** (incl. direct scan/MC/watchlist paths), **`POST /api/app-user/xoptions/quant-trader/run`**, **`GET /api/app-user/xoptions/review`**, **`POST /api/xoptions/wheel/generate`**, **`POST …/alerts/{id}/narrative`**, **`GET /api/portfolios/desk-wellness-brief`**, **`PATCH …/watchlist`** (saved rationales), **`POST /api/reports/options-scan`** (PDF report rows), scheduled **`watchlist_price_scanner`** + **`options_scanner`** (Grok rationale, recommendation notes, portfolio alerts), watchlist price-move alerts. **`GET /api/app-user/compliance/report/export`** includes **`adviceEventCount`**. User purge deletes **`advisor_advice_events`**. |

### Phase 2 — In-product enforcement (~weeks 5–8)

| Area | Work |
| ---- | ---- |
| **Suitability gate** | Block strategy jobs, desk reports with trade ideas, and xOptions apply flows when linked client profile is missing or stale (>12 months). Reuse **`xchat-strategy-job-preflight`** pattern. |
| **AI transparency** | Persistent xChat chip: **AI-assisted · persona · model family**; first-thread expanded disclosure; export includes model metadata from **`xchat_logs`**. |
| **Advice archive v2** | Extend **`advisor_advice_events`** with client profile id, suitability snapshot hash, CCO export UI, and retention policy (no TTL today). **`POST /api/xchat/batch`** (admin) only if product requires advisor-visible batch runs. |

### Phase 3 — Compliance program (operational ~weeks 9–12)

| Area | Work |
| ---- | ---- |
| **`compliance` scheduled task** | Replace stub in **`task-runner.ts`**: stale suitability profiles, threads with strategy language but no client link, weekly CCO digest (email templates). |
| **Admin compliance console** | Tenant-scoped dashboard: suitability completion, disclosure log, CSV/JSON export for exams. |
| **Sales / legal enablement** | Technology-provider one-pager, sample firm WSP addendum language, Form ADV Item 12 / Reg BI **templates** (firm-adapted, not legal advice from ATX). |
| **Credential verification** | Productize FINRA/SEC credential upload behind **`credential-sec`** (default off; Admin → Tenant preferences → Feature flags). **Credential upload = roadmap only per May 2026 gap closure. No fake regulatory UI permitted.** Replace legacy admin placeholder URL field; optional CRD lookup integration. |

**Cross-links:** [auth-and-access.md](./guides/auth-and-access.md) · route catalog **`account_workspace_preferences`** in **`data/platform/app-user-route-catalog.json`** · [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md).

---

<a id="scheduling-market-data-compliance-harness"></a>

## Scheduling, market data & compliance harness

**Goal:** Safer multi-tenant scheduling, observable engine behavior, resilient quotes, auditable backtests.

| Area | Work |
| ---- | ---- |
| **`options_scanner`** | Per-tenant **rate limits** + **kill-switch** in scheduling layer (Phase 3 baseline already in repo — extend governance). |
| **Metrics** | Expose engine distributions (score histograms, avg POP by tier) via **Micrometer** → Grafana dashboards for ops. |
| **Yahoo client** | `StrategyOptionsYahooClient.kt`: **retry/backoff**; on sustained rate limit, **fallback to IBKR snapshot** where entitled. |
| **Backtesting** | **`StrategyBacktestService`**: replay historical chains vs engine recommendations; persist results in **`strategy_backtests`** collection for audit/compliance. |
| **CI** | Speed: **cache ESLint**, lint **changed files** on PRs; **parallelize** Vitest and `./gradlew test` in CI graph. |

---

## NL and strategy preflight

**Spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

Follow-ups: scanner threshold tuning; alert ergonomics across `watchlist_price_scanner`, `user_alert_manager`, `/portfolio/alerts`.

---

## Design and UX roadmap

**Audience:** Operator scan speed + trust surfaces.

- **Wheel strategy visual** — Accessible motion for wheel/income story; `prefers-reduced-motion`.
- **Onboarding** — Staggered admin xPersona / core-admin flows.
- **xChat thread UX** — Short replies: toolbar actions, collapsible prior turns, sticky composer (TanStack Virtual–friendly); optional persisted **`collapsedPrevious`** (schema TBD).
- **Light-theme token pass** — `atxfinance-brand-kit.css` + `xf_ui_theme` / soft density for workspace + composer.

### Native multi-agent — when it helps (policy)

Use **`grok-4.20-multi-agent`** only for narrow cases (open-ended synthesis, ideation before structured collection, experimental question generation). Core **xOptions** / strategy-job loop stays server-driven — [atx-multi-agent.md](./xchat/atx-multi-agent.md).

---

## Deferred product TODOs

- Watchlist quote freshness: background cadence + last-updated + stale badge.
- **Options scan share/report:** watermark/recipient banner for `/reports/scan/{token}`, signed-download audit, configurable TTL beyond default 24h.
- **Edit Account → scanner thresholds:** Row binding to price-alert service, scheduled thresholds from desk fields, option marks when chain data wired — [portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md). **Shipped (May 2026):** per-position **Desk** row actions (alert · options chain drawer · xChat) on holdings — option **marks** in the Holdings table remain backlog.
- **RAG isolation hardening** — Add **`XAI_FINANCE_CORE_COLLECTION_ID`** + **`XAI_FINANCE_ADVANCED_COLLECTION_ID`**, update **`refresh-finance`** / Finance seed to upload into the matching collections, and rely on **admin persona → collection** linking in console (post-deploy). Pursue if **`finance-advisor`** does not consistently meet **&lt;2.5s p95** once operators have linked personas and you have measured ask latency in prod/staging.

### Desk email & delivery

Desk SMTP on Next; tenant delivery channels not BFF-proxied — [deploy-and-ops.md](./guides/deploy-and-ops.md). Outstanding: SMS/push channel kinds; credential invite + password reset paths when SMTP mounted on JVM (`PUBLIC_APP_BASE_URL`).

---

## Stripe billing

Usage meter / soft limits / billing UI contracts: [current-state-features.md](./design-system/current-state-features.md). Test gaps (access-requests happy path, BillingGuestExperience E2E): track when touching billing.

---

<a id="xmoney-crypto-704-roadmap"></a>

## xMoney & crypto portfolio (704) — technical integration roadmap

Phased delivery with zero downtime for Stripe subscribers; additive X Money routes and flags.

### Phase 0 — Billing via X Money (~1 week target; depends on API access)

**Goal:** X Money as parallel checkout alongside Stripe ([stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) boundaries).


| Workstream | Detail |
| ---------- | ------ |
| **Provider abstraction** | Internal interface (`createSubscriptionCheckout`, `verifyWebhook`, `mapExternalPlanToAtxTier`); Stripe first; X Money via [docs.xmoney.com/api/reference](https://docs.xmoney.com/api/reference). |
| **Webhooks** | e.g. `POST /api/webhooks/xmoney` — signature, idempotency, lifecycle handlers mapped to same entitlement paths as Stripe. |
| **Mongo / `core_users`** | `payment_provider`: `stripe` \| … |
| **UI** | `/account/billing`: second CTA when configured; wallet deep-link per X Money docs. |
| **Portal parity** | Document cancel / PM management vs Stripe portal for mixed-provider tenants. |

**Zero-downtime:** No forced migration of `stripeCustomerId`; feature flag + optional tenant allowlist.

### Phase 1 — Crypto in portfolio DB & UI (~2–3 weeks after Phase 0)


| Workstream | Detail |
| ---------- | ------ |
| **Schema** | `tenant_portfolio`, `portfolio_accounts`, `portfolio_positions`: `asset_type`, crypto-compatible fields. |
| **Quotes** | find-options / workspace-pulse: Yahoo + IBKR where consented. |
| **IBKR** | Extend snapshot ingestion for crypto balances when CP exposes them. |
| **UI** | Consolidated holdings: exposure/risk columns; N/A Greeks for spot crypto. |

### Phase 2 — xAI crypto strategies & alerts (~3–4 weeks after Phase 1)


| Workstream | Detail |
| ---------- | ------ |
| **Engine + scanners** | Crypto rule templates; desk-safe defaults — [strategy-engine.md](./design-system/xoptions/strategy-engine.md). |
| **Alerts** | Portfolio alert UX: crypto category + xAI narrative block. |
| **xOptions** | Payoff charts for listed crypto options where entitled; flag exotic venues. |
| **Cross-asset alerts** | Concentration across asset classes from Phase 1 marks. |

### Phase 3 — X Money wallet sync (optional)


| Workstream | Detail |
| ---------- | ------ |
| **Read path** | Balance/activity into summary; cache + rate limits; graceful degrade. |
| **Write / settlement** | Opt-in per tenant; kill switch; only when executor supports flow. |
| **Audit** | `correlationId` + `admin_audit_events` — [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md). |

### Tests & docs (704)

**Existing:** Stripe/unit/integration tests listed historically in repo — extend when adding X Money.

**Gaps when implementing:** Mocked checkout happy paths; X Money webhook fixtures + idempotency; dual-provider isolation tests; optional staging E2E; Phase 2 scanner/alert/payoff tests with mocked market data; Phase 3 wallet client fixtures + audit assertions.

**Docs:** Extend `api-endpoints.md`, `deploy-and-ops.md`, `payment-audit-checklist.md`, `auth-and-access.md` / billing data model; OpenAPI registration for new routes.

---

## SRE / platform

**Baseline:** `src/lib/bff-proxy-routes.ts`, `services/atxfinance-backend` `./gradlew test`, `deploy-cloud-run.yml`, `AGENTS.md`.

### GKE scale-out (future)

Cloud Run canonical until sustained load warrants cluster cost — [k8s-deploy.md](./sre-ops/k8s-deploy.md), `deploy/k8s/`.

### Deploy reliability (GH-first)

Async Cloud Build polling; fail on terminal non-success; post-deploy version/domain checks; `deploy-cloud-run-from-env.sh` fallback.

### Test / doc follow-ups

Broker import `POST /api/import/broker/clean`: [api-endpoints.md](./guides/api-endpoints.md), [app-user-import](./design-system/portfolio/app-user-import-activity.md). Email/password + credential invite: unit/integration with mocked SMTP — see [auth-and-access.md](./guides/auth-and-access.md).

### BFF / consolidation

xChat routes, persona governance, and some admin mutations remain on Next until registry parity — [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md). **Next → Mongo write rule** (ESLint + allowlist): [mongo-next-write-boundary.md](./sre-ops/mongo-next-write-boundary.md). **Short-term:** move writes for **`portfolio_positions`**, watchlist, **`admin_scheduled_tasks`**, **`xchat_user_preferences`**, **`strategy_jobs`** to Spring; keep hot **GET** reads on Next until migrated.

**xChat ask stream:** JVM parity shipped; BFF follows the main **`ATXFINANCE_BACKEND_ORIGIN`** gate; **`XCHAT_SSE_PROXY_BACKEND`** is an ops **opt-out** to keep SSE on Next — [xchat-bffparity.md](./sre-ops/xchat-bffparity.md). Workspace snapshot Redis + JVM **`GET /api/portfolios/{id}/snapshot`**: [current-state-features.md](./design-system/current-state-features.md).

**Ops:** `ATXFINANCE_BACKEND_ORIGIN` = backend HTTPS origin when Spring enabled — [deploy-and-ops.md](./guides/deploy-and-ops.md). **Shipped:** backend **`scheduler`** block on **`GET /api/backend/health`** (see [Shipped (May 2026 — platform / SRE)](#shipped-platform-may-2026) above).

---

## Deferred (larger lifts)

- **Strict JSON Schema strategy artifacts v2** — until schema work lands; v1 Markdown + fenced JSON remains canonical.
