import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
import { BillingFeedbackLink } from "@/app/account/ui/billing-feedback-link";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { ATX_BILLING_PLAN_LIMIT_ROWS } from "@/lib/atx-billing-plan-limits";
import { ATX_BILLING_PLANS, type AtxBillingPlanId } from "@/lib/atx-billing-plans";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { getStripePublishableKey, isStripeBillingFullyConfigured } from "@/lib/stripe-config";
import { canUserLogin } from "@/modules/identity/authorization";

import "./billing-plans.css";

export const dynamic = "force-dynamic";

const PLAN_LIMIT_COLUMN_BY_ID = {
  basic: "basic",
  premium_monthly: "premium",
  premium_plus_yearly: "premiumPlus"
} as const;
type PlanLimitItem = {
  metric: string;
  value: string;
};

export default async function AccountBillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const guestReadonly = !approved;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;

  const sp = (await searchParams) ?? {};
  const checkout = typeof sp.checkout === "string" ? sp.checkout : undefined;

  const checkoutReady = !guestReadonly && isStripeBillingFullyConfigured();
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
  const planLimitsByPlanId = ATX_BILLING_PLANS.reduce<Record<AtxBillingPlanId, PlanLimitItem[]>>(
    (acc, plan) => {
      const planLimitKey = PLAN_LIMIT_COLUMN_BY_ID[plan.id];
      const limits = ATX_BILLING_PLAN_LIMIT_ROWS.filter((row) => row.metric !== "Price").map((row) => ({
        metric: row.metric,
        value: row[planLimitKey]
      }));
      acc[plan.id] = limits;
      return acc;
    },
    {
      basic: [],
      premium_monthly: [],
      premium_plus_yearly: []
    }
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="account" feedbackPageLabel="Billing" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body portfolio-page-body">
        {approved && session ? (
          <AppUserCollapsibleRailLayout
            mainClassName="app-user-shell-with-rail--padded"
            rail={<AppUserAccountPublicRailForSession session={session} />}
          >
            <div className="billing-page">
              <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__eyebrow">ATX price plans</p>
                <h1 className="billing-hero__title">Account &amp; billing</h1>
                <p className="billing-hero__copy">
                  Choose a plan for <strong className="text-[var(--xf-gain-green)]">aTx Trusted Advisory</strong>. Billing
                  runs on Stripe.
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

              <div className="billing-grid">
                {ATX_BILLING_PLANS.map((plan) => (
                  <article
                    key={plan.id}
                    className={`billing-card xf-widget${plan.highlight ? " billing-card--highlight" : ""}`}
                  >
                    {plan.highlight ? <span className="billing-card__tag">Popular</span> : null}
                    <h2 className="billing-card__name">{plan.name}</h2>
                    <p className="billing-card__tagline">{plan.tagline}</p>
                    <p className="billing-card__price">{plan.priceLabel}</p>
                    <p className="billing-card__period">{plan.periodNote}</p>
                    <ul className="billing-card__list">
                      {plan.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <div className="billing-card__limits">
                      <p className="billing-card__limits-title">Workspace limits</p>
                      <ul className="billing-card__limits-list">
                        {planLimitsByPlanId[plan.id].map((limit) => (
                          <li key={`${plan.id}-${limit.metric}`}>
                            <span className="billing-card__limits-metric">{limit.metric}</span>
                            <span className="billing-card__limits-value">{limit.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {guestReadonly ? (
                      <button className="billing-checkout-button" disabled type="button">
                        Sign in required
                      </button>
                    ) : (
                      <AtxBillingCheckoutButton planId={plan.id} checkoutReady={checkoutReady} />
                    )}
                  </article>
                ))}
              </div>

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
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref}>
            <div className="billing-page">
              <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__eyebrow">ATX price plans</p>
                <h1 className="billing-hero__title">Account &amp; billing</h1>
                <p className="billing-hero__copy">
                  Read-only pricing preview for guests. Sign in for checkout and account actions.
                </p>
              </header>
              <div className="billing-grid">
                {ATX_BILLING_PLANS.map((plan) => (
                  <article
                    key={plan.id}
                    className={`billing-card xf-widget${plan.highlight ? " billing-card--highlight" : ""}`}
                  >
                    {plan.highlight ? <span className="billing-card__tag">Popular</span> : null}
                    <h2 className="billing-card__name">{plan.name}</h2>
                    <p className="billing-card__tagline">{plan.tagline}</p>
                    <p className="billing-card__price">{plan.priceLabel}</p>
                    <p className="billing-card__period">{plan.periodNote}</p>
                    <ul className="billing-card__list">
                      {plan.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <div className="billing-card__limits">
                      <p className="billing-card__limits-title">Workspace limits</p>
                      <ul className="billing-card__limits-list">
                        {planLimitsByPlanId[plan.id].map((limit) => (
                          <li key={`${plan.id}-${limit.metric}`}>
                            <span className="billing-card__limits-metric">{limit.metric}</span>
                            <span className="billing-card__limits-value">{limit.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button className="billing-checkout-button" disabled type="button">
                      Sign in required
                    </button>
                  </article>
                ))}
              </div>
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
