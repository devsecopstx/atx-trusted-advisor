# xFinance monorepo — technical architecture & current state

Last updated: 2026-05-07  
App semver (canonical): root **`package.json`** (currently **3.16.1**; runtime label via `src/lib/app-version.ts` → **`APP_VERSION`** reads the same semver).

This file is the **single consolidated technical architecture** reference for the monorepo: runtime topology, responsibilities, shipped product surfaces, CI/test matrix, pre-production gates, and **known gaps**. Topic deep dives stay in linked **`atx-docs/*`** pages; **open backlog only** in [`PLAN.md`](../PLAN.md). **PR and production readiness** align with [`.cursor/agents/reviewer.md`](../../.cursor/agents/reviewer.md): contracts, OpenAPI parity, perf evidence on hot UI paths, Secret Manager / deploy docs when OAuth, BFF, or SMTP paths change, and **this doc** (or `PLAN.md`) when the shipped stack or consolidated gaps move.

---

## Tech stack quick reference (canonical)

Values below track **`package.json`** and **`services/atxfinance-backend/gradle/libs.versions.toml`** / **`build.gradle.kts`**.

| Layer | Stack |
|--------|--------|
| **Frontend (core app)** | **Next.js 16.x** (App Router), **React 19.2.x**, **TypeScript 5.9.x**, **Tailwind CSS 3.4.x**, **ESLint 9.x** + `eslint-config-next` |
| **UI / data viz** | **ApexCharts 5.x** + `react-apexcharts`, **Framer Motion**, **TanStack React Virtual**, **react-markdown** + **rehype-sanitize** / **remark-gfm** |
| **Next runtime libs** | **MongoDB** Node driver **7.x**, **Zod 4.x**, **Stripe** SDK **17.x**, **yahoo-finance2** **3.14.x** (batch/single quote paths use **`yahooQuoteWithValidationFallback`** when schema validation fails), **nodemailer** **8.x** (desk SMTP + credential-invite / reset mail), optional **redis** client **4.x**, **@google-cloud/pubsub** **4.x**, **yaml**, **cronstrue** / **rrule** |
| **API docs (Next)** | **swagger-ui-react** / **swagger-ui-dist** **5.32.x** — admin **`/admin/api-docs`** backed by **`GET /api/openapi`** |
| **Tests (Next)** | **Vitest 3.2.x**, **tsx**; integration + OpenAPI parity under **`tests/integration/**`** |
| **Backend worker** | **Spring Boot 3.3.4**, **Kotlin 1.9.25**, **JDK 21**; **Spring Data MongoDB** + **Redis** starters; **SpringDoc OpenAPI 2.6.x** (**`/swagger-ui.html`**); **ShedLock 5.13.x** (Mongo provider); **Micrometer** + **OTLP** optional; **Angus Mail** (desk SMTP parity); tests use **embedded Mongo** |
| **Deploy / data plane** | **GCP Cloud Run** (two services: Next + JVM); **MongoDB** (shared); optional **Redis** (e.g. Memorystore); **GCP Secret Manager**; optional **Google Pub/Sub** |

---

## Technical architecture (consolidated)

**Production shape:** two primary deployables on **GCP Cloud Run** — the **Next.js** core app (UI + most `/api/*` route handlers + BFF) and **`atxfinance-backend`** (Kotlin/Spring worker with HTTP parity for migrated slices). Both share **one MongoDB** (tenant data, portfolios, personas, jobs, audit, xChat history when opted in). Optional **Redis** (strategy-job hourly caps, future cache), **Google Pub/Sub** (recommendation events when configured), **Stripe** (billing webhooks + Checkout on Next), and **xAI** (chat + management APIs from Next).

**Cloud Run prod sizing (operator baseline):** **Next** — 1 vCPU, 1Gi, concurrency 100, min 1 / max 50, CPU boost on; **Spring** — 1 vCPU, 1Gi, concurrency 80, min 0 / max 30, CPU boost on. Tables + `gcloud` examples: **`atx-docs/sre-ops/gcp-prod-two-service-model.md`**.

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser[Browser / PWA]
  end
  subgraph cr [Cloud Run]
    Next[Next.js core app]
    Spring[atxfinance-backend JVM]
  end
  subgraph external [External services]
    Mongo[(MongoDB)]
    xAI[xAI API]
    Yahoo[Yahoo Finance quotes]
    Stripe[Stripe]
    Redis[(Redis optional)]
    PS[Pub/Sub optional]
    IBKR[IBKR Client Portal optional]
  end
  Browser -->|HTTPS same-origin / session cookie| Next
  Next -->|BFF when ATXFINANCE_BACKEND_ORIGIN set| Spring
  Next --> Mongo
  Next --> xAI
  Next --> Stripe
  Next --> Yahoo
  Next --> IBKR
  Spring --> Mongo
  Spring --> Yahoo
  Spring --> Redis
  Spring --> PS
