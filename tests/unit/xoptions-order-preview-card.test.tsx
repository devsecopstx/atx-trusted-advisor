import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { XoptionsOrderPreviewCard } from "@/app/xoptions/xoptions-order-preview-card";

describe("XoptionsOrderPreviewCard", () => {
  it("renders sell-to-open order with prominent money and obligation details", () => {
    const html = renderToStaticMarkup(
      <XoptionsOrderPreviewCard
        symbol="IREN"
        strike={51}
        expirationYyyyMmDd="2026-05-08"
        quantity={10}
        optionSide="put"
        openingAction="sell_to_open"
        limitPricePerShare={4.95}
        probabilityOtmPercent={44}
        strategyType="Cash-secured put"
        chainId="IREN260508P00051000"
      />
    );

    expect(html).toContain("You are selling");
    expect(html).toContain("IREN");
    expect(html).toContain("$51.00");
    expect(html).toContain("Expires");
    expect(html).toContain("May 8, 2026");
    expect(html).toContain("Max Credit");
    expect(html).toContain("$4,950.00");
    expect(html).toContain("P(OTM)");
    expect(html).toContain("44%");
    expect(html).toContain("IREN &gt; $51.00 at expiration");
    expect(html).toContain("If assigned, you may be obligated to buy 1,000 shares");
    expect(html).toContain("Total");
    expect(html).toContain("$51,000.00");
    expect(html).toContain("Potential earnings:");
    expect(html).toContain("9.7%");
    expect(html).toContain("Chain ID:");
    expect(html).toContain("IREN260508P00051000");
    expect(html).toContain("Data: Yahoo (delayed 15 min)");
    expect(html).toContain("Edit order");
  });
});
