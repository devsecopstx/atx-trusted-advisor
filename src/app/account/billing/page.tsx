import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";

import { BillingPlanGrid } from "@/app/account/billing/billing-plan-grid";
import { AtxBillingPortalButton } from "@/app/account/ui/atx-billing-portal";
import { BillingFeedbackLink } from "@/app/account/ui/billing-feedback-link";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import {
    parseAccessRequestPlanInput,
    type AccessRequestPlanValue
} from "@/lib/access-request-plans";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { getStripePublishableKey, isStripeCheckoutConfiguredForTenant } from "@/lib/stripe-config";
import {
    resolveEffectivePlanOverridesForTenant,
    resolveWorkspaceLimitsRuntimeTenant
} from "@/lib/tenant-workspace-limits";
import { canUserLogin } from "@/modules/identity/authorization";
import { getCoreUserById, resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

import "./billing-plans.css";

export const dynamic = "force-dynamic";

export default async function AccountBillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  if (approved && session) {
    const routeGuard = await resolveRouteGuardForSessionPath(session, "/account/billing");
    if (!routeGuard.allowed) {
      redirect(routeGuard.redirectPath);
    }
  }
  const guestReadonly = !approved;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;

  const sp = (await searchParams) ?? {};
  const checkout = typeof sp.checkout === "string" ? sp.checkout : undefined;
  const selectedGuestPlanRaw = typeof sp.plan === "string" ? sp.plan : undefined;
  const openRegisterRaw = typeof sp.register === "string" ? sp.register : undefined;
  const openRegisterByDefault = openRegisterRaw === "1" || openRegisterRaw === "true";
  const guestRegisterDefaultPlan: AccessRequestPlanValue =
    parseAccessRequestPlanInput(selectedGuestPlanRaw) ?? "basic";

  const defaultTenantId = await resolveTenantIdHexForGlobalAdminConsole(undefined);
  let tenant = approved && session?.tenantId ? await getTenantByHexIdCached(session.tenantId) : null;
  const defaultTenant =
    defaultTenantId && (!tenant || defaultTenantId !== session?.tenantId)
      ? await getTenantByHexIdCached(defaultTenantId)
      : tenant;
  if (!tenant) {
    tenant = defaultTenant;
  }
  const planOverridesForStripe = await resolveEffectivePlanOverridesForTenant(tenant);
  const tenantForBillingDisplay = await resolveWorkspaceLimitsRuntimeTenant(tenant);
  const checkoutReady =
    !guestReadonly && isStripeCheckoutConfiguredForTenant(planOverridesForStripe);
  const publishableConfigured = Boolean(getStripePublishableKey());
  const checkoutBanner =
    checkout === "success"
      ? {
          className: "billing-banner billing-banner--ok",
          message:
            "Checkout completed — thank you. It may take a minute for entitlements to sync once webhooks are wired."
        }
      : checkout === "canceled"
        ? {
            className: "billing-banner billing-banner--muted",
            message: "Checkout canceled — no charge. Pick a plan below when you're ready."
          }
        : null;

  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Billing",
        railVariant: "workspace-product"
      })
    : null;

  const coreUser =
    approved && session?.userId && ObjectId.isValid(session.userId)
      ? await getCoreUserById(new ObjectId(session.userId))
      : null;
  const hasStripeCustomer = Boolean(coreUser?.stripeCustomerId?.trim());

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current={null} feedbackPageLabel="Billing" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body portfolio-page-body">
        {approved && session ? (
          <AppUserCollapsibleRailLayout
            mainClassName="app-user-shell-with-rail--padded"
            rail={workspaceProductRail}
            railChrome="workspace-product"
          >
            <div className="billing-page">
              <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__eyebrow">ATX price plans</p>
                <h1 className="billing-hero__title">Account &amp; billing</h1>
                <p className="billing-hero__copy">
                  Choose a plan for <strong className="text-[var(--xf-gain-green)]">aTx Trusted Advisory</strong>. Billing
                  runs on Stripe. Workspace limits below reflect your tenant (and per-plan overrides when set), including
                  xChat <strong>UTC day</strong> and <strong>UTC hour</strong> caps per user.
                </p>
              </header>

              {checkoutBanner ? (
                <div className={checkoutBanner.className} role="status">
                  {checkoutBanner.message}
                </div>
              ) : null}

              {!checkoutReady ? (
                <div className="billing-banner billing-banner--muted" role="status">
                  Checkout isn&apos;t available in this environment yet — the plans below show list pricing;{" "}
                  <BillingFeedbackLink>Submit feedback</BillingFeedbackLink> if you need help with access or billing.
                </div>
              ) : null}

              {checkoutReady && !publishableConfigured ? (
                <div className="billing-banner billing-banner--muted">
                  <strong>Note:</strong> Add{" "}
                  <code className="font-mono text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (GCP Secret Manager, synced
                  from your env file) for future in-app Elements; server checkout still works.
                </div>
              ) : null}

              {hasStripeCustomer ? (
                <div className="billing-portal-row">
                  <AtxBillingPortalButton checkoutReady={checkoutReady} hasStripeCustomer />
                </div>
              ) : null}

              <BillingPlanGrid
                tenant={tenantForBillingDisplay}
                approved={approved}
                checkoutReady={checkoutReady}
              />

              <p className="billing-footnote">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Trial access is time-limited;
                subscribe to keep full access at the plan you choose. Card processing and receipts are handled by Stripe.
                For access or invoice issues, contact your workspace admin. You agree to use aTx Trusted Advisory lawfully
                and in line with applicable rules and our terms. Share thoughtful, meaningful product feedback when
                something misses the mark.{" "}
                {guestReadonly ? "Sign in to submit feedback." : <BillingFeedbackLink>Submit feedback</BillingFeedbackLink>}
              </p>
            </div>
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell
            googleLoginHref={googleLoginHref}
            openRegisterByDefault={openRegisterByDefault}
            rail={workspaceProductRail ?? undefined}
            registerDefaultPlan={guestRegisterDefaultPlan}
          >
            <div className="billing-page">
              <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__eyebrow">ATX price plans</p>
                <h1 className="billing-hero__title">Account &amp; billing</h1>
                <p className="billing-hero__copy">
                  Select a plan, then continue with Register for access. Basic is the default selection. Limits below are
                  core workspace defaults (xChat <strong>UTC day</strong> and <strong>UTC hour</strong> rows); signed-in users see
                  tenant-resolved caps.
                </p>
              </header>
              <BillingPlanGrid tenant={tenantForBillingDisplay} approved={false} checkoutReady={false} />
              <p className="billing-footnote">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Guest mode is read-only. Sign in
                for approved access to checkout and account actions.
              </p>
            </div>
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