```

| Layer | Primary responsibilities |
|--------|---------------------------|
| **Next.js (App Router)** | Product UI; **edge** auth/guest gating in **`src/proxy.ts`**; signed session **`xf_core_session`**; **xChat** (`/api/xchat/*`) + xAI **Responses** tool-loop (**optional live token SSE** on **`POST /api/xchat/ask`** when `Accept: text/event-stream`, **`POST /api/xchat/ask/stream`**, UI gated by **`NEXT_PUBLIC_XCHAT_LIVE_SSE`**); **Rental AI** (`/api/ai/rent/*`) — Bearer keys on **`core_tenants.apiKeys`**, **`POST /chat`** (JSON + SSE) via xChat tool-loop, **`strategy`** / **`analyze`** **`POST`→202** + **`GET`** poll (**`rental_ai_jobs`**), token metering + **`x-rental-tokens-*`** headers — **`atx-docs/sre-ops/rental-ai-platform.md`**; **OpenAPI** inventory (**`current-state.ts`** + **`current-state-overrides.ts`**) + admin Swagger; **Stripe** Checkout/webhooks/portal; **desk SMTP** (`nodemailer`) for portfolio email, admin delivery-channel **Send test**, **credential-invite / password-reset** mail (**≥3.12.7:** admin **`POST /api/admin/users/{userId}/resend-credential-invite`** + Manage users **Resend invite**); **BFF** forwarding per [`bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) when **`ATXFINANCE_BACKEND_ORIGIN`** points at the Spring **HTTPS** origin |
| **Spring (`atxfinance-backend`)** | **ShedLock**-backed schedulers; **strategy jobs** orchestration + HTTP; Yahoo-backed **strategy-options** and related paths when proxied; admin/portfolio/RAG slices per **[`atxfinance-backend-http-api.md`](../sre-ops/atxfinance-backend-http-api.md)**; optional **recommendation** Pub/Sub publisher; **session** cookie parse aligned with Next; **`CredentialInviteService`** when BFF proxies access-request **approve** (Mongo invite fields + **DeskSmtpSender**) |
| **MongoDB** | System of record: tenants (**optional `rentalProfile` / **`apiKeys`** / `rentalExpiresAt`** for white-label rental API), users, portfolios, watchlists, personas, **`strategy_jobs`**, **`options_strategy_preferences`**, **`admin_*`**, **`xchat_logs`** (when user opts in), **`xchat_usage_limits`** (per-user minute / optional UTC hour / UTC day counters for `POST /api/xchat/ask` plus **`rentalTokensUsed`** buckets for rental metering), **`rental_ai_token_usage`**, **`rental_ai_jobs`**, IBKR consent rows, etc. |
| **Redis** | Optional: strategy-job rate cap when **`REDIS_URL`** set; JVM **`GET /api/portfolios/{portfolioId}/snapshot`** is the **canonical fast-path** for hot reads of materialized workspace preload (**`xf:wsnap:v1:*`**, same keys as Next) with market-window TTL and **`data.structured`** for holdings/balances/watchlist quote strip. Next **`loadWorkspaceSnapshotPreload`** / **`GET /api/app-user/find-options/bootstrap`** call JVM after local Redis miss when **`ATXFINANCE_BACKEND_ORIGIN`** is set; unset origin ⇒ Mongo materialization + Next Redis only — see **[`spring-redis-memorystore.md`](../sre-ops/spring-redis-memorystore.md)** |

**Auth (today):** **X (Twitter) OAuth** on **Next** (`/api/auth/x/*`). **Sign in with Google** is **optional** when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set (`/api/auth/google/*`, see **`src/lib/env.ts`** / **`isGoogleOAuthConfigured`**). **Email + password** (**app ≥3.6.17**): `POST /api/auth/email/login`, **complete-invite** / **forgot-password** / **reset-password**; `core_users.passwordHash` (scrypt), invite/reset token hashes; sessions without **`xUserId`** when email-only; **`/login`** surfaces OAuth-first + email form (`src/app/login/`). Post-approve invite email: **Next** handler orders invite before xAI bootstrap; **Spring** **`CredentialInviteService`** when admin approve is BFF-proxied — **`PUBLIC_APP_BASE_URL`** + SMTP on the sending service. Cutover toward Spring as authority is **planned** with dual-run — **[`api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md)** and **canonical live path table** in [`.cursor/plans/shared-context.md`](../../.cursor/plans/shared-context.md).

**BFF / consolidation:** Not every `/api/*` route is proxied. **Next-only** examples: **`/api/xchat/*`** (**`/v1/responses`** tool-loop + optional **SSE** streaming + tools on Next; see **`xchat-tools-guide.md`** / **`xchat-history-storage.md`** / **`XCHAT_USE_REMOTE_HISTORY`**), tenant **`/api/admin/tasks*`** / scheduler tick, tenant **`/api/admin/delivery-channels*`** (desk SMTP on Next). Full migration board: **`api-consolidation-spring-backend.md`**.

**Market data:** Quotes and chains for product UX go through **Yahoo** adapters on Next (`yahoo-finance2`) and/or JVM Yahoo client on Spring for BFF paths — prefer **`market_quote` / `yahoo_finance`** tooling in xChat over narrative-only web fetches (**[`AGENTS.md`](../../AGENTS.md)**).

---

## Tenant UX (`tenant_ux`) — white-label navigation & enforcement

**Purpose:** Per-tenant **platform role** route allowlists + default landing paths for app users; **display-only** branding (names, accent, logo URL, tagline, `xf_ui_theme` default) via `core_tenants.tenantPreferences` — **not** a different regulatory story per tenant.

| Area | Shipped |
|------|---------|
| **Provisioning / bootstrap** | **≥3.12.6:** **`ensureTenantBootstrapForUser`** (login + optional approve-time when **`bootstrap_on_approve`**); structured **`bootstrap_policy`** per role; **`watchlist_seed_symbols`** + desk defaults; **`seed:tenant`** + **`tenant-specs/*.yaml`** (**`tenant.bootstrapPolicy`**, **`tenant.bootstrapOnApprove`**). See **`auth-and-access.md`** § Admin approval → default book. |
| **Catalog + drift tests** | `data/platform/app-user-route-catalog.json`, `getAppUserRouteCatalog()`, `assertCatalogMatchesWorkspaceProductPrefixes()` |
| **Admin read/write** | `GET /api/admin/platform/route-catalog`, `GET/PATCH /api/admin/platform/route-catalog/{tenantId}` (PATCH emits **`admin_audit_events`** `tenant_ux.route_catalog.patch`); optional overrides in `tenantPreferences` |
| **Role matrix** | `GET/PUT /api/admin/tenants/{tenantId}/roles`, `PATCH .../roles/{role}`; UI `/admin/tenants/{tenantId}/roles`; **`PUT` writes** `tenant_roles` + audit |
| **Runtime** | Resolver + `tenant-ux-policy-cache`; page guards; workspace rail / key headers; `GET /api/app-user/me/role`; **`/access-denied`** |
| **Edge V2** | `src/proxy.ts` — when **`TENANT_UX_ENFORCEMENT_V2`** is true, calls `GET /api/internal/tenant-ux/policy`; denials → **403** `tenant_ux_route_forbidden` (API) or `/access-denied` (HTML); optional **`TENANT_UX_POLICY_FAIL_CLOSED`** → **503** `tenant_ux_policy_unavailable` on resolver fetch failures (default remains fail-open with structured log `tenant_ux_policy_fetch_error`) |
| **Policy path map** | `src/modules/platform/tenant-ux-proxy-policy-path.ts` — `resolvePolicyPathForRequest` (includes **`/xcoach`** as product prefix); proxy matcher includes **`/xcoach`** |
| **xChat branding context** | System prompt + approved-shell welcome line include **tenant desk label** (`formatTenantWorkspaceContextBlockForXchat`); fingerprint includes tenant block for remote history |
| **CSS tokens** | `--xf-tenant-primary` / `--xf-tenant-secondary` in **`atxfinance-brand-kit.css`**; `layout` + **`TenantBrandingProvider`** set accent-derived vars |

**Soak / backlog:** Staging-first V2 rollout; expand API↔policy mapping for any remaining direct **`/api/...`** bypasses; optional Redis-backed policy cache; PWA **per-tenant** `manifest` (today static `manifest.webmanifest`); nav/header parity beyond workspace rail; metrics (`tenant_ux_route_forbidden_total`, policy latency). Runbook: **`atx-docs/sre-ops/tenant-ux-enforcement.md`**.

---

## Pre-production release gate (production deploy)

Before approving a **production** release, the **reviewer / operator** checklist (see **`reviewer.md` § Pre-production release gate**) is:

| # | Gate |
|---|------|
| **0** | **Version:** Root `package.json` / `APP_VERSION` match the intended tag (e.g. **v3.6.0**). |
| **1** | **`npm run ci:gate`** green on the release ref: lint, typecheck, **`docs:links`** on all **`atx-docs/**/*.md`**, Vitest (unit + integration), OpenAPI parity (`tests/integration/openapi-*.test.ts`). |
| **2** | **`NODE_ENV=production npm run build`** succeeds (Next compile + static generation). |
| **3** | If **`services/atxfinance-backend/**` changed:** **`./gradlew test`** (from `services/atxfinance-backend`) green — do not ship prod with only Next green. |
| **4** | **Docs parity:** [`.cursor/skills/test-commit-push/SKILL.md`](../../.cursor/skills/test-commit-push/SKILL.md) + [`.cursor/agents/reviewer.md`](../../.cursor/agents/reviewer.md) for touched domains (API, BFF, xChat, strategy-options, OptionsStrategyEngine spec, `PLAN.md`, agents). |
| **5** | **Conscious test gaps** called out if shipping spec-only or partial coverage (no fake “done”). |
| **6** | No undisclosed schema / auth / API drift; OpenAPI tests still pass. |
| **7** | **[`.cursor/skills/test-commit-push/CHECKLIST.md`](../../.cursor/skills/test-commit-push/CHECKLIST.md)** — secrets, BFF registry, Mongo `tenant_portfolio`, staging-before-prod. |
| **8** | **Deploy:** GitHub Actions **Deploy Cloud Run** → environment **`production`**, required approvals; [`.cursor/skills/deploy-production/SKILL.md`](../../.cursor/skills/deploy-production/SKILL.md) + [`AGENTS.md`](../../AGENTS.md). |

---

## PR authors — merge hygiene (reviewer)

Authors should confirm in the PR (or thread) where relevant:

1. **Perf impact:** For **UI-heavy** changes, large dependencies, or **hot paths** (**xChat**, **xOptions**, **`/portfolios`**, **`/portfolio`**, route-level **`loading`** on those surfaces), attach **Lighthouse delta** and **React Profiler** screenshot or trace link — or state **N/A** with reason. **`ci:gate` alone** is not a substitute for that evidence when reviewer scope applies.
2. **This doc:** If the PR **materially** changes shipped stack, product surfaces, or a **Known gap** row below, update **`current-state-features.md`** or **`PLAN.md`** in the same PR (or link a tracked follow-up with owner).

Cross-check **[`.cursor/skills/test-commit-push/SKILL.md`](../../.cursor/skills/test-commit-push/SKILL.md)** for commit conventions and release-notes line when bumping semver ([`sre-ops/release-notes.md`](../sre-ops/release-notes.md)).

---

## Doc & roadmap index

| Topic | Where |
|--------|--------|
| **This doc (architecture + shipped state)** | *You are here* — [`current-state-features.md`](./current-state-features.md) |
| Backlog (open items only) | [`PLAN.md`](../PLAN.md) |
| IBKR integration (phases, compliance) | [`ibkr-automation.md`](./ibkr-automation.md) · module [`src/modules/ibkr-integration/README.md`](../../src/modules/ibkr-integration/README.md) |
| Next API inventory | [`guides/api-endpoints.md`](../guides/api-endpoints.md) |
| Spring HTTP contract | [`sre-ops/atxfinance-backend-http-api.md`](../sre-ops/atxfinance-backend-http-api.md) |
| BFF / consolidation | [`sre-ops/api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md) |
| Deploy, secrets, desk SMTP | [`guides/deploy-and-ops.md`](../guides/deploy-and-ops.md) |
| Tenant workspace limits (xChat day/hour, xOptions copy, plan overrides) | [`sre-ops/tenant-workspace-limits.md`](../sre-ops/tenant-workspace-limits.md) |
| OptionsStrategyEngine (shipped scoring path) | [`xStrategyBuilder/strategy-engine.md`](./xStrategyBuilder/strategy-engine.md) |
| xOptions UI, find-options + strategy APIs | [`xchat/xoptions-strategy-builder.md`](../xchat/xoptions-strategy-builder.md) · [`guides/api-endpoints.md`](../guides/api-endpoints.md) § xOptions |
| OpenAPI inventory (admin Swagger) | `GET /api/openapi` · `src/lib/openapi/current-state.ts` (`CURRENT_STATE_ROUTES`) |
| Charts (Apex) | [`charts-apex.md`](./charts-apex.md) |
| Release history (semver, newest first) | [`sre-ops/release-notes.md`](../sre-ops/release-notes.md) |
| Reviewer / prod gate | [`.cursor/agents/reviewer.md`](../../.cursor/agents/reviewer.md) |
| Ship checklist (secrets, BFF) | [`.cursor/skills/test-commit-push/CHECKLIST.md`](../../.cursor/skills/test-commit-push/CHECKLIST.md) |
| Scheduled scanners (Phase 3 shipped) | [`scheduled-task/scanners-phase3-plan.md`](./scheduled-task/scanners-phase3-plan.md) |
| Tenant workspace automations (`ownerKind: tenant_user`) | [`scheduled-task/user-tasks.md`](./scheduled-task/user-tasks.md) |

---

## 1) Core app — Next.js (primary product)

- **Framework:** Next.js **16.x** App Router (`src/app/*`); **React 19.2.x**; **TypeScript 5.9.x** (strict **`npm run typecheck`**).
- **Edge (Next 16):** Auth redirect / guest HTML gating lives in **`src/proxy.ts`** only (no `middleware.ts` — the framework allows one or the other). Matcher still covers protected app_user APIs and guest-capable HTML for **`/portfolio`**, **`/portfolios`**, **`/xoptions`** (see [`AGENTS.md`](../../AGENTS.md)).
- **UI:** Tailwind **3.4.x** + **`--xf-*`** tokens from [`atxfinance-brand-kit.css`](./atxfinance-brand-kit.css); dark-first product shell; optional **soft** theme via **`data-xf-ui`** (see globals / xOptions layout notes in **`AGENTS.md`**).
- **Validation / contracts:** **Zod 4.x**; route handlers stay thin — domain logic in **`src/modules/*`** and **`src/lib/*`**.
- **Tooling:** **`tsconfig`** excludes **`.next/dev`** so stale dev-generated types do not break `tsc`; **`next-env.d.ts`** references **`.next/types/routes.d.ts`**. Route files must only export valid route symbols.
- **Data:** **MongoDB** (driver **7.x**) via route handlers and modules; signed session cookie **`xf_core_session`**.
- **API docs:** **`GET /api/openapi`** (inventory + overrides in **`src/lib/openapi/current-state-overrides.ts`**); admin **Swagger** at **`/admin/api-docs`** (**swagger-ui-react**).
- **CI gate:** **`npm run ci:gate`** → lint, typecheck, **`docs:links`** (`atx-docs/**/*.md`), Vitest (unit + integration), OpenAPI parity (`tests/integration/openapi-*.test.ts`).
- **Optional BFF:** When **`ATXFINANCE_BACKEND_ORIGIN`** points at the Spring **HTTPS** origin, selected **`/api/*`** routes proxy per [`bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts). **xChat** (`/api/xchat/*`) remains **Next-authoritative** (live token SSE + JSON fallback on Next; JVM **`POST /api/xchat/ask/stream`** stub optional via **`XCHAT_SSE_PROXY_BACKEND`** — **`PLAN.md`** / **`api-consolidation-spring-backend.md`**).
- **Admin (`global_admin`, `/admin*`)** — Control Center (**`/admin`**): session + effective **tenant** ObjectId; **ops summary** (**`GET /api/admin/system/ops-summary`**) for Next Mongo/Redis + optional Spring **`/api/backend/health`**; personas, access, tasks, delivery channels, RAG inventory, **tenant workspace limits** (xChat day/hour caps, plan overrides), and other hub routes.

### Product surfaces (app_user shell)

**Shell themes (soft vs deep):** See **[`shell-theme-guidelines.md`](./shell-theme-guidelines.md)** — contrast rules for all user-facing pages; Tailwind **`dark:`** aligns with deep shell in **`tailwind.config.ts`**. Tenant default **`xf_ui_theme`** (`light` \| `dark` \| `system`) is applied on boot via **`XfThemeBootClient`**; when the stored preference is **`system`**, the document follows **`prefers-color-scheme`** (including after OS theme changes).

**Per-tenant workspace rail branding:** **`core_tenants.name`** plus **`tenantPreferences`** **`xf_accent_color`**, **`xf_tenant_logo_url`**, **`xf_tenant_tagline`** feed **`getTenantShellBrandingForHex`** → **`TenantBrandingProvider`** (root layout sets **`--xf-tenant-accent`** on **`html`** for first paint). **`WorkspaceProductSidebar`** shows a tenant header (logo / **aTx** fallback, name, tagline) and uses the accent for active links, **Find xOptions**, toggles/checkboxes, and collapsed-icon states — CSS fallbacks use **`--xf-xoptions-accent`** when the CSS variable is unset. The **Resources** accordion nests a collapsible **Utilities** subgroup (default closed; opens on import / tasks / attachments routes): **User Collections** (Premium+ xAI uploads), broker import, and **`/account/tasks`**. Guide articles are consolidated behind **`/resources/guides`** (jump chips + icon-led panels: platform / **xChat** / wheel / playbooks; catalog **`resource-guides-catalog.ts`** — platform includes **`/resources/onboarding-checklist`**). Nested links under Resources: **Guides**, optional **Reference docs** (global_admin); collapsed Resources icon targets **`/resources/guides`**. **`/portfolios`** (**`PortfoliosWorkspaceHeader`** + **`.portfolios-workspace-tenant-chrome`**) applies the same tokens to the sticky header (total book, market-open pill), book cards, manage table, edit panel, accounts footer, and compact watchlist/news links. Subtitle fallback when tagline is omitted: **`PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE`**. Provisioning copy: **`tenant-specs/README.md`**, admin create tenant UI.

Path prefixes for the shared product chrome are defined in **`APP_USER_PRODUCT_PATH_PREFIXES`** ([`surface-policy.ts`](../../src/modules/surface-policy.ts)): **`/xchat`**, **`/portfolio`**, **`/portfolios`**, **`/import-activity`**, **`/watchlist`**, **`/account`**, **`/workspace/tasks`** (tenant automations row; nested under **`/workspace`**), **`/workspace`**, **`/xoptions`**. Other user routes (e.g. **`/xcoach`**) exist but are not in that rail list unless extended there.

**Representative capabilities (non-exhaustive — see `api-endpoints.md`):**

- **xChat** — `POST /api/xchat/ask`, **`POST /api/xchat/ask/stream`** (live SSE delegate), personas, **plan limits** (`getPlanLimits`) + **tenant workspace caps** merged from **`core_tenants.workspaceLimits`** (base + **`planOverrides`** per billing tier): **`userChatLimit`** = **UTC calendar-day** prompt cap; optional **`userChatHourlyLimit`** (**`0`** = off) = **UTC clock-hour** cap. Counters live in Mongo **`xchat_usage_limits`** (minute burst + optional hour + day buckets). **429** responses expose distinct copy + JSON **`code`** for **`xchat_rate_limit_exceeded`** (per-minute), **`xchat_hourly_limit_exceeded`**, **`xchat_daily_limit_exceeded`**; limiter metadata headers (`x-xchat-limit-*`). xAI **`/v1/responses`** tool-loop: **default JSON** per turn; **`stream: true`** + SSE parsing when the client requests **`Accept: text/event-stream`** (dual-run safe — **`XCHAT_LIVE_SSE_ENABLED=false`** disables). **`done`** SSE event carries the **same `data` shape** as the JSON ask response. **Direct watchlist intent (`show_watchlist`)** now has deterministic routing (`atx_function.watchlist_snapshot`), `portfolioId` slot collection when the ask says “for [portfolio]”, and table-first output with tool-backed 1D delta + distance-to-target metrics plus per-row xOptions CTA links. **RAG / collection tools:** persona-linked ids only (`xaiCollection`, `teamCollection`, tool `collection_ids` via **`resolveXchatPersonaDeclaredCollectionIds`**); deploy env team KB is **not** merged into ask. **Continuity:** Mongo **`xchat_logs`** when opted in; optional **`XCHAT_USE_REMOTE_HISTORY=true`** + client **`threadId`** + prior **`xaiResponseId`** (same **`personaId`**) → **`previous_response_id`** / **`store_messages`** (**`keepXchatHistory`** can disable per persona). **Vision paste (PNG / JPEG):** optional **`imageAttachment`** → **`input_image`** (`detail: high`) + **`input_text`**; optional **`XAI_VISION_MODEL`** overrides image turns. **Structured opt-in logs (`[xchat/debug]`):** **tenant workspace toggle only** — **`tenantPreferences.xchat_debug_enabled`** + AsyncLocalStorage per request (**`xchat-debug-context.ts`**); no env flag — see [`xchat-debug-logging.md`](../xchat/xchat-debug-logging.md); unit coverage **`tests/unit/xchat-debug-gating.test.ts`**. See [xAI image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding) · **`xchat-history-storage.md`** · **`sre-ops/tenant-workspace-limits.md`**.
- **Rental AI (partner API)** — **`POST /api/ai/rent/chat`** (JSON + SSE), **`POST /api/ai/rent/strategy|analyze`** (**`202`** + **`GET`** poll on the same path with **`jobId`**). **Auth:** `Authorization: Bearer atxr_<16-hex>_<64-hex>` with per-key scopes on **`core_tenants.apiKeys`**; **`rentalProfile`** drives bias, token budget (**UTC day**), expiry. **OpenAPI** tag **`rental-ai`**. **Agent handoff manifest:** [`MCP-AI-ADVISOR.md`](../MCP-AI-ADVISOR.md) + repo root **`llm.txt`**. Runbook: [`sre-ops/rental-ai-platform.md`](../sre-ops/rental-ai-platform.md).
- **Options action scan reports** — direct scan asks now return structured payloads for rich holdings/watchlist rendering (sortable table + mobile cards, confidence/urgency badges, xOptions deep-link per row), local PDF/CSV export (`jsPDF` + `jspdf-autotable`), and temporary public sharing (`POST /api/reports/create` + `GET /api/reports/scan/{token}` + no-auth page `/reports/scan/{token}`) backed by Mongo `options_scan_reports` TTL (`expiresAt` + access counters).
- **Portfolio / accounts / holdings** — app_user and admin paths; workspace portfolio cookie; **`/portfolio/accounts/[id]`** Edit Account: consolidated holdings table (Last / Day Δ / Value / % acct / Qty / Avg cost) + add/remove lots + per-row **Desk** → **`POST /api/portfolios/{portfolioId}/alerts`** (manual portfolio alert + desk dispatch) — see **[`portfolio-edit-account-consolidated-holdings.md`](./portfolio-edit-account-consolidated-holdings.md)** (code map + **Tests & broker-ref stability**). Automated row-level **`price-alert-service`** / scanner thresholds from those columns stay **backlog** (`PLAN.md` deferred product). Account details client (**`account-workspace-client`**) re-syncs local form state when **`extAccountRefMasked`**, **`brokerImportLocked`**, or account **`_id`** changes after **`router.refresh()`**. Merrill/Fidelity CSV import + **`/import-activity`** (broker ref **last-four** display; per-account **Use for import** toggles; copy in **`import-activity-copy.ts`**). **Default-book provision** (Next **`provisionDefaultPortfolioForUser`**, Spring **`DefaultPortfolioProvisionService`**) is idempotent for **user-set** default-account **`extAccountId`** and broker **`type`** on repeat runs (OAuth, empty-account repair, etc.) — **≥3.7.3**; inserts still seed paper defaults.
- **Watchlist** — user-scoped store, quotes, optional chain glance; desk columns / IV-OI highlights (see release notes **3.1.x**). **App shell:** **`src/app/watchlist/page.tsx`** uses **`WorkspaceProductSidebar`** + **`railChrome="workspace-product"`** (same left-rail expand/collapse behavior and **`xf-workspace-product-rail-expanded`** persistence as **`/portfolio`** / xChat product surfaces) and imports **`portfolios-dashboard.css`** for **`portfolios-workspace-sidebar__*`** rail tokens. **Price alerts** (Next-side scanner thresholds + cooldown): `src/modules/watchlist/price-alert-service.ts`; roadmap context in **`PLAN.md`** (**240n** shipped).
- **Portfolio alerts (desk)** — UI **`/portfolio/alerts`** (table + detail modal, xAI narrative via **`POST /api/portfolios/{portfolioId}/alerts/{alertId}/narrative`**); app_user **`GET` / **`POST`** / **`DELETE /api/portfolios/{portfolioId}/alerts`** (may BFF to Spring); global admin **`/api/admin/portfolios/{portfolioId}/alerts`** (+ `{alertId}` **PATCH** / **DELETE**). OpenAPI under **`portfolios`** / **`admin-portfolios`**.
- **xOptions** — strategy builder UI at **`/xoptions`** (step 4 **Choose contract**: heatmapped Vol/OI, Mid + spread hint, ATM pill, mobile Greeks toggle). **xWheel Studio** at **`/xoptions/wheel`** generates comparable wheel scenarios, per-scenario income/yield metrics, and PDF/share reports (**`POST /api/xoptions/wheel/generate`**). Data plane is split across **find-options** (Next session APIs for bootstrap/context/holdings/watchlist/symbol snapshot), **strategy-options** (chain + expirations), and optional **Spring BFF** — see **Options stack** below and [`xoptions-strategy-builder.md`](../xchat/xoptions-strategy-builder.md) § xWheel Studio.
- **xCoach** — learning surface (route present; detail in app).
- **Billing** — Stripe Checkout (`/account/billing`), webhooks → `subscriptionPlan` + **`stripeCustomerId`**, Customer Portal via `POST /api/billing/portal-session`; hardcoded tier ceilings in **`getPlanLimits()`** plus **tenant-driven** workspace rows on plan cards (**xChat prompts / hr (UTC)** and **/ day (UTC)** when configured — see **`billing-plan-workspace-display.ts`**). Per-tenant Stripe **price_…** overrides in **`workspaceLimits.planOverrides`**. **Guests (≥3.16.3):** signup-first layout (**`billing-guest-experience.tsx`**), **`POST /api/access-requests/public`** with **`password`** for initial **`passwordHash`**. Ops: **`stripe-billing-setup.md`**.
- **User Tasks (automation)** — **`/account/tasks`** (simplified + limited create) and **`/workspace/tasks`** (power-user primary surface) manage tenant-scoped **`user_tasks`**. v1 ships hardcoded create templates (**Daily Portfolio Monitor**, **Weekly Portfolio Summary**) with advisor-default persona on run and optional persona override when tenant **`workspaceLimits.changePersonaEnabled`** allows. Saved persona ids that become invalid/archived gracefully fall back to advisor and write an in-app run notice + audit detail (no hard failure). **Run now** → **`POST /api/tasks/{taskId}/run`**; in-app notification/history feed → **`GET /api/tasks/{taskId}/runs`**; scheduled draining → **`POST /api/internal/user-tasks/process-due`** (shared **`ATX_SCHEDULER_INTERNAL_SECRET`** with admin scheduler delegate). **Cap:** per-tenant **`workspaceLimits.userTasksMax`** (default **5** per user), editable under Admin → Workspace limits.
- **Tenant workspace automations** — **`/workspace/tasks`** + **`/api/tenant-tasks/*`**: Mongo **`admin_scheduled_tasks`** rows with **`ownerKind: tenant_user`** + **`ownerUserId`** (creating user). Same **Spring poll** → **`POST /api/internal/scheduler/execute-task`** → Next **`executeScheduledTask`** path as other tenant-level jobs. **Roles:** **`operator`** / **`global_admin`** create, edit, delete, **Run now**; **`advisor`** read-only; **`viewer`** denied (route catalog + APIs). **Cap:** **`MAX_TENANT_USER_TASKS`** env (default **5** enabled per tenant); UI soft-warning from **3**. **v1 categories:** **`watchlist_price_scanner`**, **`options_scanner`**, **`notifications`**. **Manual run** uses **`triggeredBy`** `user-task:{taskId}`; cooldown on Run now (**45s** per user/task). See **[`scheduled-task/user-tasks.md`](./scheduled-task/user-tasks.md)**.
- **IBKR (Client Portal, gated `IBKR_ENABLED`)** — consent (`ibkr_user_consents`), sealed httpOnly CP session + issued-at cookie; **`GET /api/integrations/ibkr/*`** including **`…/accounts/{id}/snapshot`** (summary, positions, orders, trades); account allowlist vs **`portfolio/accounts`**; **`[ibkr/audit]`** logs with **`correlationId`** matching response **`X-Correlation-Id`**; UI **`/account/integrations/ibkr`**. No in-app broker OAuth yet; no live order POST (see `ibkr-automation.md`).
- **Strategy jobs (hardcore)** — Next BFF to Spring: `POST/GET /api/strategy-jobs`, turns through **`slots_complete`**; Redis hourly cap when **`REDIS_URL`** set; contract in `atxfinance-backend-http-api.md` + smoke parity needles.

