import { describe, expect, it } from "vitest";

import {
    addCalendarDaysUtc,
    horizonShortLabel,
    otmPercentCall,
    otmPercentPut,
    pickExpirationOnOrAfter,
    spreadQuality,
    utcDayStartMs
} from "@/lib/xoptions/xoptions-chain-helpers";

describe("xoptions-chain-helpers", () => {
  it("pickExpirationOnOrAfter returns first date on or after target", () => {
    const target = new Date(Date.UTC(2026, 2, 30)); // Mar 30 2026
    const dates = ["2026-03-20", "2026-04-03", "2026-04-17"];
    expect(pickExpirationOnOrAfter(dates, target)).toBe("2026-04-03");
  });

  it("pickExpirationOnOrAfter returns null when all dates before target", () => {
    const target = new Date(Date.UTC(2026, 5, 1));
    const dates = ["2026-03-20", "2026-04-03"];
    expect(pickExpirationOnOrAfter(dates, target)).toBeNull();
  });

  it("utcDayStartMs sorts consistently", () => {
    expect(utcDayStartMs("2026-04-03")).toBeLessThan(utcDayStartMs("2026-04-17"));
  });

  it("addCalendarDaysUtc adds calendar days", () => {
    const d = new Date(Date.UTC(2026, 0, 28));
    const next = addCalendarDaysUtc(d, 7);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-04");
  });

  it("horizonShortLabel maps weeks", () => {
    expect(horizonShortLabel(7)).toBe("1W");
    expect(horizonShortLabel(14)).toBe("2W");
    expect(horizonShortLabel(28)).toBe("4W");
  });

  it("otmPercentCall and Put match spec", () => {
    const u = 100;
    expect(otmPercentCall(110, u)).toBeCloseTo(10, 5);
    expect(otmPercentCall(90, u)).toBe(0);
    expect(otmPercentPut(90, u)).toBeCloseTo(10, 5);
    expect(otmPercentPut(110, u)).toBe(0);
  });

  it("spreadQuality matches green / amber / red bands", () => {
    expect(spreadQuality(0.08, 8)).toBe("ok");
    expect(spreadQuality(0.08, 3)).toBe("ok");
    expect(spreadQuality(0.2, 20)).toBe("mid");
    expect(spreadQuality(0.4, 20)).toBe("wide");
  });
});
