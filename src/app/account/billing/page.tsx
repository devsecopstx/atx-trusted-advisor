import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";

import { BillingGuestExperience } from "@/app/account/billing/billing-guest-experience";
import { BillingPlanGrid, buildBillingPlanCardPayloads } from "@/app/account/billing/billing-plan-grid";
import { AtxBillingPortalButton } from "@/app/account/ui/atx-billing-portal";
import { BillingFeedbackLink } from "@/app/account/ui/billing-feedback-link";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { BillingAccessStateBanner } from "@/app/ui/billing-access-state-banner";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
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
  const sp = (await searchParams) ?? {};
  const checkout = typeof sp.checkout === "string" ? sp.checkout : undefined;
  const selectedGuestPlanRaw = typeof sp.plan === "string" ? sp.plan : undefined;
  const openRegisterRaw = typeof sp.register === "string" ? sp.register : undefined;
  const openRegisterByDefault = openRegisterRaw === "1" || openRegisterRaw === "true";
  const guestRegisterDefaultPlan: AccessRequestPlanValue =
    parseAccessRequestPlanInput(selectedGuestPlanRaw) ?? "basic";
  const registrationFirst = openRegisterByDefault || typeof selectedGuestPlanRaw === "string";
  /** Post-auth always lands on the product surface — no quick-setup detour. */
  const postAuthLandingPath = "/xchat";

  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(postAuthLandingPath)}`
    : null;
  const guestXOAuthLoginHref = `/api/auth/x/login?next=${encodeURIComponent(postAuthLandingPath)}`;
  const guestEmailLoginHref = `/login?next=${encodeURIComponent(postAuthLandingPath)}`;

  const defaultTenantId = await resolveTenantIdHexForGlobalAdminConsole(undefined);
  const sessionTenantId = session?.tenantId?.trim() ?? "";
  /** Signed-in guests (e.g. pending approval) still carry `tenantId` — use it for list pricing + limits like approved users. */
  let tenant =
    sessionTenantId.length > 0 ? await getTenantByHexIdCached(sessionTenantId) : null;
  const defaultTenant =
    defaultTenantId && (!tenant || defaultTenantId !== sessionTenantId)
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
  const billingGuestCards = buildBillingPlanCardPayloads(tenantForBillingDisplay);

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

  const workspaceProductRail = approved && session
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

      <div
        className={
          approved
            ? "xchat-body portfolio-page-body flex min-h-0 flex-1 flex-col overflow-hidden"
            : "xchat-body portfolio-page-body flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        }
      >
        {approved && session ? (
          <AppUserCollapsibleRailLayout
            mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain min-w-0 w-full max-w-full"
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

              <BillingAccessStateBanner persistentDismissIdentity={session.email} />

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
          <main className="app-user-shell-with-rail--padded min-h-full w-full">
            <div className="billing-page">
              <header className="billing-hero billing-hero--guest-note xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__copy billing-hero__copy--compact">
                  <strong className="text-[var(--xf-text-100)]">Basic trial</strong> is selected by default — no card on
                  this step. Limits shown below are core workspace defaults (xChat <strong>UTC day</strong> and{" "}
                  <strong>UTC hour</strong> caps); signed-in users see tenant-resolved caps.
                </p>
              </header>

              <BillingGuestExperience
                cards={billingGuestCards}
                emailPasswordLoginHref={guestEmailLoginHref}
                googleLoginHref={googleLoginHref}
                initialPlan={guestRegisterDefaultPlan}
                scrollToFormOnMount={registrationFirst}
                xOAuthLoginHref={guestXOAuthLoginHref}
              />

              <p className="billing-footnote">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Guest mode is read-only. Sign in for
                approved access to checkout and account actions.
              </p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
