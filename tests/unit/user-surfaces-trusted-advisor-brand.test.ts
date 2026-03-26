import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
    USER_PRODUCT_DESCRIPTOR_LINE,
    USER_PRODUCT_HOME_ARIA_LABEL,
    USER_PRODUCT_WHITELABEL_SUBLINE
} from "@/app/ui/product-brand-constants";

describe("user surfaces: atx Trusted Advisor + whitelabel brand", () => {
  it("exports stable product strings for chrome and marketing", () => {
    expect(USER_PRODUCT_WHITELABEL_SUBLINE).toBe("whitelabel");
    expect(USER_PRODUCT_HOME_ARIA_LABEL).toContain("atx Trusted Advisor");
    expect(USER_PRODUCT_HOME_ARIA_LABEL).toContain("whitelabel");
    expect(USER_PRODUCT_DESCRIPTOR_LINE).toContain("atx Trusted Advisor");
    expect(USER_PRODUCT_DESCRIPTOR_LINE).toContain("xChat");
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

  it("marketing hero uses shared descriptor and retitles the portfolio product card", () => {
    const p = path.join(process.cwd(), "src/app/ui/marketing-hero.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("USER_PRODUCT_DESCRIPTOR_LINE");
    expect(src).toContain('name="atx Trusted Advisor"');
    expect(src).not.toContain('name="xFinance"');
  });

  it("guest xChat welcome and plans copy avoid legacy atxFinance product string", () => {
    const guest = readFileSync(
      path.join(process.cwd(), "src/app/xchat/ui/xchat-guest-panel.tsx"),
      "utf8"
    );
    expect(guest).toContain("atx Trusted Advisor");
    expect(guest).not.toMatch(/Welcome to atxFinance/);

    const plans = readFileSync(path.join(process.cwd(), "src/app/xchat/ui/plans-landing.tsx"), "utf8");
    expect(plans).toContain("atx Trusted Advisor access yet");
  });
});