### Options stack (xOptions, chain, jobs, admin catalog) — reviewer map

| Layer | Role | Notes |
|--------|------|--------|
| **UI** | **`/xoptions`** | Stepped builder; workspace portfolio scope aligns with xChat/watchlist (`portfolioId` query + cookie). See [`xoptions-strategy-builder.md`](../xchat/xoptions-strategy-builder.md). |
| **Find-options** | Next session APIs | `GET /api/app-user/find-options/*` — **bootstrap** (one round-trip context + top holdings + hot watchlist), **context**, **symbol-snapshot**, **top-holdings**, **watchlist-hot**; **`/api/app-user/symbol-chart`**. Holdings reuse **`loadWorkspaceSnapshotPreload`** (local Redis → optional JVM **`GET /api/portfolios/{id}/snapshot`** → Mongo row → live query). OpenAPI tag **`find-options`**. |
| **Market pulse** | Next | `GET /api/market/workspace-pulse` (nearest-expiry options highlight-style summary for workspace UX); `GET /api/market/symbol-quotes`. Tag **`market`**. |
| **Strategy-options** | Next + optional Spring | `GET /api/strategy-options/expirations` — **always** Next Yahoo (avoids JVM stalls in dev/prod). `GET /api/strategy-options` — may **BFF-proxy** to Spring; on sparse chain or bad JSON, Next falls back to Yahoo (`src/app/api/strategy-options/route.ts`). |
| **Strategy jobs** | Spring orchestrator, Next BFF | Same paths on the Next host (`/api/strategy-jobs*`) forward to Kotlin when **`ATXFINANCE_BACKEND_ORIGIN`** is set; **503** with hint when JVM unreachable in dev. Mongo **`strategy_jobs`**; finalizer uses **`XAI_API_KEY`**. OpenAPI tag **`strategy-jobs`**. |
| **Admin options-strategy** | Next only | `GET|POST /api/admin/options-strategy`, `GET|PATCH|DELETE …/{strategyId}`, preferences `…/options-strategy-preferences*`. **Not** on Spring HTTP surface. Mongo **`options_strategy_preferences`** seeded from disk (`atx-docs/rag-collection/options-strategy/**`, `npm run seed:options-strategy-prefs`). OpenAPI tag **`admin-options-strategy`**. |
| **Engine / scanners** | Kotlin **`strategy`** package | **`OptionsStrategyEngine`** scoring + scheduled **options_scanner** (and related Phase 3 tasks) — canonical flow in [`xStrategyBuilder/strategy-engine.md`](./xStrategyBuilder/strategy-engine.md); tenant tasks in [`scheduled-task/scanners-phase3-plan.md`](./scheduled-task/scanners-phase3-plan.md). |
| **RAG / personas** | xChat | Persona collection scope may include slug **`options-strategy`** (`GET /api/personas/collections`) for KB-aligned prompts; distinct from Mongo **`options_strategy_preferences`** admin catalog. |

