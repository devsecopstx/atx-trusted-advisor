import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap public resources", () => {
  it("includes all public /resources routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url).sort();

    const BASE = "https://atxtrustedadvisory.com";
    const expected = [
      "/resources/about",
      "/resources/decision-workflow",
      "/resources/secret-sauce",
      "/resources/getting-started",
      "/resources/building-wheel",
      "/resources/building-wheel/wheel-vs-iron-condor"
    ]
      .map((p) => `${BASE}${p}`)
      .sort();

    for (const u of expected) {
      expect(urls).toContain(u);
    }
  });
});
