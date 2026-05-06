# aTx AI Advisor — Rentable xAI Finance API (agent / MCP handoff)

**Version:** 1.0 (Phase 1 API)

**Provider:** aTx Finance (xfinance monorepo — Next.js core app)

**Type:** White-labeled, tenant-isolated Grok-powered options-aware advisor **HTTP API** (MCP-style distribution: document this file + OpenAPI for tool schema; wire tools to the routes below).

**Target users:** RIAs, family offices, HNWI desks, independent advisors (via their own product or agent mesh).

**Canonical system prompt (seed + bias blocks + chat precedence):** [`atx-docs/guides/rental-ai-system-prompt.md`](./guides/rental-ai-system-prompt.md)

**Partner marketing page (spec, `/ai-rent`):** [`atx-docs/design-system/ai-rent-landing-spec.md`](./design-system/ai-rent-landing-spec.md)

---

## Overview

Rent a **logically isolated** branded workspace: dedicated `rentalProfile`, hashed API keys on `core_tenants.apiKeys`, optional `tenantPreferences` branding for the product shell, and a **published** rental persona (`rental-ai-advisor-<tenantSlug>`) with **conservative / balanced / aggressive** strategy bias.

---

## Core capabilities (HTTP)

| Capability | Method & path | Notes |
|------------|----------------|-------|
| **Chat** | `POST /api/ai/rent/chat` | Natural language options context, portfolio-aware snapshot, **`strategyBias`** injected. **JSON** (`200`) or **SSE** (`Accept: text/event-stream` or `"stream": true`) — OpenAI-style `chat.completion.chunk` deltas + `[DONE]`. |
| **Strategy job** | `POST /api/ai/rent/strategy` | Body: `symbols[]`, optional `portfolioId`, `notes`. **`202`** with `jobId` + `pollUrl`. **`GET /api/ai/rent/strategy?jobId=`** returns status + `result` (MVP materialization — see runbook). |
| **Analyze job** | `POST /api/ai/rent/analyze` | Body: optional `jobId`, `deepRun`. Same **`202` + GET poll** pattern as strategy. |

---

## Authentication

- **Per-tenant API keys** (plaintext shown only at mint time — admin delivery path is backlog).
- **Header:** `Authorization: Bearer atxr_<16-hex id>_<64-hex secret>`
- **Scopes:** each key has `chat`, `strategy`, and/or `analyze`; routes enforce the matching scope.
- **Tenant binding:** resolver loads `core_tenants` by key id; all data and jobs are scoped to that tenant.

*Legacy or alternative header names (e.g. `x-rental-api-key`) are **not** supported in Phase 1.*

---

## Key features & guardrails

| Area | Behavior |
|------|-----------|
| **Risk posture** | Default bias **conservative** when using spec defaults; `balanced` / `aggressive` per `rentalProfile.strategyBias`. |
| **Daily token budget** | Default **200,000** tokens / UTC day (`maxDailyTokens`); chat increments `rental_ai_token_usage` + mirror buckets; failed guardrails do not burn tokens. |
| **Security** | Tenant isolation, safety headers, distributed rate limits when Redis configured, in-process concurrency cap (**8**/tenant in MVP — Redis semaphore backlog for strict multi-instance fairness). |
| **Branding** | Display via `tenantPreferences` (accent, logo, tagline, etc.) on the core app; rental **API** responses are JSON/SSE, not HTML chrome. |
| **Data sources** | Yahoo-backed quotes via xChat tools; workspace snapshot from tenant sample user / portfolio; persona RAG when enabled on the rental persona. Optional IBKR snapshots apply to connected **app_user** flows — rental chat uses the **sample** workspace unless an owned `portfolioId` is supplied and valid in scope. |
| **Audit** | `admin_audit_events` with `entityType: rental_ai`, `actor.userId: rental_key:<key id>`, route actions such as `rental_ai_chat_request`, `rental_ai_strategy_request`, etc. |
| **Pricing (internal)** | **~$99/mo** base + **~$0.0008 / 1k tokens** overage documented for operations — **not** auto-reported to Stripe until billing phase ships — see **`atx-docs/sre-ops/rental-ai-platform.md`**. |

---

## Integration example — chat (JSON)

```http
POST /api/ai/rent/chat
Authorization: Bearer atxr_<keyId>_<secret>
Content-Type: application/json

{
  "message": "Outline a conservative wheel-style income plan on NVDA given my workspace snapshot.",
  "portfolioId": "507f1f77bcf86cd799439011",
  "stream": false
}
```

**Success (shape):** `ok`, `correlationId`, `tenantSlug`, `data.response` (markdown), `data.model`, `data.usage` (xAI usage fields when present). **Headers:** `x-rental-tokens-used`, `x-rental-tokens-remaining`.

---

## MCP / A2A publishing metadata

**System prompt (handoff summary):**  
You are a white-labeled **xFinance rental advisor** for one tenant workspace. Keep answers concise, institutional, and options-aware. Apply the tenant **strategy bias** (conservative by default). State clearly that outputs are **not financial advice** and never claim access to private order flow. Prefer defined-risk language for conservative bias.

**Tool / schema source:** OpenAPI 3.1 inventory — `GET /api/openapi` — filter tag **`rental-ai`**.

**Rate limits:** Per-tenant (and global rental limits where configured).

**Models:** Default persona model **`grok-4-1-fast-reasoning`** when no `xaiModelOverride`; tenant may set override in `rentalProfile`.

**Vision:** Not a dedicated rental contract in v1; parity with core xChat vision is product backlog.

---

## Onboarding / rental flow

1. Define **`tenant.rentalProfile`** in YAML (tier, `expiresAt`, bias, limits) — see **`tenant-specs/README.md`**.
2. `npm run seed:tenant -- --file tenant-specs/<slug>.yaml` — provisions rental persona + sample portfolio/watchlist.
3. Mint keys: **`npm run ops:rental:mint-key -- --tenant=<slug>`** (or `node --env-file=.env.prod --import tsx scripts/ops/mint-rental-api-key.ts --tenantId=…`) — prints **`atxr_*` once**; only **`keyHash`** is stored in Mongo. See **`atx-docs/sre-ops/rental-ai-platform.md`** § Minting API keys. **Admin console UX** for list/revoke is backlog **`PLAN.md` #41**.
4. Integrate via **raw HTTPS** to the Next deployment origin (`POST`/`GET` above).

---

## Docs & support

| Resource | Location |
|----------|----------|
| **Operator runbook** | [`atx-docs/sre-ops/rental-ai-platform.md`](./sre-ops/rental-ai-platform.md) |
| **LLM index (short)** | Repo root [`llm.txt`](../llm.txt) |
| **Integration tests** | `tests/integration/rental-ai-routes.test.ts` |
| **OpenAPI** | `/api/openapi` · `/admin/api-docs` |

**Status:** Phase 1 **execution paths live** (chat JSON + SSE, strategy/analyze poll, metering, audit). **Next:** Stripe-linked expiry, admin key UX, optional embed/CORS allow-list — see **`atx-docs/PLAN.md`**.
