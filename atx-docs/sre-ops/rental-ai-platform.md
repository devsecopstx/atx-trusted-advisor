# Rental AI platform (white-label API)

**Status:** Phase 1 — **execution paths live** on Next (`/api/ai/rent/*`): Bearer API keys, scopes, distributed rate limits, in-process concurrency cap (**8**/tenant; Redis semaphore backlog for multi-instance), UTC-day token budget vs **`rentalProfile.maxDailyTokens`**, audit **`admin_audit_events`** (`entityType` **`rental_ai`**). **Billing:** base **$99/mo** + **$0.0008 / 1k tokens** overage is **documented / internal metering only** until Stripe Meters ship — mirror notes on invoices; do not auto-report usage to Stripe yet.

## Tenant fields (`core_tenants`)

| Field | Purpose |
|--------|---------|
| `rentalProfile` | Tier metadata: `tier`, `strategyBias` (`conservative` \| `balanced` \| `aggressive`), `maxPortfolios`, `maxDailyTokens` (default **200000** when parsed via `parseTenantRentalProfile`), optional `xaiModelOverride`, `expiresAt`, `apiKeyEnabled`, optional `defaultPersonaId`, optional `sampleUserId` / `samplePortfolioId` (sample workspace for rental chat context). |
| `rentalExpiresAt` | Sparse-indexed copy of `rentalProfile.expiresAt` for suspension scheduling queries. |
| `apiKeys` | Hashed rental integration keys (`keyHash` scrypt via `hashPassword` / `verifyPassword`), `id` (16-hex segment inside `atxr_*` prefix), `scopes[]` (`chat` \| `strategy` \| `analyze`), optional `label`, timestamps. **Never log plaintext keys.** |

Legacy docs may reference **`rentalAiApiKeys`** — field name is **`apiKeys`** (migration complete in app code + seed indexes).

## YAML (`tenant.rentalProfile`)

Validated by `parseTenantRentalProfile` / `tenant-spec-v1-parse.ts` (mirrors `scripts/lib/tenant-spec-schema.mjs` comments for generator). Defaults when omitted: `strategyBias` **conservative**, `maxPortfolios` **3**, `maxDailyTokens` **200000**, `apiKeyEnabled` **true**. **`tier`** and **`expiresAt`** are required when `rentalProfile` is present.

On `npm run seed:tenant`, a **published** rental persona is upserted (`nameNormalized`: `rental-ai-advisor-<slug>`), `defaultPersonaId` + `rentalExpiresAt` are written, and a **sample portfolio** + watchlist (**TSLA**, **SPY**, **AAPL**) is provisioned under a synthetic **`sampleUserId`** (`rental-sample:<slug>`).

## API surface

**Auth:** `Authorization: Bearer atxr_<16-hex id>_<64-hex secret>` (structure enforced in `rental-ai-auth.ts`).

### Minting API keys (ops)

**You cannot “look up” a lost key** — Mongo only stores `keyHash`. If a partner loses the secret, mint a new key (or delete the old `apiKeys` element) and revoke the old id in your records.

**Script (recommended):** from repo root with **`MONGODB_URI`** pointed at the target cluster (e.g. `--env-file=.env.prod`):

```bash
npm run ops:rental:mint-key -- --tenant=<tenant-slug>
# or
node --env-file=.env.prod --import tsx scripts/ops/mint-rental-api-key.ts --tenantId=<24-hex-tenant-id>
# optional: --scopes=chat,strategy,analyze  --label=partner-prod
```

The script prints `export KEY='atxr_…'` **once**; store it in a secrets manager / vault, not in chat logs.