**Contract sources:** [`guides/api-endpoints.md`](../guides/api-endpoints.md) (grouped list), **`GET /api/openapi`** + **`/admin/api-docs`**, [`sre-ops/atxfinance-backend-http-api.md`](../sre-ops/atxfinance-backend-http-api.md) (Spring paths including **`/api/strategy-options`** and **`/api/strategy-jobs*`**), [`sre-ops/api-consolidation-spring-backend.md`](../sre-ops/api-consolidation-spring-backend.md) (BFF registry).

### Quick pointers

- Implementation: **`src/app/`**, **`src/modules/`**
- Local dev: [`guides/local-development.md`](../guides/local-development.md)
- AGENTS runbook: [`AGENTS.md`](../../AGENTS.md)

---

## 2) Worker / API — `atxfinance-backend` (Kotlin/Spring)

Scope: scheduler/worker and **thin HTTP API** for portfolio/admin/strategy/RAG-support paths. Built from **`services/atxfinance-backend`** (repo-root Dockerfile can build this JAR).

- **Runtime:** **Kotlin 1.9.25**, **Spring Boot 3.3.4**, **JDK 21** (Gradle JVM toolchain)
- **Build:** Gradle Kotlin DSL (`build.gradle.kts`, **`gradle/libs.versions.toml`**); **`npm run build:backend`** → **`./gradlew test --no-daemon`**
- **Data:** **Spring Data MongoDB**; **Spring Data Redis** starter (optional runtime — strategy-job caps, etc.)
- **Scheduling:** `@Scheduled` + **ShedLock 5.13.x** (Mongo provider)
- **Messaging:** **Google Cloud Pub/Sub** client (BOM-aligned) — **publisher** paths where configured; **subscriber/consumer not implemented** (platform follow-on)
- **Observability:** **Micrometer** (incl. Prometheus registry) + **OpenTelemetry** OTLP exporter optional
- **HTTP:** REST (health, portfolio, admin, strategy, RAG, session alignment); **SpringDoc OpenAPI 2.6.x** — **`/swagger-ui.html`**
- **Email:** **Angus Mail** for desk SMTP parity with Next **`nodemailer`** path

