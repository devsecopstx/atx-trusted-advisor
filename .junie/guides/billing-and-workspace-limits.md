# Billing and workspace limits

Scope:
- Billing page: `src/app/account/billing/page.tsx` + `billing-plan-grid.tsx`
- Pricing/tiers: `src/lib/atx-billing-plans.ts`
- Limits merge + display: `src/lib/billing-plan-workspace-display.ts`
- Tenant source of truth: `src/modules/identity/tenant-workspace-limits.ts`
- Helpers: `src/lib/tenant-workspace-limits.ts`, `src/modules/identity/repository.ts` (resolve default tenant)

Key behavior:
- Unauthenticated (guest): resolve the system default tenant via `resolveTenantIdHexForGlobalAdminConsole` and display prices/limits from DB (planOverrides when set) — no hardcoded drift.
- Authenticated: use the session tenant; effective limits combine tenant base + tier overrides.
- Stripe: `getStripePublishableKey`, `isStripeCheckoutConfiguredForTenant`; checkout button hidden if not configured.

Troubleshooting:
- If guests see $9/$99/$299 while admin defaults show different numbers, ensure guest path resolves a tenant and `normalizePlanOverridesFromUnknown` is applied.
- When hourly limits show Unlimited unexpectedly, confirm `userChatHourlyLimit` semantics (0/undefined = unlimited).

References:
- Admin limits panel: `src/app/admin/tenant-preferences/ui/tenant-workspace-limits-panel.tsx`
- Docs: `atx-docs/sre-ops/stripe-billing-setup.md`, `atx-docs/guides/auth-and-access.md`
