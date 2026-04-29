import { describe, expect, it } from "vitest";

import { DESK_HEALTH_TIPS, pickHealthTipForLocalDate } from "@/lib/desk-wellness-health-tips";

describe("pickHealthTipForLocalDate", () => {
  it("returns a non-empty tip from the catalog", () => {
    const tip = pickHealthTipForLocalDate(new Date(2026, 5, 15));
    expect(tip.length).toBeGreaterThan(10);
    expect(DESK_HEALTH_TIPS).toContain(tip);
  });

  it("is stable for the same calendar day", () => {
    const a = pickHealthTipForLocalDate(new Date(2026, 5, 15, 8, 0, 0));
    const b = pickHealthTipForLocalDate(new Date(2026, 5, 15, 22, 30, 0));
    expect(a).toBe(b);
  });
});
