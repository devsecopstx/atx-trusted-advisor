import { describe, expect, it } from "vitest";

import { auditLoginUtcDayBounds, startOfUtcDay } from "@/lib/audit-login-utc-day";

describe("auditLoginUtcDayBounds", () => {
  it("uses UTC midnight through now (hub logins-today window)", () => {
    const now = new Date("2026-05-21T15:30:00.000Z");
    const { from, to, label } = auditLoginUtcDayBounds(now);

    expect(startOfUtcDay(now).toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(from.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(to).toBe(now);
    expect(label).toContain("(UTC)");
  });

  it("counts attempts after UTC midnight that fall before US-Pacific local midnight", () => {
    const loginAt = new Date("2026-05-21T06:00:00.000Z");
    const viewerNow = new Date("2026-05-21T12:00:00.000Z");
    const pacificLocalMidnightUtc = new Date("2026-05-21T07:00:00.000Z");
    const { from } = auditLoginUtcDayBounds(viewerNow);

    expect(loginAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(loginAt.getTime()).toBeLessThan(pacificLocalMidnightUtc.getTime());
  });
});
