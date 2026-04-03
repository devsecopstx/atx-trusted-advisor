import { describe, expect, it } from "vitest";

import { resolveUsMarketDayContext, usMarketSessionStatusLabel } from "@/modules/scanner/us-market-day-context";

describe("us-market-day-context", () => {
  it("treats Good Friday 2026 as a closed market holiday (NY civil date)", () => {
    const d = new Date("2026-04-03T16:00:00.000-04:00");
    const ctx = resolveUsMarketDayContext(d);
    expect(ctx.marketDate).toBe("2026-04-03");
    expect(ctx.isHoliday).toBe(true);
    expect(ctx.holidayName).toBe("Good Friday");
    expect(ctx.isBusinessDay).toBe(false);
    expect(ctx.marketWindowOpen).toBe(false);
    expect(usMarketSessionStatusLabel(ctx).label).toBe("Closed");
  });

  it("regular Wednesday during session window is open", () => {
    const d = new Date("2026-04-08T14:30:00.000-04:00");
    const ctx = resolveUsMarketDayContext(d);
    expect(ctx.isHoliday).toBe(false);
    expect(ctx.isBusinessDay).toBe(true);
    expect(ctx.marketWindowOpen).toBe(true);
    expect(usMarketSessionStatusLabel(ctx).label).toBe("Open");
  });
});
