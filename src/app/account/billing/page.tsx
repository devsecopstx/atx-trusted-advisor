import { redirect } from "next/navigation";

import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
import { BillingFeedbackLink } from "@/app/account/ui/billing-feedback-link";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserShellCollapsibleRail } from "@/app/ui/app-user-shell-collapsible-rail";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";
import { getSessionUser } from "@/lib/auth";
import { getStripePublishableKey, isStripeBillingFullyConfigured } from "@/lib/stripe-config";
import { getResolvedWorkspaceLimitsForTenantId } from "@/lib/tenant-workspace-limits";
import { canUserLogin } from "@/modules/identity/authorization";

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
  const workspaceLimits = await getResolvedWorkspaceLimitsForTenantId(session.tenantId);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="account" feedbackPageLabel="Billing" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserShellCollapsibleRail mainPadded>
          <AppUserAccountPublicRailForSession session={session} />
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

              <section
                className="billing-workspace-limits xf-widget section-card xf-noise-overlay"
                aria-labelledby="billing-workspace-limits-heading"
              >
                <h2 id="billing-workspace-limits-heading" className="billing-card__name" style={{ marginBottom: "0.5rem" }}>
                  Workspace limits
                </h2>
                <p className="billing-hero__copy" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
                  Your tenant workspace caps below apply on top of plan rules where noted. A workspace admin can adjust
                  them under Admin → Workspace limits.
                </p>
                <dl className="billing-workspace-limits__grid">
                  <div className="billing-workspace-limits__row">
                    <dt>xoptions deck views / day</dt>
                    <dd>{workspaceLimits.userXoptionsLimit}</dd>
                  </div>
                  <div className="billing-workspace-limits__row">
                    <dt>xChat prompts / day (with plan)</dt>
                    <dd>min(plan, {workspaceLimits.userChatLimit})</dd>
                  </div>
                  <div className="billing-workspace-limits__row">
                    <dt>Portfolios per user</dt>
                    <dd>{workspaceLimits.tenantPortfolioLimit}</dd>
                  </div>
                  <div className="billing-workspace-limits__row">
                    <dt>Accounts per portfolio</dt>
                    <dd>{workspaceLimits.portfolioAccountLimit}</dd>
                  </div>
                </dl>
              </section>

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
