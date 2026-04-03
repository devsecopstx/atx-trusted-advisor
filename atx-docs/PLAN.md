# Roadmap (outstanding)

Living backlog for atx app, xChat, admin, and BFF. Shipped slices are recorded in release tags and app changelogs; this file lists **only open work**.

**Docs index:** [README.md](./README.md) · Phase 1 multi-agent: [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · BFF: [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) · Spring HTTP contract: [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) · Deploy / secrets / desk SMTP: [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) · NL / strategy preflight: [xchat/nl-workflows/nl-prompts.md](./xchat/nl-workflows/nl-prompts.md) · OptionsStrategyEngine: [design-system/xStrategyBuilder/strategy-engine.md](./design-system/xStrategyBuilder/strategy-engine.md) · Charts: [design-system/charts-apex.md](./design-system/charts-apex.md) · Redis: [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md) · Auth: [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) · Audit: [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md)

---

## Product backlog

| Priority | Item | Notes |
| -------- | ---- | ----- |
| **486n** | **Auth: email + password** | Register / login / reset without X or Google; hash + rate limits + audit; SMTP/transactional email for reset. UI on guest panel and/or `/login`/`/register` (today `/login` → `/xchat` — align when this ships). |
| **500** | **Automated trades w/ verify** | Ship only after **E\*TRADE** and **IBKR** execution/custodian path; until then alerts / manual execution only. |
| **600** | **Redis / platform** | VPC Memorystore cutover per env; broader API RL at BFF edge; orchestrator hot keys / non-OAuth RL (chunk **1.3**). |
| **700** | **NL + strategy job tool (xChat)** | Wire **nl** slots to `/api/strategy-jobs` (BFF) when ready; tool schema + persona copy. Themes: [NL preflight](#nl-and-strategy-preflight) · [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md). |
| **485n (optional)** | **OAuth follow-ons** | “Link Google while signed in with X” UI; admin merge for legacy duplicate `core_users` rows. |

### NL and strategy preflight

<a id="nl-and-strategy-preflight-backlog-themes"></a>

**Deep spec:** [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md)

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

- **Reviewer / infra:** Desk SMTP + BFF split (Next vs JVM when `ATXFINANCE_BACKEND_ORIGIN` is set) — [deploy-and-ops.md](./guides/deploy-and-ops.md) (`gcp-runtime-secrets.inc.sh`, `verify-gcp-runtime-secrets.sh`, sync `ops:secrets:sync-desk-smtp:*`). **Current behavior** (portfolio `email`, platform `/admin/delivery-channels` **`email`**, task summaries): [design-system/current-state-features.md](./design-system/current-state-features.md).
- **Outstanding:** Portfolio **`sms`** / **`push`** channel kinds (still skipped). **486n** auth password-reset mail is separate product work.
- ZenBusiness hosted mailbox: SMTP host **`mail.b.hostedemail.com`**; [client setup](https://help.zenbusiness.com/Websites_Domains_Emails/Setting_up_Email/How_Do_I_Set_Up_My_Email_on_My_Phone%2C_Computer%2C_Tablet%2C_or_Other_Device%3F).

---

## Phase 1 — xChat → xStrategyBuilder multi-agent

**Canonical:** [xchat/atx-multi-agent.md](./xchat/atx-multi-agent.md) · [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) · **Routing:** [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md)

Order: **Backend orchestrator** → **LLM + artifact** → **SRE** → **Frontend** → **Reviewer**.

| Chunk | Outstanding |
| ----- | ----------- |
| **1** | **1.3** — Redis hot keys / global API RL beyond OAuth+strategy quota (partial when `REDIS_URL` set; see [spring-redis-memorystore.md](./sre-ops/spring-redis-memorystore.md)). |
| **2** | **2.1–2.4** — Context bundle, async xAI path, artifact v1 validation + error codes, BFF route parity + `backend-http-api-parity` smoke. **Exit:** stable `jobId` / `correlationId`; documented failure codes. |
| **3** | Env matrix, observability (correlation/job/persona/model, no raw PII), queue if p95 > SLO, per-tenant RL at orchestrator. |
| **4** | xStrategyBuilder: poll/push status, artifact UI, deep link `jobId`; optional xChat start/resume; error UX ↔ backend codes. NL themes above + [nl-prompts.md](./xchat/nl-workflows/nl-prompts.md). |
| **5** | OpenAPI parity, `atxdesign-review-audit` gaps, product doc parity (`xchat-tools-guide.md`, `context-routing-multi-agent-policy.md`). |

**Open question:** [Phase: user_history_agent](#phase-xchat-chat_history-xai-collection-user_history_agent) vs TEAM-only `XAI_TEAM_ID` — reconcile before per-user collection writes.

---

## TEAM-only xAI (legacy path removal)

**Goal:** Drop `userBootstrapCollectionId` and per-user bootstrap where policy is TEAM-only; anchor on `XAI_TEAM_ID` for team KB.

**Remaining:** Linked-collection resolution uses team + persona only; docs match `context-routing-multi-agent-policy.md` + `xchat-tools-guide.md`.

---

## Phase: xChat chat_history → XAI collection (`user_history_agent`)

**Goal:** Scheduled sync `xchat_logs` → user xAI collection for retrieval.

**Remaining:** Align with TEAM-only policy; task runner + admin category; tests with mocked xAI append.

**Audit:** Inference lineage on `xchat_logs`, tamper-evident chain, optional `admin_audit_events` per run — [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md).

---

## Stripe & billing

<a id="stripe-billing-from-frontend-plan"></a>

**Remaining:** Customer portal deep link, `POST /api/webhooks/stripe`, Mongo subscription / plan fields, `getPlanLimits()` gating from paid tier. Setup: [stripe-billing-setup.md](./sre-ops/stripe-billing-setup.md) · limits matrix: [atx-limits.txt.tsv](./resouces/atx-limits.txt.tsv).

---

## SRE / platform gaps

**Baseline:** BFF registry `[bff-proxy-routes.ts](../src/lib/bff-proxy-routes.ts)` + `tests/unit/bff-proxy-registry-next-handlers.test.ts`; JVM `./gradlew test` in `services/atxfinance-backend`; deploy: `.github/workflows/deploy-cloud-run.yml`, `AGENTS.md`.

### Deploy reliability (GH-first)

- Async `gcloud builds submit` + `gcloud builds describe` polling (avoid log-stream permission false failures).
- Fail only on terminal non-success; always print Build id + log URL.
- Post-deploy: staging custom domain + Cloud Run `status.url` must match app version (catch routing/cache drift).
- Fallback: `scripts/ops/deploy-cloud-run-from-env.sh`; prefer immutable image promotion when skipping rebuild.

### BFF / consolidation (intentionally Next-only for now)

- xChat `/api/xchat/*` — deferred per [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md).
- Persona governance extensions (publish, archive, rollback, versions, xAI collection helpers) — Next until moved to Spring.
- Admin `PATCH/DELETE …/positions/{positionId}` — Next until registry + Kotlin parity.
- Most auth routes Next; optional Google callback proxy for dual-run.

**Ops:** With Spring enabled, set **`ATXFINANCE_BACKEND_ORIGIN`** to the backend **HTTPS** origin (no `:8080` on public hostnames; see `.cursor/agents/sre.md` / deploy workflows). Unset ⇒ Next-only (avoid split-brain writes). **Reviewer:** infra PRs that touch desk SMTP or BFF — cross-check [deploy-and-ops.md](./guides/deploy-and-ops.md) and `.cursor/agents/reviewer.md` (Secret Manager + `gcp-runtime-secrets.inc.sh` alignment).

---

## Deferred (larger lifts)

- xChat streaming on Spring + BFF (`api-consolidation-spring-backend.md`).
- Strict JSON Schema for strategy artifacts v2 (`atx-multi-agent.md`).
