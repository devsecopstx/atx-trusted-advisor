import { describe, expect, it } from "vitest";

import {
    BROKER_BRAND_COLORS,
    renderBrokerBrandMark
} from "@/components/brokers/broker-brand-icons";

describe("broker-brand-icons", () => {
  it("uses production brand hex colors", () => {
    expect(BROKER_BRAND_COLORS.fidelity.primary).toBe("#00A651");
    expect(BROKER_BRAND_COLORS.etrade.primary).toBe("#003366");
    expect(BROKER_BRAND_COLORS.ibkr.primary).toBe("#E31837");
    expect(BROKER_BRAND_COLORS.merrill.primary).toBe("#012169");
    expect(BROKER_BRAND_COLORS.merrill.accent).toBe("#FFC72C");
  });

  it("renders inline SVG marks for all catalog slugs", () => {
    for (const slug of ["fidelity", "etrade", "forge", "hiive", "ibkr", "merrill"] as const) {
      const node = renderBrokerBrandMark(slug, { size: 40, title: slug });
      expect(node).toBeTruthy();
    }
  });
});
