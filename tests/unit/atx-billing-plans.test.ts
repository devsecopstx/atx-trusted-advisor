import { describe, expect, it } from "vitest";

import { ATX_BILLING_PLAN_LIMIT_ROWS } from "@/lib/atx-billing-plan-limits";
import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";

describe("ATX billing list pricing", () => {
  it("matches published card labels (sync with atx-docs/resouces/atx-limits.txt.tsv Price row)", () => {
    const [basic, premium, plus] = ATX_BILLING_PLANS;
    expect(basic.priceLabel).toBe("$9");
    expect(basic.periodNote).toBe("per month");
    expect(premium.priceLabel).toBe("$99");
    expect(premium.periodNote).toBe("per month");
    expect(plus.priceLabel).toBe("$299");
    expect(plus.periodNote).toBe("per month");
  });

  it("limits matrix first row is Price and aligns with plan labels", () => {
    const priceRow = ATX_BILLING_PLAN_LIMIT_ROWS[0];
    expect(priceRow?.metric).toBe("Price");
    expect(priceRow?.basic).toBe("$9/mo");
    expect(priceRow?.premium).toBe("$99/mo");
    expect(priceRow?.premiumPlus).toBe("$299/mo");
    expect(ATX_BILLING_PLAN_LIMIT_ROWS).toHaveLength(7);
  });
});
