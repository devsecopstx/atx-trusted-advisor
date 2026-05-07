import { describe, expect, it } from "vitest";

import { ATX_BILLING_PLAN_LIMIT_ROWS, catalogListPriceUsdForPlan } from "@/lib/atx-billing-plan-limits";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";

describe("ATX billing list pricing", () => {
  it("matches published card labels (sync with atx-docs/resouces/atx-limits.txt.tsv Price row)", () => {
    const [basic, premium, plus] = ATX_BILLING_PLANS;
    expect(basic.priceLabel).toBe("$5");
    expect(basic.periodNote).toBe("per month");
    expect(premium.priceLabel).toBe("$15");
    expect(premium.periodNote).toBe("per month");
    expect(plus.priceLabel).toBe("$30");
    expect(plus.periodNote).toBe("per month");
  });

  it("catalogListPriceUsdForPlan reads Price row (Stripe-aligned fallback when tenant has no list price)", () => {
    expect(catalogListPriceUsdForPlan("basic")).toBe(5);
    expect(catalogListPriceUsdForPlan("premium_monthly")).toBe(15);
    expect(catalogListPriceUsdForPlan("premium_plus_monthly")).toBe(30);
  });

  it("limits matrix first row is Price and aligns with plan labels", () => {
    const priceRow = ATX_BILLING_PLAN_LIMIT_ROWS[0];
    expect(priceRow?.metric).toBe("Price");
    expect(priceRow?.basic).toBe("$5/mo");
    expect(priceRow?.premium).toBe("$15/mo");
    expect(priceRow?.premiumPlus).toBe("$30/mo");
    expect(ATX_BILLING_PLAN_LIMIT_ROWS).toHaveLength(8);
  });
});
