import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MARKETING_LANDING_BILLING_PLANS_HREF,
  MARKETING_LANDING_BILLING_REGISTER_HREF,
  MARKETING_LANDING_XOPTIONS_HREF
} from "@/lib/marketing/landing-cta";
import { XFINANCE_BRAND_SUBLINE } from "@/lib/xfinance-brand";

describe("public marketing landing hero v2", () => {
  const landingPath = path.join(process.cwd(), "src/app/ui/public-marketing-landing.tsx");
  const landingSource = readFileSync(landingPath, "utf8");

  it("uses canonical subline as hero headline", () => {
    expect(landingSource).toContain("XFINANCE_BRAND_SUBLINE");
    expect(landingSource).not.toContain("Real-Money Options Income.");
  });

  it("routes variant hero copy through guest landing modules", () => {
    const copyPath = path.join(process.cwd(), "src/lib/marketing/guest-landing-copy.ts");
    const copySource = readFileSync(copyPath, "utf8");
    expect(landingSource).toContain("GUEST_LANDING_HERO_COPY");
    expect(landingSource).toContain("data-guest-landing");
    expect(copySource).toContain("Sign in with X");
    expect(copySource).toContain("Request advisor access");
    expect(MARKETING_LANDING_XOPTIONS_HREF).toBe("/xoptions");
    expect(MARKETING_LANDING_BILLING_REGISTER_HREF).toBe("/account/billing?register=1&plan=basic");
    expect(MARKETING_LANDING_BILLING_PLANS_HREF).toBe("/account/billing");
  });

  it("keeps brand subline aligned with xfinance-brand constant", () => {
    expect(XFINANCE_BRAND_SUBLINE).toBe("xAI-Powered Options Intelligence for Serious Portfolios");
  });
});