**Admin UI:** mint/list/revoke for `core_tenants.apiKeys` is backlog (**`PLAN.md`** #41) — script + Mongo are the supported paths today.

### Chat

- **`POST /api/ai/rent/chat`** — scope **`chat`**. Body: `{ message, portfolioId?, stream? }`. Runs **`respondWithXaiToolLoop`** with rental persona + **`strategyBias`** + tenant workspace snapshot (**`portfolioId`** override or provisioned sample portfolio). **Non-streaming:** `200` JSON (`data.response`, `data.usage`). **Streaming:** `Accept: text/event-stream` **or** `stream: true` → SSE with OpenAI-style **`chat.completion.chunk`** deltas + **`[DONE]`**.

### Strategy & analyze (async materialization)

- **`POST /api/ai/rent/strategy`** — scope **`strategy`**. Body: `{ symbols[], portfolioId?, notes? }`. Returns **`202`** `{ jobId, pollUrl }`; persists row in **`rental_ai_jobs`** (status **`completed`** in DB today — poll returns payload immediately suitable for MVP demos).
- **`GET /api/ai/rent/strategy?jobId=`** — same scope; returns job **`status`**, **`result`**, timestamps.
- **`POST /api/ai/rent/analyze`** — scope **`analyze`**. Body: `{ jobId?, deepRun? }`. **`202`** + poll URL pattern as strategy.
- **`GET /api/ai/rent/analyze?jobId=`** — same scope; job lookup.

**Limits:** `checkDistributedRateLimit` (Redis when configured), max **8** concurrent requests per tenant (in-process — replace with Redis semaphore when strict multi-instance fairness is required).

**Token metering:** Each chat completion increments **`rental_ai_token_usage`** (UTC day) and **`xchat_usage_limits`** rows keyed **`rental_tokens_day:<tenantHex>:<yyyy-mm-dd>`** with **`rentalTokensUsed`**. Failed guardrails do not burn tokens.

**Response headers (chat success):** `x-rental-tokens-used`, `x-rental-tokens-remaining` (after increment).

**Safety headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`; **429** responses include rate-limit hints where applicable.

**Route timeout:** `maxDuration = 45` on rental routes.

## TTL / expiry

Mongo **TTL indexes are not applied to `core_tenants`**: TTL deletion would remove tenant rows and orphan memberships. Use **`rentalExpiresAt` + workers** for soft/hard suspend; optional future ephemeral collections may use TTL separately. **`rentalProfile.expiresAt` in the past** ⇒ **`403`** `rental_expired`.

## Stripe / configuration

Rental **Product** and **Price** ids and the billing gate flag are **plain Cloud Run environment variables** (same pattern as `STRIPE_PRICE_BASIC_MONTHLY`), not Secret Manager — unless your org policy requires GSM.

| Variable | Purpose |
|----------|---------|
| **`RENTAL_AI_PRODUCT_ID`** | Stripe Product (`prod_…`). |
| **`RENTAL_BASE_PRICE_ID`** | Recurring Price (`price_…`) for rental base fee. |
| **`ENABLE_RENTAL_AI_BILLING`** | `true` / `false` — gate Checkout when wired in app. |
| **`STRIPE_PRICE_RENTAL_AI_MONTHLY`** | Legacy fallback for price id if `RENTAL_BASE_PRICE_ID` is unset. |

**Deploy:** values in **`.env.prod`** are picked up by **`npm run ops:deploy:cloud-run:production`** (`scripts/ops/deploy-cloud-run-from-env.sh`). For **GitHub Actions** deploys, add repository **Variables**: `RENTAL_AI_PRODUCT_ID`, `RENTAL_BASE_PRICE_ID`, `ENABLE_RENTAL_AI_BILLING`.

**Immediate update (no full redeploy from repo):** merge into the existing service (adjust service name, region, project):

```bash
gcloud run services update "${CLOUD_RUN_SERVICE_PROD}" \
  --region "${CLOUD_RUN_REGION}" \
  --project "${GOOGLE_PROJECT_ID}" \
  --update-env-vars "RENTAL_AI_PRODUCT_ID=prod_...,RENTAL_BASE_PRICE_ID=price_...,ENABLE_RENTAL_AI_BILLING=true"
```

Use **`--update-env-vars`** (merges keys). Do **not** use **`--set-env-vars`** alone unless you pass the full env map — it can replace all literals.

Webhook handlers should extend subscription lifecycle to **`rentalExpiresAt`** when the rental SKU is integrated (**backlog**).

### Deployment checklist (operator)

1. **Tenant:** `tenant.rentalProfile` present with valid **`tier`**, **`expiresAt`**; optional keys pre-hashed on `core_tenants.apiKeys` with scopes. Run **`npm run seed:tenant`** for persona + sample book, or apply via admin/ops.
2. **Secrets:** `XAI_API_KEY` (chat path), **`MONGODB_URI`**, optional **`REDIS_URL`** for distributed rental rate limits. Never log plaintext **`atxr_*`** keys.
3. **Stripe (rental SKU):** set **`RENTAL_AI_PRODUCT_ID`**, **`RENTAL_BASE_PRICE_ID`**, **`ENABLE_RENTAL_AI_BILLING`** as Cloud Run env (see § Stripe / configuration) — not Secret Manager by default; extend webhook handlers to refresh **`rentalExpiresAt`** / subscription state when Checkout ships.
4. **Observability:** `[rental-ai]` logs on guardrail failures; **`admin_audit_events`** **`rental_ai`** for successful chat/strategy/analyze; token headers on chat **`200`**.
5. **Verification:** `tests/integration/rental-ai-routes.test.ts` + manual **`GET /api/openapi`** filter tag **`rental-ai`**.

### Feature flags (planned / naming)

| Flag / env | Intent | Status |
|------------|--------|--------|
| **`ENABLE_RENTAL_AI_BILLING`** | Gate Stripe Checkout + meter reporting for rental SKUs. | Read via `isRentalAiBillingFlagEnabled()` in `src/lib/stripe-config.ts`. Set as plain Cloud Run env (or GitHub Actions **`vars`**), not Secret Manager. |
| **`RENTAL_AI_PRODUCT_ID`** | Stripe Product id (`prod_…`) for rental SKU. | Plain env / **`vars.RENTAL_AI_PRODUCT_ID`**. |
| **`RENTAL_BASE_PRICE_ID`** | Stripe Price id (`price_…`) for rental base fee. | Plain env / **`vars.RENTAL_BASE_PRICE_ID`**. Prefer over legacy **`STRIPE_PRICE_RENTAL_AI_MONTHLY`** (fallback in `getRentalAiStripeBasePriceId()`). |
| **`STRIPE_PRICE_RENTAL_AI_MONTHLY`** | Legacy alias for `RENTAL_BASE_PRICE_ID`. | Optional. |

**Partner / agent docs:** [`atx-docs/MCP-AI-ADVISOR.md`](../MCP-AI-ADVISOR.md) and repo root [`llm.txt`](../../llm.txt).

## Audit

Rows use **`entityType: rental_ai`**, **`entityId`**: tenant ObjectId hex, **`actor.userId`**: `rental_key:<key id>`, **`details`**: `correlationId`, optional `tokensUsed`, route-specific metadata (`jobId`, etc.).

## Collections

| Collection | Role |
|------------|------|
| `rental_ai_token_usage` | UTC-day **`tokensUsed`** per tenant |
| `rental_ai_jobs` | Strategy/analyze poll payloads |
| `xchat_usage_limits` | **`rentalTokensUsed`** mirror bucket (admin observability) |

## Tests

Hermetic integration coverage: **`tests/integration/rental-ai-routes.test.ts`** (auth, scope, expiry, token budget gate, chat JSON/SSE, strategy/analyze **202** + **GET** poll).
