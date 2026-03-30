import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";
import { billingCardWorkspaceDisplay } from "@/lib/billing-plan-workspace-display";
import type { Tenant } from "@/modules/identity/types";

type Props = {
  tenant: Tenant | null;
  approved: boolean;
  checkoutReady: boolean;
};

export function BillingPlanGrid({ tenant, approved, checkoutReady }: Props) {
  const guestReadonly = !approved;

  return (
    <div className="billing-grid">
      {ATX_BILLING_PLANS.map((plan) => {
        const { priceParts, limitRows } = billingCardWorkspaceDisplay({ tenant, plan });
        return (
          <article
            key={plan.id}
            className={`billing-card xf-widget${plan.highlight ? " billing-card--highlight" : ""}`}
          >
            {plan.highlight ? <span className="billing-card__tag">Popular</span> : null}
            <h2 className="billing-card__name">{plan.name}</h2>
            <p className="billing-card__tagline">{plan.tagline}</p>
            <p className="billing-card__price">{priceParts.priceAmount}</p>
            <p className="billing-card__period">{priceParts.periodNote}</p>
            <ul className="billing-card__list">
              {plan.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="billing-card__limits">
              <p className="billing-card__limits-title">Workspace limits</p>
              <ul className="billing-card__limits-list">
                {limitRows.map((row) => (
                  <li key={`${plan.id}-${row.label}`}>
                    <span className="billing-card__limits-metric">{row.label}</span>
                    <span className="billing-card__limits-value">{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            {guestReadonly ? (
              <form method="get">
                <input name="register" type="hidden" value="1" />
                <input name="plan" type="hidden" value={plan.id} />
                <button className="billing-checkout-button" type="submit">
                  Select {plan.name} and Register for access
                </button>
              </form>
            ) : (
              <AtxBillingCheckoutButton planId={plan.id} checkoutReady={checkoutReady} />
            )}
          </article>
        );
      })}
    </div>
  );
}
