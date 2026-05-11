# Roadmap (forward work)

Living backlog for product, xChat, portfolio, JVM engine, and ops. **What is implemented today** (contracts, routes, shipped slices): [design-system/current-state-features.md](./design-system/current-state-features.md). **Release history:** [release-notes.md](./sre-ops/release-notes.md). Tenant provisioning narrative: [skill-tenant-roadmap](../.cursor/skills/skill-tenant-roadmap/SKILL.md), [tenant-specs/README.md](../tenant-specs/README.md).

**Docs index:** [README.md](./README.md) · **Tenant UX:** [tenant-ux-plan.md](./design-system/tenant-ux-plan.md) · [tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md) · **xChat / multi-agent:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · **BFF / Spring:** [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · **Strategy engine:** [xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · **Scanners (Phase 3):** [scheduled-task/scanners-phase3-plan.md](./design-system/scheduled-task/scanners-phase3-plan.md) · **IBKR:** [ibkr-automation.md](./design-system/ibkr-automation.md) · **NL workflows:** [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · **Deploy / secrets:** [guides/deploy-and-ops.md](./guides/deploy-and-ops.md)

---

## Priority tracks

| ID | Track | Pointer / contract |
| -- | ----- | ------------------- |
| **10** | Multi-tenant provisioning & exports | Bootstrap audit/replay, export jobs (`tenant_admin_export_jobs`, `tenant_export_worker`), YAML/CSV artifacts — details in [current-state-features.md](./design-system/current-state-features.md); ops: [tenant-specs/README.md](../tenant-specs/README.md) |
| **11** | Tenant UX (`tenant_ux`) V2 | Feature set in-repo; ops soak + metrics: [tenant-ux-enforcement.md](./sre-ops/tenant-ux-enforcement.md) |
| **41** | AI Rental Platform | Admin rental keys + Stripe webhook paths: [rental-ai-platform.md](./sre-ops/rental-ai-platform.md); product UI checkout/embed flags |
| **200** | IBKR Client Portal | [ibkr-automation.md](./design-system/ibkr-automation.md); execution path before automated trades (**900**) |
| **704** | xMoney / crypto book (phased) | Full phased spec below: [xMoney & crypto portfolio (704)](#xmoney-crypto-704-roadmap) |
| **705** | App_user tasks — strategy handoff | Engine + scheduled jobs: [scheduled-task/user-tasks.md](./design-system/scheduled-task/user-tasks.md) |
| **706** | Tenant workspace automations | NL schedules, queue fairness, workspace limits — same user-tasks doc |
| **707** | **xChat harden** | **Partial shipped** — Spring-authoritative engine recommendation tool bridge + TEAM KB docs aligned; open: vision paste policy, metering refinements, JVM ask ownership, artifacts/schema parity: [#xchat-harden](#xchat-harden) |
| **708** | **Monte Carlo tail-risk** (`MonteCarloTailRiskEngine`) | **Open** — fat-tail sims, VaR/CVaR/drawdown stress, **`UserOptionsContext`** tier gates, Redis cache + quote circuit-break; companion to **`OptionsStrategyEngine`**: [#monte-carlo-tail-risk](#monte-carlo-tail-risk) · [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) |
| **900** | Automated trades w/ verify | After **200** + custodian execution maturity; until then alerts / manual |

**White-label / branding debt:** admin tenant branding preview, PWA manifest behavior — see [current-state-features.md](./design-system/current-state-features.md) (Tenant UX section).

---

<a id="xchat-harden"></a>

## xChat harden

**Track:** **707** (partial shipped). Umbrella for reliability, grounding, and parity across Next xChat modules and the JVM strategy pipeline. Latency backlog (Wheel/CC baseline, P0 slices): [#xchat-latency-perf](#xchat-latency-perf).

- **Engine-grounded tools:** **Shipped v1** — Next xChat `atx_function.strategy_recommendations` validates symbols/outlook/risk/horizon, forwards the signed session to Spring **`POST /api/strategy-recommendations/generate`**, and narrates structured **`OptionsStrategyEngine.generateRecommendations()`** JSON instead of inventing legs/scores. Next remains ask/SSE owner; Spring owns the deterministic engine contract.
- **Vision paste:** Policy (scan bounds, EXIF strip, optional max dimensions), batch/admin harness parity — backlog detail in [Deferred product TODOs](#deferred-product-todos).
- **Limits & metering:** In-product usage meter and prompt limits — contract in [current-state-features.md](./design-system/current-state-features.md); optional plans-copy alignment with `getPlanLimits()`.
- **BFF / JVM ask:** Engine recommendation endpoint is Spring-authoritative; full JVM-authoritative streaming and tool loop remain deferred — [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md), [Deferred (larger lifts)](#deferred-larger-lifts).
- **Artifacts & audit:** Strict JSON Schema **v2** for strategy artifacts where multi-agent paths need parity ([atx-multi-agent.md](./xchat/atx-multi-agent.md)); regression guardrails + OpenAPI **`xchat`** inventory in `src/lib/openapi/current-state.ts`.
- **TEAM-only xAI path:** **Docs aligned** — ask/batch grounding stays persona-declared TEAM collection IDs only (`xaiCollection`, `teamCollection`, tool `collection_ids`; max 2); no env-team default auto-merge into runtime ask.

<a id="xchat-latency-perf"></a>

### xChat ask latency (Wheel / CC template — May 2026)

**P0 shipped:** `shouldEagerWorkspaceSnapshotPreloadForMessage` (`src/modules/xchat/xchat-ask-routing.ts`) gates eager `loadWorkspaceSnapshotPreload` in parallel with RAG when prompts mention holdings + watchlist (`from holdings`, etc.) and/or **book cues + income/options cues** (wheel ideas, covered call, CSP, options scan — excludes basic “what is a covered call?” stubs and watchlist add/remove). First-turn `atx_function` hits `PRELOAD_SHORT_CIRCUIT_OPS` instead of lazy Mongo. **xAI prompt cache key** — `xf-xchat:{threadSlice}:{personaHex}` (≤256 chars) so persona switches do not reuse cached `instructions` bytes.

**P1–P5 shipped (May 2026):** **Conditional `atx_function` session copy** — `classifyXchatSessionToolCopyMode` + **full** vs **slim** `buildSessionToolInstructions` (batch stays **full** default). **Preload hint** — `buildWorkspacePreloadHintForSystemPrompt` when eager workspace prefetch runs (compact vs full JSON snapshot). **`options_scan` in-memory cache** — `tool-cache.ts`, ~60 s TTL, key `symbol + filters`. **SSE default on** — `NEXT_PUBLIC_XCHAT_LIVE_SSE` unset → live stream enabled; `0/false/no/off` disables. **`clampToolLoopMaxTurnsForSession`** — plan-tier cap on tool-loop turns (`ask/route.ts`).

**Executor guards + Redis options_scan shipped (May 2026):** **`options-scan-redis-cache.ts`** — Redis `cache` plane with in-memory fallback, TTL via `REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS` (default 60 s, clamped 5–600), key `xf:xchat:options_scan:v1:{sha256(symbol+filters)}`. **Per-request dedup** — `tool-executor.ts` memoizes identical `op:argsHash` calls inside one ask so model retries return instantly. **Empty-book covered-call guard** — `options_scan` with `optionType: "call"` (or CC/wheel intent) on a portfolio with `totalPositionCount === 0` returns `error: empty_book_for_covered_call` instead of running Yahoo (~10–15 s per avoided turn).

**Remaining work (priority score — higher = sooner):**

| Score | Item |
| ----- | ---- |
| **50** | **Monte Carlo tail-risk on preload** — env-gated skip or defer (`WORKSPACE_TAIL_RISK_*`, `workspace-snapshot-for-prompt.ts`). |

**Baseline (local):** ~51 s total ask; `tool_loop_total` ~51 s; local tools + Mongo **<4%** — xAI multi-turn dominates; re-profile after each slice.

---

<a id="engine-xai-conversational-layer"></a>

## Engine × xAI conversational layer (xChat / recommendations)

**Goal:** Every conversational turn can cite engine scores and RAG (e.g. options-strategy slug) instead of inventing structure.

| Area | Work |
| ---- | ---- |
| **Tool loop** | **Shipped v1:** Next `src/modules/xchat/**` exposes **`atx_function.strategy_recommendations`**; Spring `StrategyRecommendationService` returns structured recommendation JSON from **`generateRecommendations()`** via **`POST /api/strategy-recommendations/generate`**. Remaining: feed the same engine payload into `StrategyJobFinalizerService.kt` before artifact narration. |
| **Rationale** | Enhance **`generateRationale()`** to call xAI for a personalized narrative grounded on engine facts, e.g. risk tolerance, portfolio delta, symbol outlook, theta/POP, and **RAG-sourced** macro context (FOMC / filings collections). |
| **Investment outlook model** | Add **`InvestmentOutlook`** (Java `recommendation/` package + Mongo): per-portfolio / per-account **bull / bear / neutral + conviction**; persist **thesis hash** for audit. Scanner jobs refresh outlook on earnings/material events. |
| **Tail-risk overlay** | **`MonteCarloTailRiskEngine`** outputs (VaR/CVaR, drawdown probabilities, stress paths) attached to **`StrategyRecommendation`** and xChat tool payloads — see [Monte Carlo tail-risk module](#monte-carlo-tail-risk). |
| **Validation** | Replay with existing demo chain + real positions (e.g. Fidelity CSV flows) to confirm engine + RAG citations dominate the reply skeleton. |

---

<a id="monte-carlo-tail-risk"></a>

## Monte Carlo tail-risk module (OptionsStrategyEngine companion)

**Track:** **708** (open). **Priority:** High — pairs with deterministic **`OptionsStrategyEngine`** and **[Investment outlook](#engine-xai-conversational-layer)** so scanners answer “what’s my book-level tail exposure?” not only “which structure fits?”

**Today:** JVM engine is **deterministic / rule-based** (speed + explainability) — [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md).

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

Use **`grok-4.20-multi-agent`** only for narrow cases (open-ended synthesis, ideation before structured collection, experimental question generation). Core **xStrategyBuilder** loop stays server-driven — [atx-multi-agent.md](./xchat/atx-multi-agent.md).

---

## Deferred product TODOs

- Watchlist quote freshness: background cadence + last-updated + stale badge.
- **Options scan share/report:** watermark/recipient banner for `/reports/scan/{token}`, signed-download audit, configurable TTL beyond default 24h.
- **Edit Account → scanner thresholds:** Row binding to price-alert service, scheduled thresholds from desk fields, option marks when chain data wired — [portfolio-edit-account-consolidated-holdings.md](./design-system/portfolio-edit-account-consolidated-holdings.md).

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
| **Engine + scanners** | Crypto rule templates; desk-safe defaults — [strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md). |
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

Portfolio workspace snapshots: Redis + optional JVM `GET /api/portfolios/{id}/snapshot` — [current-state-features.md](./design-system/current-state-features.md). xChat routes, persona governance, some admin mutations remain Next until registry parity — [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).

**Ops:** `ATXFINANCE_BACKEND_ORIGIN` = backend HTTPS origin when Spring enabled — [deploy-and-ops.md](./guides/deploy-and-ops.md).

---

## Deferred (larger lifts)

- **JVM-authoritative xChat streaming + tool loop** — [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- **Strict JSON Schema strategy artifacts v2** — until schema work lands; v1 Markdown + fenced JSON remains canonical.
