import { describe, expect, it } from "vitest";

import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";

describe("ADVISORY_RESOURCE_PILLARS", () => {
  it("lists eight unique educational articles with stable paths", () => {
    expect(ADVISORY_RESOURCE_PILLARS.length).toBe(8);
    const hrefs = ADVISORY_RESOURCE_PILLARS.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(8);
    for (const p of ADVISORY_RESOURCE_PILLARS) {
      expect(p.href.startsWith("/resources/")).toBe(true);
      expect(p.label.trim().length).toBeGreaterThan(0);
      expect(p.blurb.trim().length).toBeGreaterThan(0);
    }
  });
});
