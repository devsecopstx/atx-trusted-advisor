import { describe, expect, it } from "vitest";

import { parsePlanOverridesPayload } from "@/modules/identity/tenant-workspace-limits";

describe("parsePlanOverridesPayload stripe ids", () => {
  it("accepts valid prod_ and price_ ids", () => {
    const r = parsePlanOverridesPayload({
      basic: {
        price: 9,
        stripeProductId: "prod_ABC123",
        stripePriceId: "price_XYZ789"
      }
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value.basic?.stripeProductId).toBe("prod_ABC123");
    expect(r.value.basic?.stripePriceId).toBe("price_XYZ789");
  });

  it("rejects invalid stripe price id", () => {
    const r = parsePlanOverridesPayload({
      basic: { price: 9, stripePriceId: "not_valid" }
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain("stripePriceId");
  });

  it("allows empty string to omit stripe ids", () => {
    const r = parsePlanOverridesPayload({
      basic: { price: 9, stripePriceId: "", stripeProductId: "" }
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value.basic?.stripePriceId).toBeUndefined();
    expect(r.value.basic?.stripeProductId).toBeUndefined();
  });
});
