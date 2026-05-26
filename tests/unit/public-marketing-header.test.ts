import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("PublicMarketingHeader", () => {
  const headerPath = path.join(process.cwd(), "src/app/ui/public-marketing-header.tsx");
  const source = readFileSync(headerPath, "utf8");

  it("ships paired xOptions + billing CTAs with shared button sizing", () => {
    expect(source).toContain("MARKETING_LANDING_XOPTIONS_CTA_LABEL");
    expect(source).toContain("MARKETING_HEADER_BTN_SECONDARY");
    expect(source).toContain("MARKETING_HEADER_BTN_PRIMARY");
    expect(source).toContain("h-11");
    expect(source).toContain("rounded-2xl");
    expect(source).toContain("var(--xf-gain-green)");
  });

  it("exposes mobile drawer nav with hamburger toggle", () => {
    expect(source).toContain("LucideMenuIcon");
    expect(source).toContain("md:hidden");
    expect(source).toContain('aria-expanded={mobileOpen}');
    expect(source).not.toContain("Already have an account");
  });

  it("lists marketing nav helpers", () => {
    expect(source).toContain("Educational hub");
    expect(source).toContain("White-label platform");
    expect(source).toContain("marketingNavLinks(variant)");
  });
});

// Note: The heavy "developers-agents" section was intentionally removed from the main public landing
// during the 2026 noise-reduction pass to keep the guest experience focused.
// The MCP / quant-trader content now lives on the lightweight pages:
//   - /for-developers
//   - /growth
// This test block was removed as the assertions are no longer valid for the main landing.
