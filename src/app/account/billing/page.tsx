import { redirect } from "next/navigation";

import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
import { BillingFeedbackLink } from "@/app/account/ui/billing-feedback-link";
import { AppUserAccountPublicRail } from "@/app/ui/app-user-rail-nav";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";
import { getSessionUser } from "@/lib/auth";
import { getStripePublishableKey, isStripeBillingFullyConfigured } from "@/lib/stripe-config";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import "./billing-plans.css";

export const dynamic = "force-dynamic";

export default async function AccountBillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/account/billing");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const sp = (await searchParams) ?? {};
  const checkout = typeof sp.checkout === "string" ? sp.checkout : undefined;

  const checkoutReady = isStripeBillingFullyConfigured();
  const publishableConfigured = Boolean(getStripePublishableKey());
  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="account" feedbackPageLabel="Billing" session={session} />

      <div className="xchat-body portfolio-page-body">
        <div className="app-user-shell-with-rail">
          <AppUserAccountPublicRail isGlobalAdmin={admin} />
          <div className="app-user-shell-main app-user-shell-with-rail--padded">
            <div className="billing-page">
              <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
                <p className="billing-hero__eyebrow">ATX price plans</p>
                <h1 className="billing-hero__title">Account &amp; billing</h1>
                <p className="billing-hero__copy">
                  Choose a plan for <strong className="text-[var(--xf-gain-green)]">atx Trusted Advisor</strong>. Checkout
                  runs on Stripe; subscription status and webhooks can tighten plan limits in a follow-up.
                </p>
                <p className="billing-hero__feedback">
                  Questions on plans, access, or invoices?{" "}
                  <BillingFeedbackLink>Submit feedback</BillingFeedbackLink>
                  <span className="billing-hero__feedback-suffix"> — same form as under your avatar menu.</span>
                </p>
              </header>

              {checkout === "success" ? (
                <div className="billing-banner billing-banner--ok" role="status">
                  Checkout completed — thank you. It may take a minute for entitlements to sync once webhooks are wired.
                </div>
              ) : null}
              {checkout === "canceled" ? (
                <div className="billing-banner billing-banner--muted" role="status">
                  Checkout canceled — no charge. Pick a plan below when you&apos;re ready.
                </div>
              ) : null}

              <div className="billing-banner billing-banner--muted" role="note">
                <strong>How we work together:</strong> you agree to use xFinance <strong>lawfully</strong> and in line
                with applicable rules and our terms. We ask that you send <strong>thoughtful, meaningful</strong> product
                input when something misses the mark —{" "}
                <BillingFeedbackLink>Submit feedback</BillingFeedbackLink>
                <span> — concrete suggestions help us improve the product for everyone.</span>
              </div>

              {!checkoutReady ? (
                <div className="billing-banner billing-banner--muted" role="status">
                  Checkout isn&apos;t available in this environment yet — the plans below show list pricing;{" "}
                  <BillingFeedbackLink>Submit feedback</BillingFeedbackLink> if you need help with access or billing.
                </div>
              ) : null}

              {checkoutReady && !publishableConfigured ? (
                <div className="billing-banner billing-banner--muted">
                  <strong>Note:</strong> Add{" "}
                  <code className="font-mono text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (GitHub{" "}
                  <strong>Variable</strong>, not Secret) for future in-app Elements; server checkout still works.
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
                    <AtxBillingCheckoutButton planId={plan.id} checkoutReady={checkoutReady} />
                  </article>
                ))}
              </div>

              <p className="billing-footnote">
                Not financial advice. Trial access is time-limited; subscribe to keep full access at the plan you choose.
                Card processing and receipts are handled by Stripe. For access or invoice issues,{" "}
                <BillingFeedbackLink>Submit feedback</BillingFeedbackLink> or contact your workspace admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
