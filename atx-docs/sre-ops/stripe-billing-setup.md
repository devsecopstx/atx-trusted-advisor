# Stripe billing setup (ATX plans)

End-to-end notes for **Account → Billing** (`/account/billing`), `POST /api/billing/checkout-session`, and Cloud Run / GitHub configuration.

## Plans (product)

| Plan       | Positioning (summary) | Amount   | Billing   | Env price id                         |
|-----------|------------------------|----------|-----------|--------------------------------------|
| Basic     | HNWI-focused; workspace users, portfolios, accounts (risk & outlook), portfolio scoring factors; plan limits | $9       | Monthly   | `STRIPE_PRICE_BASIC_MONTHLY`         |
| Premium   | Complex portfolios; unlimited with fair per-hour caps on xChat + xStrategyBuilder | $29 | Monthly | `STRIPE_PRICE_PREMIUM_MONTHLY` |
| Premium+  | White-glove; dedicated enterprise-grade instance; private (no training use) | $99    | Yearly    | `STRIPE_PRICE_PREMIUM_PLUS_YEARLY`   |

Create matching **Products** and **Prices** in Stripe (recurring subscription) and copy each Price id (`price_…`) into env. **Amount changes require new Price objects in Stripe** — update `STRIPE_PRICE_*` to the new `price_…` ids (existing ids keep their original amounts).

## GitHub: Variables vs Secrets

| Item | Where | Why |
|------|--------|-----|
| **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** | GitHub **Environment variables** (`staging` / `production`) | Publishable key (`pk_live_…` / `pk_test_…`) is **not** a secret; it is exposed to the browser. Do **not** store it in GitHub **Secrets** unless you accept unnecessary masking. |
| **`STRIPE_PRICE_*`** | Same **Variables** (recommended) | Price ids are identifiers, not credentials. |
| **`STRIPE_SECRET_KEY`** | **GCP Secret Manager** + optional bind (see deploy workflow) | Restricted key or standard secret key — **never** commit or put in Variables. |
| **`STRIPE_WEBHOOK_SECRET`** | Secret Manager (when webhooks ship) | Signing secret for `POST /api/webhooks/stripe` (not implemented in the first slice). |

**Alias:** the app also reads `STRIPE_PUBLIC_KEY` as a fallback for the publishable key (local `.env` convenience). Prefer **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** in Cloud Run so the name matches Next.js conventions.

## GCP Secret Manager

1. Create secret **`STRIPE_SECRET_KEY`** (per project: staging + production) with the Stripe secret key value.
2. Deploy workflows (`deploy-cloud-run.yml`, `deploy-cloud-run-production.yml`) **optionally** attach `STRIPE_SECRET_KEY` to Cloud Run when the secret exists (same pattern as `REDIS_URL`).
3. Grant the runtime service account access to read the secret (deploy SA usually already has bindings if other secrets work).

## Stripe Dashboard checklist

1. **Account mode:** Use **Test** until you are ready for live charges; use test keys and test price ids in non-prod.
2. **Products:** Create three products aligned with Basic / Premium / Premium+ (names can match UI).
3. **Prices:** For each product, add a **recurring** price:
   - Basic: **$9 / month**
   - Premium: **$29 / month**
   - Premium+: **$99 / year**
4. **Checkout:** Hosted Checkout is created by the API (`mode: subscription`). No extra Dashboard toggle required beyond valid prices.
5. **Customer portal (optional):** Enable the Billing customer portal when you want self-serve cancel/update payment method.
6. **Webhooks (next):** Add endpoint `https://<your-host>/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.*`, and verify with `STRIPE_WEBHOOK_SECRET`. Persist subscription tier on `core_users` (or equivalent) to drive plan limits.

## App env summary

```bash
# Optional publishable (browser / future Elements)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Alias supported locally:
# STRIPE_PUBLIC_KEY=pk_test_...

# Server-only (Secret Manager in stage/prod)
STRIPE_SECRET_KEY=sk_test_...

# Price ids (Variables or plain env on Cloud Run)
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_PLUS_YEARLY=price_...
```

## Success / cancel URLs

Checkout success and cancel redirect to `/account/billing?checkout=success` and `?checkout=canceled`. Set **`APP_BASE_URL`** or **`NEXT_PUBLIC_APP_URL`** if the app cannot infer the public origin (see `resolveAppOrigin()` in `src/lib/stripe-config.ts`).

## Compliance copy

Billing UI includes a short **not financial advice** note. Keep Stripe receipts and tax settings in the Stripe Dashboard per your entity.