### Boot & configuration

- Entry: `com.atxfinance.backend.Application`
- Config: `AtxfinanceProperties` (`app.atxfinance.*`)
- Mongo: `MONGODB_URI` / `MONGODB_URI_B64` early resolution → `spring.data.mongodb.uri`
- Pub/Sub: `app.pubsub.project-id`, `app.pubsub.topic`, `app.pubsub.dlq-topic`

### Module map (packages)

- **`config/`** — properties, Mongo URI, ShedLock, executors
- **`web/`** — REST controllers
- **`portfolio/`**, **`admin/`** — CRUD, watchlist, positions, **platform `admin_delivery_channels`** (`in_app` \| `slack` \| **`email`**), tenant tasks, deploy notes
- **`audit/`** — audit writers + admin query
- **`strategy/`** — strategy jobs HTTP handlers, Yahoo client, **`OptionsStrategyEngine`** (scoring + **`options_scanner`** / scanner job alignment — see `strategy-engine.md` and `scanners-phase3-plan.md`)
- **`rag/`** — ingestion helpers, xAI collection clients
- **`session/`** — session cookie parse (name aligns with Next: **`xf_core_session`**)
- **`identity/`** — OAuth merge helpers, **`CredentialInviteService`** (post-approve set-password invite + **`DeskSmtpSender`**)
- **`notify/`** — Slack; **desk SMTP** (`DeskSmtpSender`) for delivery-channel test-send (parity with Next `desk-smtp.ts`)

