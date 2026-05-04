# Rental AI platform (white-label API)

**Status:** Phase 1 — tenant model, provisioning, **`POST /api/ai/rent/*`** stubs with **API key auth**, rate limits, concurrency cap (single-instance), daily token budget gate, audit hooks (`admin_audit_events.entityType` **`rental_ai`**). xChat / strategy-engine execution bridges ship incrementally without breaking HNWI session flows.

## Tenant fields (`core_tenants`)

| Field | Purpose |
|--------|---------|
| `rentalProfile` | Tier metadata: `tier`, `strategyBias` (`conservative` \| `balanced` \| `aggressive`), `maxPortfolios`, `maxDailyTokens`, optional `xaiModelOverride`, `expiresAt`, `apiKeyEnabled`, optional `defaultPersonaId` (set by `seed:tenant` / provisioning). |
| `rentalExpiresAt` | Sparse-indexed copy of `rentalProfile.expiresAt` for suspension scheduling queries. |
| `rentalAiApiKeys` | Hashed keys (`keyHash` scrypt per `hashPassword`), `id` (16-hex segment), `scopes[]` (`chat` \| `strategy` \| `analyze`), optional `label`, timestamps. **Never log plaintext keys.** |

## YAML (`tenant.rentalProfile`)

Validated by `parseTenantRentalProfile` / `tenant-spec-v1-parse.ts` (mirrors `scripts/lib/tenant-spec-schema.mjs` comments for generator). Defaults: `strategyBias` **conservative**, `maxPortfolios` **3**, `maxDailyTokens` **100000**, `apiKeyEnabled` **true**. **`tier`** and **`expiresAt`** are required when `rentalProfile` is present.

On `npm run seed:tenant`, a **published** rental persona is upserted (`nameNormalized`: `rental-ai-advisor-<slug>`) and `defaultPersonaId` + `rentalExpiresAt` are written.

## API surface

- **`POST /api/ai/rent/chat`** — scope **`chat`** (stub **501** after guardrails).
- **`POST /api/ai/rent/strategy`** — scope **`strategy`** (stub **501**).
- **`POST /api/ai/rent/analyze`** — scope **`analyze`** (stub **501**).

**Auth:** `Authorization: Bearer atxr_<16-hex id>_<64-hex secret>` (minted by future admin tooling; structure enforced in `rental-ai-auth.ts`).

**Limits:** `checkDistributedRateLimit` (Redis when configured), max **8** concurrent requests per tenant (in-process map — replace with Redis semaphore when multi-instance enforcement is required), Mongo **`rental_ai_token_usage`** for UTC-day token totals vs `maxDailyTokens`.

**Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`; **429** responses include rate-limit hints where applicable.

**Route timeout:** `maxDuration = 45` on rental routes.

## TTL / expiry

Mongo **TTL indexes are not applied to `core_tenants`**: TTL deletion would remove tenant rows and orphan memberships. Use **`rentalExpiresAt` + workers** for soft/hard suspend; optional future ephemeral collections may use TTL separately.

## Stripe / metering

Tier → Stripe price mapping and webhook-driven lifecycle are **backlog**; `rentalProfile.tier` is the integration anchor.

## Audit

Rows use **`entityType: rental_ai`**, **`entityId`**: tenant ObjectId hex, **`actor.userId`**: `rental_key:<key id>`, **`details`**: `correlationId`, optional `tokensUsed`, route-specific metadata.
