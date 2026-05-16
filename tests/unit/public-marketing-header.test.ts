import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("PublicMarketingHeader", () => {
  const headerPath = path.join(process.cwd(), "src/app/ui/public-marketing-header.tsx");
  const source = readFileSync(headerPath, "utf8");

  it("ships paired Sign In + trial CTAs with shared button sizing", () => {
    expect(source).toContain("Sign In");
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
    expect(source).toContain("Developers");
    expect(source).toContain("Desk series");
    expect(source).toContain("Top 10 HNWI prompts");
  });
});

describe("PublicMarketingLanding developers section", () => {
  const landingPath = path.join(process.cwd(), "src/app/ui/public-marketing-landing.tsx");
  const source = readFileSync(landingPath, "utf8");

  it("mentions xfinance-advisor-mcp and quant-trader persona on landing", () => {
    expect(source).toContain('id="developers-agents"');
    expect(source).toContain("xfinance-advisor-mcp");
    expect(source).toContain("quant-trader persona");
    expect(source).toContain("/xoptions/quant-trader");
    expect(source).toContain("utm_content: \"quant-trader-persona\"");
  });
});
