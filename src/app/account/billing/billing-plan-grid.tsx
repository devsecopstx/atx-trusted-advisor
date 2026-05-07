import type { BillingPlanCardPayload } from "@/app/account/billing/billing-plan-cards-client";
import { BillingPlanCardsClient } from "@/app/account/billing/billing-plan-cards-client";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";
import { billingCardWorkspaceDisplay, billingPlanSummaryChips } from "@/lib/billing-plan-workspace-display";
import type { Tenant } from "@/modules/identity/types";

export function buildBillingPlanCardPayloads(tenant: Tenant | null): BillingPlanCardPayload[] {
  return ATX_BILLING_PLANS.map((plan) => {
    const { priceParts, limitRows } = billingCardWorkspaceDisplay({ tenant, plan });
    return {
      planId: plan.id,
      planName: plan.name,
      highlight: plan.highlight,
      summaryValueProp: plan.summaryValueProp,
      limitsExpandNote: plan.limitsExpandNote,
      priceAmount: priceParts.priceAmount,
      periodNote: priceParts.periodNote,
      summaryChips: billingPlanSummaryChips(limitRows),
      limitRows
    };
  });
}

type Props = {
  tenant: Tenant | null;
  approved: boolean;
  checkoutReady: boolean;
};

export function BillingPlanGrid({ tenant, approved, checkoutReady }: Props) {
  const cards = buildBillingPlanCardPayloads(tenant);

  return <BillingPlanCardsClient approved={approved} cards={cards} checkoutReady={checkoutReady} />;
}
