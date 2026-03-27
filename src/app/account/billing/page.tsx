import { redirect } from "next/navigation";

import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
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
                  Choose a plan for <strong className="text-[var(--xf-gain-green)]">atx Trusted Advisor</strong> — from
                  HNWI Basic with limits, through Premium (complex books + fair per-hour caps on xChat and
                  xStrategyBuilder), to Premium+ with a dedicated enterprise-grade instance and no training-data use.
                  Checkout runs on Stripe; webhooks will sync entitlements when wired.
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

              {!checkoutReady ? (
                <div className="billing-banner billing-banner--muted">
                  <strong>Operator setup:</strong> configure <code className="font-mono text-xs">STRIPE_SECRET_KEY</code>{" "}
                  (GCP Secret Manager) and the three <code className="font-mono text-xs">STRIPE_PRICE_*</code> price IDs
                  (env / variables). See <code className="font-mono text-xs">atx-docs/sre-ops/stripe-billing-setup.md</code>{" "}
                  in the repo. Buttons stay disabled until then.
                </div>
              ) : !publishableConfigured ? (
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
                Not financial advice. Card processing and receipts are handled by Stripe. For access or invoice issues,
                use <strong>Feedback</strong> in the header or contact your workspace admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