### Notable Mongo collections (Spring + shared)

Centralized in `AtxfinanceProperties`. Examples: **`tenant_portfolio`**, **`portfolio_accounts`**, **`portfolio_positions`**, **`portfolio_watchlists`**, **`strategy_jobs`**, **`options_strategy_preferences`** (admin catalog + seed; Next CRUD), **`xchat_personas`**, **`core_users`**, **`admin_audit_events`**, **`admin_scheduled_tasks`**, **`admin_delivery_channels`**, **`app_user_recommendations`**, RAG (`xai_collections`, `xchat_rag_chunks`, `xchat_logs`), etc.

### HTTP (selected)

- **Health:** `GET /actuator/health`, `GET /api/health`, `GET /api/backend/health`
- **Portfolio (session):** `GET|PATCH /api/portfolios/{portfolioId}` (and nested resources per `web/`)
- **Admin / app:** access requests, audit, broker import, recommendations, strategy, RAG — full list in **`atxfinance-backend-http-api.md`**

### Scheduling & deployment baseline

- ShedLock default max lock **PT5M**; scheduler thread pool (e.g. core/max 4)
- **Cloud Run (prod Spring baseline):** concurrency **80**, **1 vCPU**, **1 GiB**, HTTP **:8080**, min **0** / max **30**, CPU boost on — **`atx-docs/sre-ops/gcp-prod-two-service-model.md`**

