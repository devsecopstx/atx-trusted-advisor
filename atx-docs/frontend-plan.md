# Frontend plan (atxFinance / xFinance)

High-level roadmap for Next.js App Router UI, marketing surfaces, and monetization. **Living doc** — adjust as product scope changes.

**User-facing product chrome (2026):** Signed-in and guest surfaces use **atx Trusted Advisor** with a **whitelabel** subline in the xChat header and global footer; strings live in `src/app/ui/product-brand-constants.ts`. Default xChat **persona** display name **xFinance** remains a separate backend/admin concept — see `atx-docs/atx-xchat/xfinance-branding-review.md` §8.

---

## Pitch / marketing


| Item                                                    | Status  | Notes                                                                                                               |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Reusable pitch `**Hero`** (`src/app/ui/pitch-hero.tsx`) | Shipped | Emerald growth accents, gold/bolt radial overlay, Framer Motion (page fade, staggered bullets, CTA fade-up + hover) |
| xoptions pitch route                                    | Shipped | `app_user/xoptions` — `Hero` from `src/app/ui/pitch-hero.tsx`                                                       |


---

## Stripe integration (planned)

**Goals:** Paid tiers, self-serve upgrade, invoices/receipts, and (optional) trusted-family billing without storing raw card data on our servers.

### Architecture (recommended)

1. **Stripe Checkout** (hosted) or **Embedded Checkout** for first purchase and upgrades — fastest path to PCI-minimal handling.
2. **Customer Portal** (Stripe-hosted) for payment method updates, cancellation, and invoices — link from account/settings when `stripeCustomerId` exists.
3. **Webhooks** on a trusted route (e.g. `POST /api/webhooks/stripe`) with **signature verification** (`STRIPE_WEBHOOK_SECRET`), idempotent processing, and persistence to Mongo (subscription status, `currentPeriodEnd`, invoice ids) via BFF or Next server actions aligned with backend policy.

### Events to handle (minimum)

- `checkout.session.completed` — attach Stripe customer + subscription to app user / tenant.
- `customer.subscription.updated` / `deleted` — sync status for gating features.
- `invoice.paid` / `invoice.payment_failed` — email/alerts and access changes.

### Environment variables (illustrative)


| Variable                                         | Purpose                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`                              | Server-only; API calls                                             |
| `STRIPE_WEBHOOK_SECRET`                          | Verify webhook signatures                                          |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`             | Client only if using Payment Element / Stripe.js                   |
| `STRIPE_PRICE_*` or `NEXT_PUBLIC_STRIPE_PRICE_*` | Price IDs per plan (prefer server-side lookup for sensitive tiers) |


### Frontend work

- Pricing / plan UI aligned with `product-plans` or marketing pages.
- “Manage billing” entry → Customer Portal session (server-created URL).
- Feature gating hooks (client + server) driven by subscription document from API.

### Testing

- Stripe **test mode** keys; [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- Contract tests or integration tests for webhook idempotency and user linking.

### Compliance / product

- Display terms, refund policy, and tax as required; Stripe Tax optional.
- No investment advice checkout copy — billing is for **software access** only.

---

## Related docs

- [PLAN.md](./PLAN.md) — backlog / migrations
- [atx-docs README](./README.md) — **Operations — atx-sre-ops** (BFF / Spring runbooks table)

