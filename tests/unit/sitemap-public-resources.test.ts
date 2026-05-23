import sitemap from "@/app/sitemap";
import { describe, expect, it } from "vitest";

describe("sitemap public resources", () => {
  it("includes all public /resources routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url).sort();

    const BASE = "https://fintech-advisor.ai";
    const expected = [
      "/resources/guides",
      "/resources/onboarding-checklist",
      "/resources/about",
      "/resources/decision-workflow",
      "/resources/secret-sauce",
      "/resources/getting-started",
      "/resources/building-wheel",
      "/resources/building-wheel/wheel-vs-iron-condor",
      "/resources/2026-options-income-playbook",
      "/resources/how-xai-spots-better-wheels",
      "/resources/cash-secured-puts-mastery",
      "/resources/covered-calls-2026-balanced-income",
      "/resources/leap-options-playbook",
      "/resources/multi-portfolio-management-hnwi",
      "/resources/options-risk-management-frameworks",
      "/resources/from-xchat-to-broker-ibkr",
      "/resources/top-10-hnwi-xchat-prompts",
      "/resources/quant-trader-guide",
    ]
      .map((p) => `${BASE}${p}`)
      .sort();

    for (const u of expected) {
      expect(urls).toContain(u);
    }
  });

  it("includes SEO solution landing routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url).sort();
    const BASE = "https://fintech-advisor.ai";
    const expected = [
      "/wheel-strategy-ai",
      "/covered-call-portfolio-manager",
      "/ibkr-options-automation",
      "/ia-white-label-platform"
    ]
      .map((p) => `${BASE}${p}`)
      .sort();
    for (const u of expected) {
      expect(urls).toContain(u);
    }
  });
});