### Run locally

```bash
cd services/atxfinance-backend
./gradlew bootRun   # env from repo-root .env as needed
```

Service README: [`services/atxfinance-backend/README.md`](../../services/atxfinance-backend/README.md)

---

## 3) Desk email (Next + Spring)

When SMTP + **`DESK_EMAIL_FROM`** are configured (see **`.env.example`** / `src/lib/env.ts`):

- **Next** — portfolio desk channels, price-alert paths, admin **`POST /api/admin/delivery-channels/{id}/test`** (`src/lib/desk-smtp.ts`); **access-approved credential invite** + **password reset** mail (`src/lib/send-email-credential-messages.ts`). Optional test-only env: **`DESK_DELIVERY_CHANNEL_TEST_TO`**, **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`** — [`deploy-and-ops.md`](../guides/deploy-and-ops.md). Link base: **`PUBLIC_APP_BASE_URL`** (fallback: request origin).
- **Spring** — **`DeskSmtpSender`** + **`AdminDeliveryChannelsService`** + **`CredentialInviteService`** (BFF-proxied approve); tenant delivery-channel routes from the **Next app are not BFF-proxied** (always `src/lib/desk-smtp.ts` for **Send test** in product).
- **Ops:** Bind desk-SMTP + **`PUBLIC_APP_BASE_URL`** on **Next** for product invite/reset; when **`ATXFINANCE_BACKEND_ORIGIN`** proxies admin access-request approve, also mount the same on **Spring** — [`deploy-and-ops.md`](../guides/deploy-and-ops.md). UI: **`/admin/delivery-channels`**.

---

## 4) Testing matrix (what runs in CI vs optional)

| Layer | Command / location | Notes |
|--------|-------------------|--------|
| **Next gate** | **`npm run ci:gate`** | lint + typecheck + **markdown link check** + full Vitest suite + OpenAPI inventory tests |
| **Vitest unit** | `tests/unit/**` | Fast, mocked deps |
| **Vitest integration** | `tests/integration/**` | Route/module tests; **no** live Mongo required for default suite |
| **OpenAPI parity** | `tests/integration/openapi-*.test.ts` | **`CURRENT_STATE_ROUTES`** must match implemented routes |
| **Smoke** | `tests/smoke/**`, `npm run smoke:*` | Backend HTTP parity needles, optional live smokes (skipped unless env flags) |
| **Spring** | **`./gradlew test`** in `services/atxfinance-backend` | Required before prod when Kotlin changes; **`npm run build:backend`** in CI stack |
| **Live stack** | **`npm run test:integration:live`** | Docker Compose + Mongo + backend + Redis — opt-in |

---

## 5) Known gaps — tests & docs (reviewer-style, consolidated)

These are **documented** backlog items or **conscious** holes; do not treat as shipped.

| Gap | Pointer |
|-----|---------|
| **xChat JVM-authoritative ask + tool loop** | Live token SSE is **Next-first** (`xai.ts` / `xchat/ask`); Spring **`POST /api/xchat/ask/stream`** remains optional BFF passthrough — `PLAN.md` · `api-consolidation-spring-backend.md` |
| **Strict JSON Schema artifact v2** (strategy jobs) | `PLAN.md` · `atx-multi-agent.md` |
| **Email/password auth** — unit tests for **`password-crypto`**, **`auth-token-hash`**; access-request approve path covered with mocks (`issueCredentialInviteForUser` / SMTP); **no** default CI E2E against live SMTP or full register→verify→login (conscious; use staging + desk test send) | `tests/unit/password-crypto.test.ts`, `tests/unit/auth-token-hash.test.ts`, `tests/integration/access-request-*.test.ts`; Spring **`AuthTokenHashTest`** |
| **`POST /api/import/broker/clean`** — no dedicated integration test (destructive) | `PLAN.md` § test/doc follow-ups · `api-endpoints.md` |
| **Admin `PATCH/DELETE …/positions/{id}`** — Next until BFF registry + Kotlin parity | `PLAN.md` |
| **Pub/Sub consumer** on Spring | This doc §2 · `PLAN.md` / release notes |
| **IBKR** — no broker OAuth/token refresh in-app; no order placement | `ibkr-automation.md` |
| **Multi-tenant provisioning** — Admin bootstrap log / replay; Spring book parity for **`bootstrap_policy`** | `PLAN.md` **10** · `skill-tenant-roadmap/SKILL.md` |
| **Tenant UX (`tenant_ux`)** — soak + hardening | Deep narrative: **§ Tenant UX** above. **Open:** metrics/alerts, Redis policy cache, exhaustive `/api/*`↔policy map, per-tenant PWA manifest, broader product-nav parity. **Env:** **`TENANT_UX_ENFORCEMENT_V2`**, **`TENANT_UX_POLICY_FAIL_CLOSED`** (`.env.example`). | [tenant-ux-plan.md](./tenant-ux-plan.md) · [tenant-ux-enforcement.md](../sre-ops/tenant-ux-enforcement.md) · `PLAN.md` **11** |
| **Plan limits UI** — usage meter / soft-limit banner wired to **`getPlanLimits()`** + live workspace counters (429 headers exist; in-chat meter still deferred) | `PLAN.md` (deferred) · branding TODO in `AGENTS.md` |
| **xChat** — vision paste **shipped** (follow-ups: scan/EXIF/dims/batch — `PLAN.md` deferred); structured **`[xchat/debug]`** gated tenant-only (**app ≥3.6.16**, `xchat-debug-logging.md`); **Grok-style composer + dictation + tenant attach** shipped **3.9.0** (`release-notes.md`); **HNWI Templates + saved user prompts + Depth (Fast/Expert/Heavy)** (`xchat-hnwi-templates-ui.md`, **`707` closed**); **Composer rail token usage** (**app ≥3.16.4**) — **`GET /api/app-user/xchat/token-stats`**, sidebar **`XchatSidebarTokenStats`** (`xchat-token-usage-sidebar.md`); voice — **xAI STT only** (**MediaRecorder** → **`/voice-transcribe`**); **Voice Mode** — **`POST /api/app-user/xchat/voice-realtime/token`** (optional **`workspace_voice_context`**) + **`wss://…/v1/realtime`** (`xchat-voice-mode.md`); voice stack **703** documented in **`release-notes`** / **`xchat-voice-mode.md`** (`PLAN.md` tracks open backlog only); **xMoney billing + crypto book (704)** — phased roadmap: [`PLAN.md`](../PLAN.md) § **xMoney & crypto portfolio (704)** | `PLAN.md`; **701** privacy history **shipped** (`xchat-history-storage.md`) |
| **OptionsStrategyEngine** — extend scoring / desk notification providers | `PLAN.md` · `reviewer.md` §245 |
| **Lighthouse / perf in default CI** | **`npm run ci:gate`** does **not** run Lighthouse; hot-path PRs attach local LHCI or manual Lighthouse per **`reviewer.md`**; optional repo **`.lighthouseci/`** config for local regression |

**Governance:** Tenant workspace limits (**including xChat day/hour caps**), persona changes, and SMTP/BFF/deploy workflow edits should update **`CURRENT_STATE_ROUTES`**, relevant **`atx-docs/guides/*`** / **`sre-ops/tenant-workspace-limits.md`**, and **`tests/unit/surface-policy.test.ts`** when **`APP_USER_PRODUCT_PATH_PREFIXES`** or public contracts change.

---

### UX performance (baseline & release prep)

- **Targets (product):** LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.1 on **`/portfolio`**, **`/portfolios`**, **`/xoptions`**, **`/watchlist`**, **`/xchat`** where feasible.
- **Post-deploy smoke:** **`GET /api/health`** (version matches image); app_user / admin paths per [`AGENTS.md`](../../AGENTS.md) § Production validation.
- **High-risk clients:** ApexCharts (xOptions symbol panel), long xChat threads, watchlist quote refresh, IBKR snapshot panels, virtualized portfolio tables.
- **Local regression:** After **`NODE_ENV=production npm run build`**, run **Lighthouse CI** with **`.lighthouseci/config.cjs`** — it starts **`next start`** on **`localhost:3001`** by default (override with **`LHCI_PORT`**) and audits **`/xchat`**, **`/portfolio`**, **`/portfolios`**, **`/xoptions`**. Not a merge blocker unless workflow is added to GitHub Actions.
- **Live prod regression:** **`npm run lh:prod`** → **`.lighthouseci/config.prod-remote.cjs`** (same four URLs against **`https://atx.fintech-advisor.ai`**; guest shells unless you add LHCI auth).
- **Recent LHCI direction:** improve performance scores on **`/xchat`** and **`/portfolios`** (history + virtualized lists); keep INP ≤ 200 ms on interactive surfaces.

#### Lighthouse production baseline (2026-04-08)

- **Performance:** **1.00** on **`/xchat`**, **`/portfolio`**, **`/portfolios`**, **`/xoptions`** (live prod).
- **LCP:** **0.6–0.7 s** on live prod.
- **Goal met:** Instant UX for HNWI users managing real-money portfolios and options income.
- **Infra:** Cloud Run sizing locked in — frontend **min=1**, backend **min=0**, **CPU boost** (`--cpu-boost`) on both — **`atx-docs/sre-ops/gcp-prod-two-service-model.md`**.

#### xChat & Portfolios targets (2026-04-08 LHCI)

- **All critical routes (local + prod baselines above):** Performance **1.00** (LCP ≤ **0.7** s; prod observed **0.6–0.7** s).
- **`/xoptions`:** Accessibility **1.00** target (horizon chips: explicit **`aria-label`** + **`aria-pressed`** on target-expiration pills in **`xoptions-choose-contract.tsx`**).
- **High-risk surfaces** (ApexCharts, IBKR snapshot, long chat history): passing under seeded data.

#### Quick remaining gaps (non-blocking)

- **Best-practices ≈ 0.96 on every route:** Almost always **back/forward cache** audit failures because dynamic API responses use **`Cache-Control: no-store`** (normal and correct for live portfolios, watchlists, and IBKR snapshots). **Do not change** this in dev or prod — it would break freshness for real-money data.
- **`/xoptions` accessibility (historical):** Horizon chip buttons lacked explicit names; fixed with **`aria-label`** / **`aria-pressed`**. If Lighthouse regresses, re-check **bid-price** chain cells (price-only text) and **stepper** labels under **`max-width: 640px`** (CSS hides step titles; add **`aria-label`** on step buttons if needed).

---

## References (unchanged deep dives)

- `services/atxfinance-backend/README.md`
- `atx-docs/sre-ops/atxfinance-backend-http-api.md`
- `atx-docs/PLAN.md`
- `atx-docs/guides/deploy-and-ops.md`
- Kotlin sources: `services/atxfinance-backend/src/main/kotlin/com/atxfinance/backend/**`
