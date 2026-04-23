# Stripe billing setup (ATX plans)

End-to-end notes for **Account → Billing** (`/account/billing`), `POST /api/billing/checkout-session`, and Cloud Run / GitHub configuration.

## Plans (product)

| Plan       | Positioning (summary) | Amount   | Billing   | Env price id                         |
|-----------|------------------------|----------|-----------|--------------------------------------|
| Basic     | HNWI-focused; workspace users, portfolios, accounts (risk & outlook), portfolio scoring factors; plan limits | $9       | Monthly   | `STRIPE_PRICE_BASIC_MONTHLY`         |
| Premium   | Complex portfolios; unlimited with fair per-hour caps on xChat + xStrategyBuilder | $99 | Monthly | `STRIPE_PRICE_PREMIUM_MONTHLY` |
| Premium+  | White-glove; dedicated enterprise-grade instance; private (no training use) | $299    | Monthly   | `STRIPE_PRICE_PREMIUM_PLUS_MONTHLY` (fallback: `STRIPE_PRICE_PREMIUM_PLUS_YEARLY`) |

Create matching **Products** and **Prices** in Stripe (recurring subscription) and copy each Price id (`price_…`) into env. **Amount changes require new Price objects in Stripe** — update `STRIPE_PRICE_*` to the new `price_…` ids (existing ids keep their original amounts).

### Billing page vs admin list price

Stripe Checkout charges the **Stripe Price** bound to `STRIPE_PRICE_*`. The **dollar amount shown on `/account/billing`** for each tier can additionally reflect **`workspaceLimits.planOverrides.<tier>.price`** (admin-managed list price for that tenant). Keep Stripe recurring amounts and admin list price in sync when you intend them to match; see `atx-docs/sre-ops/tenant-workspace-limits.md` § App user surfacing. Unit coverage: `tests/unit/billing-plan-workspace-display.test.ts`.

**Workspace limits copy (post-deploy check):** Under each plan card, quota rows follow **`BILLING_WORKSPACE_LIMIT_SPECS`** in `src/lib/billing-plan-workspace-display.ts`: **xOptions views / hr**, **xChat prompts / day (UTC)**, **xChat prompts / hr (UTC)** (hourly shows **Unlimited** when tenant/plan has no hourly cap — `0`/omit), then portfolios/accounts. If labels drift, redeploy a fresh Cloud Run revision or clear local `.next`.

## GitHub: Variables vs Secrets

| Item | Where | Why |
|------|--------|-----|
| **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** | **GCP Secret Manager** (required for Cloud Run) — sync from `.env.stage` / `.env.prod` via `scripts/ops/sync-stripe-publishable-secrets-from-env.sh` or `npm run ops:secrets:sync-stripe-publishable:*` | Same `pk_…` value as before; stored in SM for a single runtime source of truth with other deploy secrets (see `.cursor/rules/sre-gcp-deployment.md`). |
| **`STRIPE_PUBLIC_KEY`** | **GCP Secret Manager** (required) — same sync script; may duplicate the `pk_…` value | Alias read by `getStripePublishableKey()` in `src/lib/stripe-config.ts`. |
| **`STRIPE_PRICE_*`** | GitHub **Environment variables** (`staging` / `production`) | Price ids are identifiers, not credentials. |
| **`STRIPE_SECRET_KEY`** | **GCP Secret Manager** (required for deploy preflight / verify) | Restricted key or standard secret key — **never** commit or put in Variables. |
| **`STRIPE_WEBHOOK_SECRET`** | Secret Manager | Signing secret for `POST /api/webhooks/stripe` (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). |

**Optional:** you may still set **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** / **`STRIPE_PUBLIC_KEY`** as GitHub **Variables** for local tooling; **Cloud Run deploy does not** read them for runtime — Secret Manager bindings supply those env vars.

## GCP Secret Manager

1. Create secrets **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** and **`STRIPE_PUBLIC_KEY`** in each project (staging + production) using values from `.env.stage` / `.env.prod` (use the sync script above).
2. Create secret **`STRIPE_SECRET_KEY`** (per project) with the Stripe secret key value.
3. Deploy workflows and **`ops:secrets:verify:*`** require **`STRIPE_SECRET_KEY`** (with the publishable keys and the rest of the runtime list in `scripts/ops/gcp-runtime-secrets.inc.sh`).
4. Grant the runtime service account access to read the secret (deploy SA usually already has bindings if other secrets work).

## Stripe Dashboard checklist

1. **Account mode:** Use **Test** until you are ready for live charges; use test keys and test price ids in non-prod.
2. **Products:** Create three products aligned with Basic / Premium / Premium+ (names can match UI).
3. **Prices:** For each product, add a **recurring** price:
   - Basic: **$9 / month**
   - Premium: **$99 / month**
   - Premium+: **$299 / month** (UI/list matrix: `atx-limits.txt.tsv`; set `STRIPE_PRICE_PREMIUM_PLUS_MONTHLY`; `STRIPE_PRICE_PREMIUM_PLUS_YEARLY` is still read as a fallback until old Price ids are rotated)
4. **Checkout:** Hosted Checkout is created by the API (`mode: subscription`). No extra Dashboard toggle required beyond valid prices.
5. **Customer portal:** In Stripe Dashboard → **Settings → Billing → Customer portal**, enable the portal (products, subscription cancel, payment method update). After a user completes Checkout, `checkout.session.completed` persists **`core_users.stripeCustomerId`**; **`/account/billing`** then shows **Manage subscription & payment method**, which calls **`POST /api/billing/portal-session`** (same `STRIPE_SECRET_KEY` as Checkout). Return URL is `/account/billing`.
6. **Webhooks:** Add endpoint `https://<your-host>/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`; verify with `STRIPE_WEBHOOK_SECRET`. Handlers update `core_users.subscriptionPlan` and merge **`stripeCustomerId`** when Stripe sends a customer id on the event object.

## App env summary

```bash
# Publishable keys — Secret Manager in stage/prod (sync from .env.stage / .env.prod)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PUBLIC_KEY=pk_test_...   # alias; may match publishable key

# Local dev: same vars in .env; Cloud Run: bound from SM (see deploy workflows)

# Server-only (Secret Manager in stage/prod)
STRIPE_SECRET_KEY=sk_test_...

# Price ids (Variables or plain env on Cloud Run)
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_PLUS_MONTHLY=price_...
# Optional legacy fallback (same Stripe Price id as monthly after migration, or old yearly id during cutover):
# STRIPE_PRICE_PREMIUM_PLUS_YEARLY=price_...
```

## Success / cancel URLs

Checkout success and cancel redirect to `/account/billing?checkout=success` and `?checkout=canceled`. Set **`APP_BASE_URL`** or **`NEXT_PUBLIC_APP_URL`** if the app cannot infer the public origin (see `resolveAppOrigin()` in `src/lib/stripe-config.ts`).

## Compliance copy

Billing UI includes a short **not financial advice** note. Keep Stripe receipts and tax settings in the Stripe Dashboard per your entity.

## Future: multi-provider billing (X Money)

**Today** this doc is Stripe-only. **Roadmap (priority 704):** add **X Money** as a second checkout + webhook provider without breaking existing Stripe subscribers — shared internal billing boundary (checkout creation, webhook verify + idempotency, entitlement writes to `core_users`), new env/Secret Manager entries, and billing UI affordance on `/account/billing`. Full phased plan, test/doc gap list, and zero-downtime rollout notes: [`atx-docs/PLAN.md`](../PLAN.md) § **xMoney & crypto portfolio (704)**.
