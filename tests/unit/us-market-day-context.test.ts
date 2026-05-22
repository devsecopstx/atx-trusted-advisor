import { describe, expect, it } from "vitest";

import {
    formatUsMarketOpensInLabel,
    resolveNextUsMarketOpenAt,
    resolveUsMarketDayContext,
    usMarketSessionStatusLabel
} from "@/modules/scanner/us-market-day-context";

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
    expect(usMarketSessionStatusLabel(ctx, d).label).toBe("Open");
    expect(usMarketSessionStatusLabel(ctx, d).headerLabel).toBe("Open");
  });

  it("pre-market Wednesday shows closed with opens-in countdown", () => {
    const d = new Date("2026-04-08T08:00:00.000-04:00");
    const ctx = resolveUsMarketDayContext(d);
    expect(ctx.marketWindowOpen).toBe(false);
    const next = resolveNextUsMarketOpenAt(d);
    expect(next).not.toBeNull();
    const opensIn = formatUsMarketOpensInLabel(d, next!);
    expect(opensIn).toBe("1h 30m");
    const status = usMarketSessionStatusLabel(ctx, d);
    expect(status.label).toBe("Closed");
    expect(status.headerLabel).toBe(`Closed · opens in ${opensIn}`);
  });

  it("after-hours Wednesday counts down to next session", () => {
    const d = new Date("2026-04-08T16:30:00.000-04:00");
    const ctx = resolveUsMarketDayContext(d);
    expect(ctx.marketWindowOpen).toBe(false);
    const next = resolveNextUsMarketOpenAt(d);
    expect(next).not.toBeNull();
    const opensIn = formatUsMarketOpensInLabel(d, next!);
    expect(opensIn).toBe("17h");
    const status = usMarketSessionStatusLabel(ctx, d);
    expect(status.headerLabel).toBe(`Closed · opens in ${opensIn}`);
  });
});
