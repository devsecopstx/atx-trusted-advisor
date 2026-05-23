import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
    PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE,
    USER_PRODUCT_DESCRIPTOR_LINE,
    USER_PRODUCT_HOME_ARIA_LABEL
} from "@/app/ui/product-brand-constants";

describe("user surfaces: aTx Trusted Advisory brand", () => {
  it("exports stable product strings for chrome and marketing", () => {
    expect(USER_PRODUCT_HOME_ARIA_LABEL).toContain("aTx Trusted Advisory");
    expect(USER_PRODUCT_HOME_ARIA_LABEL).not.toMatch(/whitelabel/i);
    expect(USER_PRODUCT_DESCRIPTOR_LINE).toContain("aTx Trusted Advisory");
    expect(USER_PRODUCT_DESCRIPTOR_LINE).toContain("xChat");
    expect(PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE).toMatch(/No Atoms Moved/i);
    expect(PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE).toMatch(/Gains Earned/i);
  });

  it("xChat header brand shows Trusted Advisory and inline tagline, not xFinance wordmark", () => {
    const p = path.join(process.cwd(), "src/app/ui/xchat-header-brand.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Trusted");
    expect(src).toContain("Advisory");
    expect(src).toContain("xf-header-tagline");
    expect(src).toContain("xf-header-tagline-atoms");
    expect(src).not.toMatch(/>\s*xFinance\s*</);
  });

  it("marketing hero uses shared descriptor, subline, and billing/xOptions CTAs", () => {
    const p = path.join(process.cwd(), "src/app/ui/marketing-hero.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("USER_PRODUCT_DESCRIPTOR_LINE");
    expect(src).toContain("XFINANCE_BRAND_SUBLINE");
    expect(src).toContain('name="aTx Trusted Advisory"');
    expect(src).toContain("MARKETING_LANDING_XOPTIONS_HREF");
    expect(src).toContain("MARKETING_LANDING_BILLING_PLANS_HREF");
    expect(src).not.toContain('name="xFinance"');
  });

  it("guest xChat welcome and plans copy avoid legacy atxFinance product string", () => {
    const guest = readFileSync(
      path.join(process.cwd(), "src/app/xchat/ui/xchat-guest-panel.tsx"),
      "utf8"
    );
    expect(guest).toContain("aTx Trusted Advisory");
    expect(guest).not.toMatch(/Welcome to atxFinance/);

    const plans = readFileSync(path.join(process.cwd(), "src/app/xchat/ui/plans-landing.tsx"), "utf8");
    expect(plans).toContain("aTx Trusted Advisory access yet");
    expect(plans).not.toMatch(/slug xFinance/);
  });
});
