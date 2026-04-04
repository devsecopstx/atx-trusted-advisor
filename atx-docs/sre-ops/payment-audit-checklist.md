# Post-Payment Audit Checklist (Stripe -> webhook -> entitlement)

Use this checklist after a paid checkout to confirm end-to-end success and capture operator evidence.

## Run metadata

- Date/time (UTC):
- Operator:
- Environment: `staging` | `production`
- User email:
- Expected plan after payment: `premium` | `premium_plus`

---

## 1) Stripe webhook delivery

Stripe Dashboard -> Webhooks -> `<endpoint>`

- [ ] `checkout.session.completed` delivered (`2xx`)
- [ ] `customer.subscription.updated` (or `customer.subscription.created`) delivered (`2xx`)
- [ ] `customer.subscription.deleted` not unexpectedly triggered

Record:

- checkout event id (`evt_...`):
- subscription update event id (`evt_...`):
- endpoint response codes:

---

## 2) Cloud Run webhook logs

Filter logs by text: `[webhooks/stripe]`

Expected lines:

- [ ] `received { id, type }`
- [ ] `handled checkout.session.completed { ..., updated: true }`
- [ ] `handled customer.subscription.updated { ..., updated: true }`

Must NOT see:

- [ ] `Invalid Stripe signature`
- [ ] `ignored ... missing_user_id`
- [ ] `ignored ... unmapped_plan`
- [ ] `Stripe webhook handling failed`

Capture:

- log timestamp(s):
- service revision:
- snippet(s):

---

## 3) DB state (source of truth)

Check `core_users` row for target user.

- [ ] `subscriptionPlan` moved from `basic` -> expected paid tier
- [ ] `updatedAt` timestamp aligns with webhook delivery time

Capture:

- user id:
- previous plan:
- current plan:
- updatedAt:

---

## 4) Product entitlement smoke

Sign in as the paid user:

- [ ] `/account/billing` shows paid plan state
- [ ] xChat / xOptions behavior reflects paid-tier limits
- [ ] No access regressions or forced downgrade prompts

Capture:

- pages checked:
- observed limits/features:

---

## 5) Lock-in evidence (required)

Attach to release/ops notes:

- [ ] Stripe event IDs
- [ ] webhook handled log snippet
- [ ] DB `subscriptionPlan` confirmation
- [ ] entitlement UI confirmation

Decision:

- [ ] PASS (flow locked)
- [ ] FAIL (open incident)
- Incident link (if fail):

---

## Quick triage map

- `Invalid Stripe signature` -> wrong `STRIPE_WEBHOOK_SECRET` mounted in Cloud Run.
- `missing_user_id` -> checkout/subscription metadata missing `atx_user_id`.
- `unmapped_plan` -> `price_...` mismatch vs `STRIPE_PRICE_*` config.
- Stripe delivered but no logs -> wrong endpoint URL or wrong service target.
- Logs show handled, DB unchanged -> verify DB target (`MONGODB_URI`) and user id resolution.

