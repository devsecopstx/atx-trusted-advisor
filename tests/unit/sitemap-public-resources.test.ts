import sitemap from "@/app/sitemap";
import { describe, expect, it } from "vitest";

describe("sitemap public resources", () => {
  it("includes all public /resources routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url).sort();

    const BASE = "https://atxtrustedadvisory.com";
    const expected = [
      "/resources/guides",
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
    ]
      .map((p) => `${BASE}${p}`)
      .sort();

    for (const u of expected) {
      expect(urls).toContain(u);
    }
  });
});
